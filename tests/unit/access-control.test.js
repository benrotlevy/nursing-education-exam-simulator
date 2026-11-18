import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACCESS_STATUSES } from '../../app/js/config.js';
import {
  buildAllowedUserPayload,
  buildNewUserTelegramPayloads,
  buildPendingAccessRequestPayload,
  countAllowedUsersByStatus,
  evaluateAccessRequestCooldown,
  evaluateUserAccessState,
  filterAllowedUsers,
  isValidEmailAddress,
  normalizeEmail,
  normalizeTelegramChatUrl,
} from '../../app/js/domain/access-control.js';

describe('app/js/domain/access-control.js — Invite-Only Domain Rules', () => {
  it('normalizes and validates email addresses and Telegram URLs safely', () => {
    assert.equal(normalizeEmail('  Nurse.Student@Gmail.COM '), 'nurse.student@gmail.com');
    assert.equal(isValidEmailAddress('nurse@hospital.org.il'), true);
    assert.equal(isValidEmailAddress('not-an-email'), false);
    assert.equal(isValidEmailAddress(''), false);

    assert.equal(normalizeTelegramChatUrl('@benjamin_rot'), 'https://t.me/benjamin_rot');
    assert.equal(normalizeTelegramChatUrl('t.me/benjamin_rot'), 'https://t.me/benjamin_rot');
    assert.equal(
      normalizeTelegramChatUrl('https://t.me/benjamin_rot'),
      'https://t.me/benjamin_rot'
    );
    assert.equal(normalizeTelegramChatUrl('javascript:alert(1)'), '');
    assert.equal(normalizeTelegramChatUrl('https://evil.example.com'), '');
  });

  it('builds valid APPROVED and self-PENDING allowlist payloads', () => {
    const adminDoc = buildAllowedUserPayload({
      email: 'Student@Example.com',
      active: true,
      note: 'הדסה שנה ד׳',
      addedBy: 'Admin@Example.com',
      now: new Date('2026-11-17T08:00:00.000Z'),
    });
    assert.equal(adminDoc.email, 'student@example.com');
    assert.equal(adminDoc.active, true);
    assert.equal(adminDoc.status, 'APPROVED');
    assert.equal(adminDoc.note, 'הדסה שנה ד׳');
    assert.equal(adminDoc.addedBy, 'admin@example.com');

    const pendingDoc = buildPendingAccessRequestPayload({
      user: { uid: 'u1', email: 'New@Nursing.AC.IL', displayName: 'תמר' },
      note: 'אשמח לאישור',
      now: new Date('2026-11-17T08:00:00.000Z'),
    });
    assert.equal(pendingDoc.email, 'new@nursing.ac.il');
    assert.equal(pendingDoc.active, false);
    assert.equal(pendingDoc.status, 'PENDING');
    assert.equal(pendingDoc.addedBy, 'new@nursing.ac.il');
  });

  it('evaluates online access, offline PWA cached approval, and revocation cleanly', () => {
    const user = { uid: 'u1', email: 'student@hospital.org.il' };

    // Admin bypass
    assert.equal(
      evaluateUserAccessState({
        user: { uid: 'admin1', email: 'benjaminrotlevy@gmail.com' },
        isAdmin: true,
        keyBase64: 'KEY_ADMIN',
      }).status,
      ACCESS_STATUSES.APPROVED
    );

    // Online approved
    const onlineApproved = evaluateUserAccessState({
      user,
      allowedDoc: { active: true, status: 'APPROVED' },
      keyBase64: 'KEY_123',
      telegramUrl: 'https://t.me/admin_chat',
    });
    assert.equal(onlineApproved.status, ACCESS_STATUSES.APPROVED);
    assert.equal(onlineApproved.approved, true);
    assert.equal(onlineApproved.keyBase64, 'KEY_123');
    assert.equal(onlineApproved.telegramUrl, 'https://t.me/admin_chat');

    // Offline cache hit for matching user
    const offlineCached = evaluateUserAccessState({
      user,
      isOffline: true,
      lookupFailed: true,
      cachedApproval: {
        uid: 'u1',
        email: 'student@hospital.org.il',
        approved: true,
        keyBase64: 'KEY_CACHED',
      },
    });
    assert.equal(offlineCached.approved, true);
    assert.equal(offlineCached.fromCache, true);
    assert.equal(offlineCached.keyBase64, 'KEY_CACHED');

    // Cache mismatch for another email must NEVER unlock
    const mismatchOffline = evaluateUserAccessState({
      user: { uid: 'u2', email: 'stranger@hospital.org.il' },
      isOffline: true,
      lookupFailed: true,
      cachedApproval: {
        uid: 'u1',
        email: 'student@hospital.org.il',
        approved: true,
        keyBase64: 'KEY_CACHED',
      },
    });
    assert.equal(mismatchOffline.approved, false);
    assert.equal(mismatchOffline.status, ACCESS_STATUSES.PENDING);

    // Online explicit REVOKED doc overrides stale cache
    const revoked = evaluateUserAccessState({
      user,
      allowedDoc: { active: false, status: 'REVOKED' },
      cachedApproval: {
        uid: 'u1',
        email: 'student@hospital.org.il',
        approved: true,
        keyBase64: 'KEY_CACHED',
      },
    });
    assert.equal(revoked.approved, false);
    assert.equal(revoked.status, ACCESS_STATUSES.REVOKED);
  });

  it('builds Telegram payloads and filters/counts users with PENDING priority', () => {
    const { modernPayload, compatiblePayload } = buildNewUserTelegramPayloads({
      user: { uid: 'u9', email: 'Sara@Test.org', displayName: 'שרה כהן' },
      note: 'קורס הדרכה 2026',
      isExplicitRequest: true,
    });
    assert.equal(modernPayload.type, 'NEW_USER_SIGN_IN');
    assert.equal(modernPayload.email, 'sara@test.org');
    assert.equal(compatiblePayload.type, 'QUESTION_ISSUE_REPORT');
    assert.ok(compatiblePayload.comment.includes('sara@test.org'));
    assert.ok(!compatiblePayload.comment.includes('לחיצה ארוכה/קצרה'));
    assert.ok(compatiblePayload.comment.includes('לאישור בלחיצה אחת'));

    // Cooldown logic: initial sign-in doc (addedAt === updatedAt) allows first explicit request
    const t0 = Date.parse('2026-11-19T00:00:00.000Z');
    assert.equal(
      evaluateAccessRequestCooldown({
        allowedDoc: {
          addedAt: '2026-11-19T00:00:00.000Z',
          updatedAt: '2026-11-19T00:00:00.000Z',
        },
        nowMs: t0 + 5000,
      }).inCooldown,
      false
    );

    // Explicit request (updatedAt > addedAt) locks for 10 minutes
    const activeCooldown = evaluateAccessRequestCooldown({
      allowedDoc: {
        addedAt: '2026-11-19T00:00:00.000Z',
        updatedAt: '2026-11-19T00:01:00.000Z',
      },
      nowMs: Date.parse('2026-11-19T00:03:00.000Z'),
    });
    assert.equal(activeCooldown.inCooldown, true);
    assert.equal(activeCooldown.remainingMinutes, 8);

    // Local timestamp alone also enforces 10-minute cooldown, and clears after 10 minutes
    assert.equal(
      evaluateAccessRequestCooldown({
        lastLocalRequestAt: t0,
        nowMs: t0 + 9 * 60 * 1000,
      }).inCooldown,
      true
    );
    assert.equal(
      evaluateAccessRequestCooldown({
        allowedDoc: {
          addedAt: '2026-11-19T00:00:00.000Z',
          updatedAt: '2026-11-19T00:01:00.000Z',
        },
        lastLocalRequestAt: Date.parse('2026-11-19T00:01:00.000Z'),
        nowMs: Date.parse('2026-11-19T00:11:00.000Z'),
      }).inCooldown,
      false
    );

    const sampleUsers = [
      { email: 'a@x.com', active: true, status: 'APPROVED', updatedAt: '2026-11-17T09:00:00Z' },
      { email: 'b@x.com', active: false, status: 'PENDING', updatedAt: '2026-11-17T08:00:00Z' },
      { email: 'c@x.com', active: false, status: 'REVOKED', updatedAt: '2026-11-17T07:00:00Z' },
    ];
    assert.deepStrictEqual(countAllowedUsersByStatus(sampleUsers), {
      total: 3,
      PENDING: 1,
      APPROVED: 1,
      REVOKED: 1,
    });

    const sortedAll = filterAllowedUsers(sampleUsers, 'ALL', '');
    assert.deepStrictEqual(
      sortedAll.map((u) => u.email),
      ['b@x.com', 'a@x.com', 'c@x.com']
    );
    assert.equal(filterAllowedUsers(sampleUsers, 'PENDING', 'b@x').length, 1);
  });
});
