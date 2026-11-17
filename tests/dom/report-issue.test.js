import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import { mountApplication } from '../../app/js/main.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

const rawHtml = fs
  .readFileSync(path.join(ROOT_DIR, 'app/index.html'), 'utf8')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

const SAMPLE_QUESTIONS = [
  {
    id: 'q_rpt_1',
    category: 'אתיקה, חוק ובטיחות המטופל',
    source: 'מבחן 2024',
    question: 'מהי החובה האתית הראשונה במעלה?',
    options: ['בטיחות המטופל', 'חיסכון כספי', 'נוחות הצוות', 'קיצור נהלים'],
    correctIndex: 0,
    detailedExplanation: 'בטיחות המטופל היא ערך עליון.',
  },
  {
    id: 'q_rpt_2',
    category: 'משוב, הערכה ורפלקציה',
    source: 'מבחן 2024',
    question: 'כיצד יש לנסח משוב בונה?',
    options: ['כללי ולא מחייב', 'ספציפי ומבוסס התנהגות', 'בפומבי מול כולם', 'אישי ושיפוטי'],
    correctIndex: 1,
    detailedExplanation: 'משוב אפקטיבי מתמקד בהתנהגות נצפית.',
  },
];

function createInMemoryStorage() {
  const map = new Map();
  return {
    getItem(k) {
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      map.set(k, String(v));
    },
    removeItem(k) {
      map.delete(k);
    },
  };
}

function createMockFirebaseSdk(initialDocs = {}, initialUsers = {}) {
  const reportsStore = new Map(Object.entries(initialDocs));
  const usersStore = new Map(Object.entries(initialUsers));
  const defaultApproved = { active: true, status: 'APPROVED' };
  let authListener = null;
  let snapshotListener = null;
  let currentUser = null;
  const copiedWrites = [];

  function notifySnapshots() {
    if (!snapshotListener) return;
    const openDocs = Array.from(reportsStore.entries())
      .filter(([, data]) => data.status === 'OPEN')
      .map(([id, data]) => ({ id, data: () => data }));
    snapshotListener({ size: openDocs.length, docs: openDocs });
  }

  return {
    reportsStore,
    usersStore,
    copiedWrites,
    setUser(user) {
      currentUser = user;
      if (authListener) authListener(user);
    },
    sdk: {
      GoogleAuthProvider: class {},
      initializeApp: () => ({}),
      getAuth: () => ({
        get currentUser() {
          return currentUser;
        },
      }),
      onAuthStateChanged: (_auth, cb) => {
        authListener = cb;
        cb(currentUser);
        return () => {
          authListener = null;
        };
      },
      signInWithPopup: async () => ({ user: currentUser }),
      signOut: async () => {
        currentUser = null;
        if (authListener) authListener(null);
      },
      getFirestore: () => ({}),
      collection: (_db, name) => ({ path: name }),
      doc: (_db, colName, id) => ({ path: colName, id }),
      query: (colRef) => colRef,
      where: () => ({}),
      orderBy: () => ({}),
      limit: () => ({}),
      getDoc: async (ref) => {
        if (ref?.path === 'allowed_users') {
          const data = usersStore.has(ref.id) ? usersStore.get(ref.id) : defaultApproved;
          return { exists: () => Boolean(data), data: () => data };
        }
        return { exists: () => false, data: () => ({}) };
      },
      setDoc: async (ref, data, opts) => {
        if (ref.path === 'question_reports') {
          const prev = reportsStore.get(ref.id) || {};
          reportsStore.set(ref.id, opts?.merge ? { ...prev, ...data } : { ...data });
          notifySnapshots();
        } else if (ref.path === 'allowed_users') {
          const prev = usersStore.get(ref.id) || {};
          usersStore.set(ref.id, opts?.merge ? { ...prev, ...data } : { ...data });
        }
      },
      addDoc: async (_col, data) => {
        const id = `rpt_auto_${reportsStore.size + 1}`;
        reportsStore.set(id, { ...data });
        notifySnapshots();
        return { id };
      },
      updateDoc: async (ref, data) => {
        const prev = reportsStore.get(ref.id) || {};
        reportsStore.set(ref.id, { ...prev, ...data });
        notifySnapshots();
      },
      deleteDoc: async (ref) => {
        if (ref?.path === 'allowed_users') {
          usersStore.delete(ref.id);
          return;
        }
        reportsStore.delete(ref.id);
        notifySnapshots();
      },
      getDocs: async (ref) => {
        const targetMap = ref?.path === 'allowed_users' ? usersStore : reportsStore;
        return {
          docs: Array.from(targetMap.entries()).map(([id, data]) => ({
            id,
            data: () => data,
          })),
        };
      },
      onSnapshot: (_ref, onNext) => {
        if (_ref?.path === 'question_reports') {
          snapshotListener = onNext;
          notifySnapshots();
          return () => {
            snapshotListener = null;
          };
        }
        return () => {};
      },
    },
  };
}

