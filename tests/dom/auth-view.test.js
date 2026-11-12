import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import { sanitizeAvatarUrl, renderAuthUI } from '../../app/js/features/auth/auth-view.js';
import { DEFAULT_AVATAR_URL } from '../../app/js/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

describe('app/js/features/auth/auth-view.js & firestore.rules — Auth UI Security & Rules (SEC-01..SEC-03)', () => {
  it('validates avatar URLs strictly for https: protocol and rejects javascript:/http:/malformed URLs [SEC-02]', () => {
    assert.equal(
      sanitizeAvatarUrl('https://lh3.googleusercontent.com/a/default-user=s96-c'),
      'https://lh3.googleusercontent.com/a/default-user=s96-c'
    );
    assert.equal(sanitizeAvatarUrl('javascript:alert(1)'), DEFAULT_AVATAR_URL);
    assert.equal(sanitizeAvatarUrl('data:text/html,<script>alert(1)</script>'), DEFAULT_AVATAR_URL);
    assert.equal(sanitizeAvatarUrl('http://insecure.example.com/avatar.png'), DEFAULT_AVATAR_URL);
    assert.equal(sanitizeAvatarUrl(''), DEFAULT_AVATAR_URL);
    assert.equal(sanitizeAvatarUrl(null), DEFAULT_AVATAR_URL);
  });

  it('escapes untrusted displayName/email in #statsCloudSyncInfo and removes inline scripts from app/index.html [SEC-01, SEC-02]', () => {
    const htmlContent = fs.readFileSync(path.join(ROOT_DIR, 'app/index.html'), 'utf8');
    // Verify app/index.html has zero inline <script> blocks (only external src="./js/main.js")
    const scriptTags = htmlContent.match(/<script\b[^>]*>/gi) || [];
    assert.equal(scriptTags.length, 1, 'Expected exactly 1 <script> tag in app/index.html');
    assert.ok(
      scriptTags[0].includes('src="./js/main.js"'),
      'Expected the sole <script> tag to load ./js/main.js'
    );

    const win = new Window();
    win.document.write(htmlContent);

    renderAuthUI({
      document: win.document,
      user: {
        uid: 'u1',
        displayName: '<img src=x onerror=alert("xss")>',
        email: 'nurse@example.com',
        photoURL: 'javascript:alert(1)',
      },
    });

    const statsCloudBadge = win.document.getElementById('statsCloudSyncInfo');
    assert.equal(statsCloudBadge.querySelectorAll('img').length, 0);
    assert.ok(statsCloudBadge.innerHTML.includes('&lt;img src=x onerror=alert('));
    assert.ok(statsCloudBadge.textContent.includes('<img src=x onerror=alert("xss")>'));

    const avatarEl = win.document.getElementById('userAvatar');
    assert.equal(avatarEl.getAttribute('src'), DEFAULT_AVATAR_URL);
  });

  it('renders Google brand and displayLabel inside isolated <bdi> elements to prevent RTL BiDi inversion', () => {
    const htmlContent = fs.readFileSync(path.join(ROOT_DIR, 'app/index.html'), 'utf8');
    const win = new Window();
    win.document.write(htmlContent);

    renderAuthUI({
      document: win.document,
      user: {
        uid: 'u2',
        displayName: 'Benjamin Rotlevy',
        email: 'benjamin@example.com',
      },
    });

    const statsCloudBadge = win.document.getElementById('statsCloudSyncInfo');
    const titleSpan = statsCloudBadge.querySelector('.cloud-sync-active-title');
    assert.ok(titleSpan, 'Expected .cloud-sync-active-title element');
    assert.equal(titleSpan.querySelector('bdi')?.textContent, 'Google');
    assert.ok(titleSpan.textContent.includes('מחובר לחשבון'));
    assert.ok(titleSpan.textContent.includes(':'));

    const nameBdi = statsCloudBadge.querySelector('.user-display-name');
    assert.ok(nameBdi, 'Expected .user-display-name <bdi> element');
    assert.equal(nameBdi.textContent, 'Benjamin Rotlevy');
  });

  it('enforces least-privilege owner isolation and schema validation in firestore.rules [SEC-03]', () => {
    const rulesPath = path.join(ROOT_DIR, 'firestore.rules');
    assert.ok(fs.existsSync(rulesPath), 'Expected firestore.rules to exist at repository root');
    const rules = fs.readFileSync(rulesPath, 'utf8');

    assert.ok(rules.includes("rules_version = '2';"));
    assert.ok(rules.includes('match /users/{userId}'));
    assert.ok(rules.includes('request.auth != null'));
    assert.ok(rules.includes('request.auth.uid == userId'));
    assert.ok(rules.includes('allow delete: if false;'));
    assert.ok(rules.includes('match /{document=**}'));
    assert.ok(rules.includes('allow read, write: if false;'));
  });
});
