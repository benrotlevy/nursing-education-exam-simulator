import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../tools/cloudflare-worker-telegram.js';

const ORIGINAL_FETCH = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

function createEnv(overrides = {}) {
  return {
    TELEGRAM_BOT_TOKEN: '123456:TEST_TOKEN',
    TELEGRAM_CHAT_ID: '987654321',
    ALLOWED_ORIGIN: 'https://benrotlevy.github.io,http://127.0.0.1:4173',
    ...overrides,
  };
}

describe('tools/cloudflare-worker-telegram.js — Telegram Push Relay', () => {
  it('handles CORS preflight OPTIONS, rejects disallowed origins (403) and non-POST methods (405)', async () => {
    const env = createEnv();

    const optRes = await worker.fetch(
      new Request('https://worker.example.com/', {
        method: 'OPTIONS',
        headers: { Origin: 'https://benrotlevy.github.io' },
      }),
      env
    );
    assert.equal(optRes.status, 204);
    assert.equal(optRes.headers.get('Access-Control-Allow-Origin'), 'https://benrotlevy.github.io');

    const getRes = await worker.fetch(
      new Request('https://worker.example.com/', { method: 'GET' }),
      env
    );
    assert.equal(getRes.status, 405);

    const badOriginRes = await worker.fetch(
      new Request('https://worker.example.com/', {
        method: 'POST',
        headers: { Origin: 'https://evil.example.com', 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'NEW_USER_SIGN_IN', email: 'a@b.com' }),
      }),
      env
    );
    assert.equal(badOriginRes.status, 403);
  });

  it('formats NEW_USER_SIGN_IN notifications with <code> email and escapes untrusted HTML', async () => {
    const sentMessages = [];
    globalThis.fetch = async (url, init) => {
      sentMessages.push({ url, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const res = await worker.fetch(
      new Request('https://worker.example.com/', {
        method: 'POST',
        headers: {
          Origin: 'https://benrotlevy.github.io',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'NEW_USER_SIGN_IN',
          email: 'student@nursing.ac.il',
          displayName: 'נועה <script>xss</script>',
          note: 'שנה ד <הדסה>',
          isExplicitRequest: true,
          status: 'PENDING',
        }),
      }),
      createEnv()
    );

    assert.equal(res.status, 200);
    assert.equal(sentMessages.length, 1);
    const telegramBody = sentMessages[0].body;
    assert.equal(telegramBody.parse_mode, 'HTML');
    assert.match(telegramBody.text, /<code>student@nursing\.ac\.il<\/code>/);
    assert.equal(telegramBody.text.includes('<script>'), false);
    assert.ok(telegramBody.text.includes('&lt;script&gt;xss&lt;/script&gt;'));
    assert.ok(telegramBody.text.includes('&lt;הדסה&gt;'));
  });

  it('formats QUESTION_ISSUE_REPORT alerts and validates required fields (400)', async () => {
    const sentMessages = [];
    globalThis.fetch = async (url, init) => {
      sentMessages.push({ url, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const badRes = await worker.fetch(
      new Request('https://worker.example.com/', {
        method: 'POST',
        headers: {
          Origin: 'https://benrotlevy.github.io',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'UNKNOWN', email: '' }),
      }),
      createEnv()
    );
    assert.equal(badRes.status, 400);

    const reportRes = await worker.fetch(
      new Request('https://worker.example.com/', {
        method: 'POST',
        headers: {
          Origin: 'https://benrotlevy.github.io',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'QUESTION_ISSUE_REPORT',
          questionId: 'q_101',
          issueLabel: '🎯 תשובה שגויה',
          category: 'אתיקה',
          source: 'מבחן 2024',
          comment: 'התשובה הנכונה היא ב.',
          reporterName: 'שרה',
          reporterEmail: 'sara@example.com',
        }),
      }),
      createEnv()
    );
    assert.equal(reportRes.status, 200);
    assert.equal(sentMessages.length, 1);
    assert.ok(sentMessages[0].body.text.includes('<code>q_101</code>'));
  });
});