async function setupReportEnv(initialDocs = {}, initialUsers = {}) {
  const win = new Window({ url: 'http://127.0.0.1:4173/' });
  win.document.body.innerHTML = rawHtml;
  const mockFb = createMockFirebaseSdk(initialDocs, initialUsers);
  const webhookCalls = [];
  const clipboardWrites = [];
  Object.defineProperty(win.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async (text) => {
        clipboardWrites.push(text);
      },
    },
  });

  const app = mountApplication({
    window: win,
    document: win.document,
    localStorage: createInMemoryStorage(),
    preloadedQuestions: SAMPLE_QUESTIONS,
    firebaseSdk: mockFb.sdk,
    autoInitCloudSync: true,
    fetchFn: async (url, init) => {
      webhookCalls.push({ url, body: JSON.parse(init.body) });
      return { ok: true };
    },
  });

  await app.authController.init();
  return { win, document: win.document, app, mockFb, webhookCalls, clipboardWrites };
}

describe('Question Issue Reporting & Admin Dashboard DOM Flow', () => {
  it('blocks unauthenticated submission with Google Sign-In prompt inside the modal', async () => {
    const { document, app } = await setupReportEnv();
    app.router.switchTab('study');

    const reportBtn = document.getElementById('btnReportStudyQuestion');
    assert.ok(reportBtn, 'Study report button must exist');
    reportBtn.click();

    const dialogEl = document.getElementById('reportIssueDialog');
    assert.ok(dialogEl, 'Report dialog must mount into document');
    assert.ok(document.getElementById('reportAuthNotice'), 'Auth gate notice must be rendered');
    assert.ok(document.getElementById('reportSignInBtn'), 'Sign-in CTA button must be rendered');
    assert.equal(
      document.getElementById('reportIssueForm'),
      null,
      'Form must NOT be rendered while signed out'
    );
  });

  it('allows signed-in student to validate, submit report, and keeps admin button hidden', async () => {
    const { win, document, app, mockFb, webhookCalls } = await setupReportEnv();
    mockFb.setUser({
      uid: 'student_uid_1',
      displayName: 'דנה לוי',
      email: 'dana@example.com',
    });

    const adminBtn = document.getElementById('btnAdminReports');
    assert.equal(adminBtn.style.display, 'none', 'Admin button must stay hidden for students');

    app.router.switchTab('study');
    document.getElementById('btnReportStudyQuestion').click();

    const form = document.getElementById('reportIssueForm');
    assert.ok(form, 'Report form must render once signed in');

    // Validation: empty/short comment
    const textarea = document.getElementById('reportCommentInput');
    textarea.value = 'ab';
    form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 15));
    assert.ok(document.getElementById('reportErrorBox'), 'Validation error must render');
    assert.equal(mockFb.reportsStore.size, 0);

    // Choose EXPLANATION_ERROR pill and enter valid comment
    const expPill = document.querySelector('button[data-issue-type="EXPLANATION_ERROR"]');
    expPill.click();
    const validTextarea = document.getElementById('reportCommentInput');
    validTextarea.value = 'ההסבר הפדגוגי מתייחס לשאלה אחרת.';
    validTextarea.dispatchEvent(new win.Event('input', { bubbles: true }));
    assert.match(document.getElementById('reportCharCounter').textContent, /32 \/ 1000/);

    document
      .getElementById('reportIssueForm')
      .dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 25));

    assert.equal(mockFb.reportsStore.size, 1, 'Report must be saved in Firestore');
    const saved = Array.from(mockFb.reportsStore.values())[0];
    assert.equal(saved.issueType, 'EXPLANATION_ERROR');
    assert.equal(saved.reporterUid, 'student_uid_1');
    assert.equal(saved.status, 'OPEN');
    assert.equal(webhookCalls.length, 1, 'Telegram webhook relay must be invoked once');
    assert.equal(webhookCalls[0].body.issueType, 'EXPLANATION_ERROR');
    assert.equal(app.reportController ? true : false, true);
    assert.match(document.getElementById('appGlobalToast').textContent, /הדיווח נשלח/);
  });

  it('reveals admin badge + dashboard for authorized admin, escapes XSS, and updates/copies reports', async () => {
    const { document, mockFb, clipboardWrites } = await setupReportEnv({
      rpt_xss_1: {
        questionId: 'q_rpt_1',
        category: 'אתיקה, חוק ובטיחות המטופל',
        source: 'מבחן 2024',
        questionText: 'מהי החובה האתית?',
        issueType: 'KEY_ERROR',
        comment: '<script>window.__xss=1</script> תשובה ב נכונה יותר',
        reporterUid: 'uid_attacker',
        reporterName: '<img src=x onerror=alert(1)>',
        reporterEmail: 'student@example.com',
        status: 'OPEN',
        createdAt: '2026-11-15T10:00:00.000Z',
        updatedAt: '2026-11-15T10:00:00.000Z',
      },
    });

    mockFb.setUser({
      uid: 'admin_uid_1',
      displayName: 'Benjamin Rotlevy',
      email: 'benjaminrotlevy@gmail.com',
    });
    await new Promise((r) => setTimeout(r, 20));

    const adminBtn = document.getElementById('btnAdminReports');
    const badge = document.getElementById('adminReportsBadge');
    assert.equal(adminBtn.style.display, 'inline-flex', 'Admin button must appear for admin');
    assert.equal(badge.textContent, '1');

    adminBtn.click();
    await new Promise((r) => setTimeout(r, 25));

    const adminDialog = document.getElementById('adminReportsDialog');
    assert.ok(adminDialog, 'Admin dashboard dialog must open');
    assert.equal(
      adminDialog.querySelectorAll('.admin-report-card script, .admin-report-card img').length,
      0,
      'Untrusted XSS tags inside comment/reporterName must be escaped as text'
    );
    assert.match(adminDialog.textContent, /תשובה ב נכונה יותר/);

    // Copy report details for editing
    adminDialog.querySelector('button[data-admin-action="copy"]').click();
    await new Promise((r) => setTimeout(r, 15));
    assert.equal(clipboardWrites.length, 1);
    assert.match(clipboardWrites[0], /=== דיווח על שאלה: q_rpt_1 ===/);

    // Mark report resolved
    adminDialog.querySelector('button[data-admin-action="resolve"]').click();
    await new Promise((r) => setTimeout(r, 25));
    assert.equal(mockFb.reportsStore.get('rpt_xss_1').status, 'RESOLVED');
    assert.equal(badge.textContent, '0');
  });

  it('shows offline error and keeps Cancel clickable even during in-flight report submission', async () => {
    const { win, document, app, mockFb } = await setupReportEnv();
    mockFb.setUser({
      uid: 'student_uid_offline',
      displayName: 'רותם שמש',
      email: 'rotem@example.com',
    });

    app.router.switchTab('study');
    document.getElementById('btnReportStudyQuestion').click();

    // Test 1: Submitting while offline fails cleanly without locking buttons
    let isOnline = false;
    Object.defineProperty(win.navigator, 'onLine', {
      configurable: true,
      get: () => isOnline,
    });

    const textarea = document.getElementById('reportCommentInput');
    textarea.value = 'נמצא אי דיוק בניסוח התשובה.';
    document
      .getElementById('reportIssueForm')
      .dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 20));

    const errorBox = document.getElementById('reportErrorBox');
    assert.ok(errorBox, 'Expected offline error box');
    assert.match(errorBox.textContent, /לא מקוון/);
    assert.equal(document.getElementById('reportSubmitBtn').disabled, false);
    assert.equal(document.getElementById('reportCancelBtn').disabled, false);

    // Test 2: Even while online and Firestore write is pending, Cancel remains enabled & closes dialog
    isOnline = true;
    mockFb.sdk.addDoc = () => new Promise(() => {});
    document.getElementById('reportCommentInput').value = 'בדיקת ביטול בזמן שליחה פעילה.';
    document
      .getElementById('reportIssueForm')
      .dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 10));

    const cancelBtn = document.getElementById('reportCancelBtn');
    const submitBtn = document.getElementById('reportSubmitBtn');
    assert.equal(submitBtn.disabled, true, 'Submit button should stay disabled while in-flight');
    assert.equal(cancelBtn.disabled, false, 'Cancel button must NEVER lock the user in the modal');

    cancelBtn.click();
    assert.equal(document.getElementById('reportIssueDialog').hasAttribute('open'), false);
  });

  it('switches to Admin Approved Users tab and approves pending user / adds user', async () => {
    const { win, document, mockFb } = await setupReportEnv(
      {},
      {
        'newstu@example.com': {
          schemaVersion: 2,
          email: 'newstu@example.com',
          active: false,
          status: 'PENDING',
          note: 'שנה ד הדסה',
          displayName: 'נועם',
          addedAt: '2026-11-17T08:00:00.000Z',
          updatedAt: '2026-11-17T08:00:00.000Z',
        },
      }
    );

    mockFb.setUser({
      uid: 'admin_uid_2',
      displayName: 'Benjamin Rotlevy',
      email: 'benjaminrotlevy@gmail.com',
    });
    await new Promise((r) => setTimeout(r, 20));

    document.getElementById('btnAdminReports').click();
    await new Promise((r) => setTimeout(r, 20));

    const adminDialog = document.getElementById('adminReportsDialog');
    adminDialog.querySelector('button[data-admin-tab="users"]').click();
    await new Promise((r) => setTimeout(r, 25));

    assert.match(adminDialog.textContent, /newstu@example\.com/);
    adminDialog.querySelector('button[data-user-action="approve"]').click();
    await new Promise((r) => setTimeout(r, 25));
    assert.equal(mockFb.usersStore.get('newstu@example.com').active, true);
    assert.equal(mockFb.usersStore.get('newstu@example.com').status, 'APPROVED');

    // Add manual user via form
    document.getElementById('adminUserEmailInput').value = 'added@example.com';
    document.getElementById('adminUserNoteInput').value = 'מכללה';
    document
      .getElementById('adminAddUserForm')
      .dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 25));
    assert.equal(mockFb.usersStore.get('added@example.com').active, true);
  });
});
