/**
 * Cloudflare Worker: Secret-Safe Telegram Notification Relay for Question Issue Reports
 *
 * Deployment secrets (set via Cloudflare Dashboard -> Worker -> Settings -> Variables & Secrets):
 *   - TELEGRAM_BOT_TOKEN  (Secret) : Bot token from @BotFather
 *   - TELEGRAM_CHAT_ID    (Secret) : Your personal numeric Telegram chat ID
 *   - ALLOWED_ORIGIN      (Plaintext, optional) : Comma-separated allowed origins
 *                         (e.g. "https://benjaminrotlevy.github.io,http://127.0.0.1:4173")
 */

const MAX_FIELD_LEN = Object.freeze({
  questionId: 64,
  issueLabel: 120,
  category: 120,
  source: 120,
  comment: 1000,
  questionPreview: 220,
  reporterName: 100,
  reporterEmail: 120,
  reportId: 128,
});

function escapeTelegramHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function clampField(value, maxLen) {
  const clean = typeof value === 'string' ? value.trim() : '';
  return clean.length > maxLen ? `${clean.slice(0, maxLen - 1)}…` : clean;
}

function buildCorsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowedRaw = typeof env.ALLOWED_ORIGIN === 'string' ? env.ALLOWED_ORIGIN.trim() : '';
  let allowOriginHeader = '*';

  if (allowedRaw) {
    const allowedList = allowedRaw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    allowOriginHeader = allowedList.includes(origin) ? origin : allowedList[0] || '';
  }

  return {
    'Access-Control-Allow-Origin': allowOriginHeader,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function isOriginPermitted(request, env) {
  const allowedRaw = typeof env.ALLOWED_ORIGIN === 'string' ? env.ALLOWED_ORIGIN.trim() : '';
  if (!allowedRaw) return true;

  const origin = request.headers.get('Origin') || '';
  if (!origin) return false;

  const allowedList = allowedRaw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return allowedList.includes(origin);
}

function formatTelegramMessage(body) {
  const questionId = escapeTelegramHtml(clampField(body.questionId, MAX_FIELD_LEN.questionId));
  const issueLabel = escapeTelegramHtml(
    clampField(body.issueLabel || body.issueType || 'Other', MAX_FIELD_LEN.issueLabel)
  );
  const category = escapeTelegramHtml(clampField(body.category || '-', MAX_FIELD_LEN.category));
  const source = escapeTelegramHtml(clampField(body.source || '-', MAX_FIELD_LEN.source));
  const comment = escapeTelegramHtml(clampField(body.comment, MAX_FIELD_LEN.comment));
  const questionPreview = escapeTelegramHtml(
    clampField(body.questionPreview || '', MAX_FIELD_LEN.questionPreview)
  );
  const reporterName = escapeTelegramHtml(
    clampField(body.reporterName || 'Student', MAX_FIELD_LEN.reporterName)
  );
  const reporterEmail = escapeTelegramHtml(
    clampField(body.reporterEmail || '', MAX_FIELD_LEN.reporterEmail)
  );
  const reportId = escapeTelegramHtml(clampField(body.reportId || '', MAX_FIELD_LEN.reportId));

  const lines = [
    '🚩 <b>דיווח חדש על טעות בשאלה</b>',
    '',
    `<b>מזהה שאלה:</b> <code>${questionId}</code>`,
    `<b>סוג שגיאה:</b> ${issueLabel}`,
    `<b>קטגוריה:</b> ${category}`,
    `<b>מקור:</b> ${source}`,
    '',
    `<b>הערת הסטודנט:</b>\n${comment}`,
  ];

  if (questionPreview) {
    lines.push('', `<b>נוסח השאלה:</b> ${questionPreview}`);
  }

  lines.push('', `<b>מדווח/ת:</b> ${reporterName}${reporterEmail ? ` (${reporterEmail})` : ''}`);

  if (reportId) {
    lines.push(`<b>מספר דיווח (Firestore):</b> <code>${reportId}</code>`);
  }

  return lines.join('\n');
}

export default {
  async fetch(request, env) {
    const corsHeaders = buildCorsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'Method Not Allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!isOriginPermitted(request, env)) {
      return new Response(JSON.stringify({ ok: false, error: 'Forbidden Origin' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      return new Response(JSON.stringify({ ok: false, error: 'Worker secrets not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (
      !payload ||
      payload.type !== 'QUESTION_ISSUE_REPORT' ||
      typeof payload.questionId !== 'string' ||
      !payload.questionId.trim() ||
      typeof payload.comment !== 'string' ||
      payload.comment.trim().length < 3
    ) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid report payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const telegramEndpoint = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const telegramResponse = await fetch(telegramEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: formatTelegramMessage(payload),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!telegramResponse.ok) {
      return new Response(JSON.stringify({ ok: false, error: 'Upstream Telegram API error' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  },
};
