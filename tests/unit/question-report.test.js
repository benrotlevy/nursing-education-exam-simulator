import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isAdminUser,
  getIssueTypeMeta,
  validateReportDraft,
  buildQuestionReportPayload,
  formatTelegramAlertPayload,
  countReportsByStatus,
  filterReportsByStatus,
  formatReportForAdminClipboard,
} from '../../app/js/domain/question-report.js';
import { REPORT_LIMITS, REPORT_STATUSES, SCHEMA_VERSION } from '../../app/js/config.js';
import telegramWorker from '../../tools/cloudflare-worker-telegram.js';

describe('app/js/domain/question-report.js — Pure Report Validation & Admin Helpers (RPT-01..RPT-03)', () => {
  const sampleUser = {
    uid: 'user-123',
    email: 'nurse@hospital.org.il',
    displayName: 'ד״ר מיכל לוי',
  };

  const sampleQuestion = {
    id: 'q_042',
    question: 'מהי ההתערבות הראשונה המומלצת למניעת טעויות בתרופות בקליניקה?',
    source: 'שחזור מבחן ממשלתי 2023',
    category: 'אתיקה, חוק ובטיחות המטופל',
    options: ['תשובה א', 'תשובה ב', 'תשובה ג', 'תשובה ד'],
    correctIndex: 1,
  };

  it('authorizes only configured admin emails regardless of whitespace/casing', () => {
    assert.equal(isAdminUser({ uid: '1', email: 'benjaminrotlevy@gmail.com' }), true);
    assert.equal(isAdminUser({ uid: '2', email: '  BENJAMIN@ROTLEVY.COM  ' }), true);
    assert.equal(isAdminUser({ uid: '3', email: 'student@gmail.com' }), false);
    assert.equal(isAdminUser({ uid: '4', email: '' }), false);
    assert.equal(isAdminUser(null), false);
    assert.equal(isAdminUser(undefined), false);
  });

  it('rejects unauthenticated users when validating report drafts', () => {
    const res = validateReportDraft({
      questionId: 'q_042',
      issueType: 'KEY_ERROR',
      comment: 'התשובה הנכונה היא א ולא ב',
      user: null,
    });
    assert.equal(res.ok, false);
    assert.equal(res.field, 'auth');
  });

  it('validates questionId, issueType, and comment length boundaries [3..1000]', () => {
    assert.equal(
      validateReportDraft({
        questionId: '',
        issueType: 'KEY_ERROR',
        comment: 'הערה תקינה',
        user: sampleUser,
      }).field,
      'questionId'
    );

    assert.equal(
      validateReportDraft({
        questionId: 'q_042',
        issueType: 'NOT_A_REAL_TYPE',
        comment: 'הערה תקינה',
        user: sampleUser,
      }).field,
      'issueType'
    );

    assert.equal(
      validateReportDraft({
        questionId: 'q_042',
        issueType: 'TYPO_TEXT',
        comment: '  אב  ', // 2 chars after trim < MIN_COMMENT_LENGTH (3)
        user: sampleUser,
      }).field,
      'comment'
    );

    const tooLong = 'א'.repeat(REPORT_LIMITS.MAX_COMMENT_LENGTH + 1);
    assert.equal(
      validateReportDraft({
        questionId: 'q_042',
        issueType: 'TYPO_TEXT',
        comment: tooLong,
        user: sampleUser,
      }).field,
      'comment'
    );

    const exactMax = 'א'.repeat(REPORT_LIMITS.MAX_COMMENT_LENGTH);
    const validRes = validateReportDraft({
      questionId: ' q_042 ',
      issueType: 'KEY_ERROR',
      comment: `  ${exactMax}  `,
      user: sampleUser,
    });
    assert.equal(validRes.ok, true);
    assert.equal(validRes.normalized.questionId, 'q_042');
    assert.equal(validRes.normalized.comment.length, REPORT_LIMITS.MAX_COMMENT_LENGTH);
  });

  it('builds a Firestore-compliant OPEN report payload and truncates questionText preview', () => {
    const longQuestion = 'מ'.repeat(300);
    const fixedDate = new Date('2026-11-15T10:00:00.000Z');

    const payload = buildQuestionReportPayload({
      question: { ...sampleQuestion, question: longQuestion },
      issueType: 'EXPLANATION_ERROR',
      comment: 'ההסבר מציין מסיח ב אבל מתייחס לג׳',
      user: sampleUser,
      now: fixedDate,
    });

    assert.equal(payload.schemaVersion, SCHEMA_VERSION);
    assert.equal(payload.questionId, 'q_042');
    assert.equal(payload.questionText.length, REPORT_LIMITS.MAX_PREVIEW_LENGTH);
    assert.equal(payload.issueType, 'EXPLANATION_ERROR');
    assert.equal(payload.status, REPORT_STATUSES.OPEN);
    assert.equal(payload.reporterUid, 'user-123');
    assert.equal(payload.reporterEmail, 'nurse@hospital.org.il');
    assert.equal(payload.reporterName, 'ד״ר מיכל לוי');
    assert.equal(payload.correctIndex, 1);
    assert.equal(payload.createdAt, '2026-11-15T10:00:00.000Z');
    assert.equal(payload.updatedAt, '2026-11-15T10:00:00.000Z');
  });

  it('formats Telegram webhook alert payload safely', () => {
    const report = buildQuestionReportPayload({
      question: sampleQuestion,
      issueType: 'KEY_ERROR',
      comment: 'לפי סילבוס 2025 תשובה ג׳ נכונה',
      user: sampleUser,
      now: new Date('2026-11-15T10:00:00.000Z'),
    });

    const alert = formatTelegramAlertPayload(report, 'rpt_999');
    assert.equal(alert.type, 'QUESTION_ISSUE_REPORT');
    assert.equal(alert.reportId, 'rpt_999');
    assert.equal(alert.questionId, 'q_042');
    assert.equal(alert.questionPreview, sampleQuestion.question);
    assert.ok(alert.issueLabel.includes(getIssueTypeMeta('KEY_ERROR').label));
    assert.equal(alert.comment, 'לפי סילבוס 2025 תשובה ג׳ נכונה');
  });

  it('produces a Telegram payload accepted by the Cloudflare Worker contract', async () => {
    const report = buildQuestionReportPayload({
      question: sampleQuestion,
      issueType: 'TYPO_TEXT',
      comment: 'ניסוח קטוע <test>',
      user: sampleUser,
    });
    const alert = formatTelegramAlertPayload(report, 'rpt_worker_1');

    const originalFetch = globalThis.fetch;
    const sentBodies = [];
    globalThis.fetch = async (_url, init) => {
      sentBodies.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    try {
      const req = new Request('https://example.workers.dev/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://127.0.0.1:4173',
        },
        body: JSON.stringify(alert),
      });
      const res = await telegramWorker.fetch(req, {
        TELEGRAM_BOT_TOKEN: 'bot-token',
        TELEGRAM_CHAT_ID: '12345',
        ALLOWED_ORIGIN: 'https://benjaminrotlevy.github.io,http://127.0.0.1:4173',
      });
      assert.equal(res.status, 200);
      assert.equal(sentBodies.length, 1);
      assert.ok(sentBodies[0].text.includes('q_042'));
      assert.ok(sentBodies[0].text.includes(sampleQuestion.question));
      assert.ok(sentBodies[0].text.includes('&lt;test&gt;'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('counts, filters, sorts reports newest-first, and formats clipboard export', () => {
    const reports = [
      { id: 'r1', status: 'RESOLVED', createdAt: '2026-11-10T08:00:00.000Z', comment: 'טופל' },
      { id: 'r2', status: 'OPEN', createdAt: '2026-11-12T08:00:00.000Z', comment: 'ישן יותר' },
      { id: 'r3', status: 'OPEN', createdAt: '2026-11-14T08:00:00.000Z', comment: 'חדש ביותר' },
      { id: 'r4', status: 'DISMISSED', createdAt: '2026-11-11T08:00:00.000Z', comment: 'נדחה' },
    ];

    const counts = countReportsByStatus(reports);
    assert.deepStrictEqual(counts, { total: 4, OPEN: 2, RESOLVED: 1, DISMISSED: 1 });

    const openSorted = filterReportsByStatus(reports, 'OPEN');
    assert.deepStrictEqual(
      openSorted.map((r) => r.id),
      ['r3', 'r2']
    );

    const allSorted = filterReportsByStatus(reports, 'ALL');
    assert.deepStrictEqual(
      allSorted.map((r) => r.id),
      ['r3', 'r2', 'r4', 'r1']
    );

    const text = formatReportForAdminClipboard(
      {
        questionId: 'q_042',
        issueType: 'KEY_ERROR',
        comment: 'בדקו תשובה ב',
        reporterName: 'סטודנטית',
        reporterEmail: 's@test.com',
      },
      sampleQuestion
    );
    assert.ok(text.includes('q_042'));
    assert.ok(text.includes('ב. תשובה ב [✓ נכונה נוכחית]'));
    assert.ok(text.includes('בדקו תשובה ב'));
  });
});
