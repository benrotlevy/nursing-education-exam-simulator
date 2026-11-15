import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, createInitialState } from '../../app/js/core/store.js';
import { createStorageAdapter } from '../../app/js/core/storage.js';
import { createCloudSyncService } from '../../app/js/services/cloud-sync.js';
import { createReportService } from '../../app/js/services/report-service.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

function createFakeReportFirebaseSdk({ initialUser = null, initialReports = [] } = {}) {
  let authCallback = null;
  let reportsSnapshotCb = null;
  const authInstance = { currentUser: initialUser };
  const reportsMap = new Map(initialReports.map((r) => [r.id, { ...r }]));
  let nextId = 1;

  function emitReportsSnapshot() {
    if (!reportsSnapshotCb) return;
    const openDocs = [...reportsMap.entries()]
      .filter(([, data]) => data.status === 'OPEN')
      .map(([id, data]) => ({ id, data: () => ({ ...data }) }));
    reportsSnapshotCb({
      size: openDocs.length,
      docs: openDocs,
    });
  }

  return {
    initializeApp: () => ({ name: 'test-app' }),
    getAuth: () => authInstance,
    getFirestore: () => ({ name: 'test-db' }),
    GoogleAuthProvider: class {
      setCustomParameters() {}
    },
    onAuthStateChanged: (_auth, cb) => {
      authCallback = cb;
      return () => {
        authCallback = null;
      };
    },
    collection: (_db, name) => ({ path: name }),
    doc: (_db, col, id) => ({ path: `${col}/${id}`, id }),
    query: (colRef, ...clauses) => ({ colRef, clauses }),
    where: (field, op, val) => ({ type: 'where', field, op, val }),
    orderBy: (field, dir) => ({ type: 'orderBy', field, dir }),
    limit: (n) => ({ type: 'limit', n }),
    getDoc: async () => ({ exists: () => false, data: () => null }),
    setDoc: async () => {},
    addDoc: async (_colRef, data) => {
      const id = `rpt_${nextId++}`;
      reportsMap.set(id, { ...data });
      emitReportsSnapshot();
      return { id };
    },
    getDocs: async () => {
      const docs = [...reportsMap.entries()].map(([id, data]) => ({
        id,
        data: () => ({ ...data }),
      }));
      return {
        docs,
        forEach: (fn) => docs.forEach(fn),
      };
    },
    updateDoc: async (docRef, patch) => {
      const existing = reportsMap.get(docRef.id);
      if (!existing) throw new Error('Document not found');
      reportsMap.set(docRef.id, { ...existing, ...patch });
      emitReportsSnapshot();
    },
    deleteDoc: async (docRef) => {
      reportsMap.delete(docRef.id);
      emitReportsSnapshot();
    },
    onSnapshot: (target, cb) => {
      if (target?.colRef?.path === 'question_reports') {
        reportsSnapshotCb = cb;
        emitReportsSnapshot();
        return () => {
          reportsSnapshotCb = null;
        };
      }
      return () => {};
    },
    _setUser: async (u) => {
      authInstance.currentUser = u;
      if (authCallback) await authCallback(u);
    },
    _getReportsMap: () => reportsMap,
  };
}

describe('app/js/services/report-service.js — Report Submission, Telegram Dispatch & Admin Lifecycle (RPT-01..RPT-05)', () => {
  const sampleQuestion = {
    id: 'q_101',
    question: 'מהי הפעולה הראשונה הנדרשת בעת חשד לתגובה אנפילקטית?',
    source: 'שחזור 2024',
    category: 'אתיקה, חוק ובטיחות המטופל',
    correctIndex: 0,
  };

  it('requires Google Sign-In before submitting a report [RPT-01]', async () => {
    const fakeSdk = createFakeReportFirebaseSdk({ initialUser: null });
    const cloudSync = createCloudSyncService({
      firebaseSdk: fakeSdk,
      store: createStore(createInitialState()),
      storage: createStorageAdapter({
        localStorage: createMemoryStorage(),
        sessionStorage: createMemoryStorage(),
      }),
    });
    const service = createReportService({ cloudSync });

    const res = await service.submitReport({
      question: sampleQuestion,
      issueType: 'KEY_ERROR',
      comment: 'נדרש בדיקה חוזרת',
    });

    assert.equal(res.ok, false);
    assert.equal(res.requiresAuth, true);
    assert.equal(fakeSdk._getReportsMap().size, 0);
  });

  it('writes report to Firestore and dispatches Telegram webhook when configured [RPT-02]', async () => {
    const student = {
      uid: 'student-1',
      email: 'student@nurse.il',
      displayName: 'דניאל',
    };
    const fakeSdk = createFakeReportFirebaseSdk({ initialUser: student });
    const cloudSync = createCloudSyncService({
      firebaseSdk: fakeSdk,
      store: createStore(createInitialState()),
      storage: createStorageAdapter({
        localStorage: createMemoryStorage(),
        sessionStorage: createMemoryStorage(),
      }),
    });

    const fetchCalls = [];
    const fakeFetch = async (url, init) => {
      fetchCalls.push({ url, init, body: JSON.parse(init.body) });
      return { ok: true, status: 200 };
    };

    const service = createReportService({
      cloudSync,
      webhookUrl: 'https://report-bot.example.workers.dev/report',
      fetchFn: fakeFetch,
    });

    const res = await service.submitReport({
      question: sampleQuestion,
      issueType: 'KEY_ERROR',
      comment: 'תשובה ב נראית נכונה יותר לפי סילבוס 2024',
    });

    assert.equal(res.ok, true);
    assert.equal(res.reportId, 'rpt_1');
    assert.equal(res.webhookSent, true);
    assert.equal(fakeSdk._getReportsMap().size, 1);
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, 'https://report-bot.example.workers.dev/report');
    assert.equal(fetchCalls[0].body.questionId, 'q_101');
    assert.equal(fetchCalls[0].body.reportId, 'rpt_1');
  });

  it('succeeds gracefully even when the Telegram webhook fails or is offline [RPT-02]', async () => {
    const student = { uid: 'student-1', email: 'student@nurse.il', displayName: 'דניאל' };
    const fakeSdk = createFakeReportFirebaseSdk({ initialUser: student });
    const cloudSync = createCloudSyncService({
      firebaseSdk: fakeSdk,
      store: createStore(createInitialState()),
      storage: createStorageAdapter({
        localStorage: createMemoryStorage(),
        sessionStorage: createMemoryStorage(),
      }),
    });

    const failingFetch = async () => {
      throw new Error('Network unreachable');
    };

    const service = createReportService({
      cloudSync,
      webhookUrl: 'https://report-bot.example.workers.dev/report',
      fetchFn: failingFetch,
    });

    const res = await service.submitReport({
      question: sampleQuestion,
      issueType: 'TYPO_TEXT',
      comment: 'שגיאת כתיב במילה הראשונה',
    });

    assert.equal(res.ok, true);
    assert.equal(res.webhookSent, false);
    assert.equal(fakeSdk._getReportsMap().size, 1);
  });

  it('enforces admin check for reading, live count tracking, resolving, and deleting reports [RPT-04, RPT-05]', async () => {
    const admin = {
      uid: 'admin-ben',
      email: 'benjaminrotlevy@gmail.com',
      displayName: 'Benjamin Rotlevy',
    };
    const fakeSdk = createFakeReportFirebaseSdk({
      initialUser: admin,
      initialReports: [
        {
          id: 'rpt_seed_1',
          questionId: 'q_005',
          issueType: 'OUTDATED',
          comment: 'נוהל ישן',
          status: 'OPEN',
          createdAt: '2026-11-14T10:00:00.000Z',
        },
        {
          id: 'rpt_seed_2',
          questionId: 'q_010',
          issueType: 'TYPO_TEXT',
          comment: 'תוקן כבר',
          status: 'RESOLVED',
          createdAt: '2026-11-13T10:00:00.000Z',
        },
      ],
    });
    const cloudSync = createCloudSyncService({
      firebaseSdk: fakeSdk,
      store: createStore(createInitialState()),
      storage: createStorageAdapter({
        localStorage: createMemoryStorage(),
        sessionStorage: createMemoryStorage(),
      }),
    });

    const service = createReportService({ cloudSync, webhookUrl: '' });

    let liveCount = -1;
    await service.subscribeOpenReportsCount((count) => {
      liveCount = count;
    });
    assert.equal(liveCount, 1);

    const allReports = await service.fetchReports();
    assert.equal(allReports.length, 2);

    const resolved = await service.updateReportStatus({
      reportId: 'rpt_seed_1',
      status: 'RESOLVED',
      adminNote: 'עודכן',
    });
    assert.equal(resolved.ok, true);
    assert.equal(liveCount, 0);

    const deleted = await service.deleteReport('rpt_seed_2');
    assert.equal(deleted.ok, true);
    assert.equal(fakeSdk._getReportsMap().size, 1);

    // Non-admin user cannot fetch, update, or delete
    await fakeSdk._setUser({ uid: 'student-9', email: 'other@gmail.com', displayName: 'אורח' });
    assert.deepStrictEqual(await service.fetchReports(), []);
    assert.equal(
      (await service.updateReportStatus({ reportId: 'rpt_seed_1', status: 'OPEN' })).ok,
      false
    );
    assert.equal((await service.deleteReport('rpt_seed_1')).ok, false);
  });
});
