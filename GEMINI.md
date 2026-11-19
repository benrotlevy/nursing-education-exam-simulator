# Repository Rules & Pre-Release Quality Gates

Follow [`docs/standards/08-TESTING-STRATEGY.md`](docs/standards/08-TESTING-STRATEGY.md) and [`docs/standards/12-DEFINITION-OF-DONE.md`](docs/standards/12-DEFINITION-OF-DONE.md) alongside these mandatory pre-release gates on every change in this repository:

## 1. Async Latency & No-Bad-Flash Gate
- Never rely solely on `0ms` synchronous mocks for authentication, Firestore reads, or catalog decryption in E2E tests.
- Maintain realistic async latency (`authDelayMs >= 25`) and attach a `MutationObserver` on `#demoModeBanner`, `#appGlobalToast`, and `#syncStatusIndicator` across login/role transitions (`Guest -> Admin`, `Guest -> Approved`, `Pending -> Approved`) asserting zero transient flashes of `"ממתין לאישור"` or `is-pending`.

## 2. Role x Tab Control Matrix & Visual Disabled Gate
- Verify every access mode (`Guest`, `Pending`, `Revoked`, `Approved`, `Admin`) across all 4 tabs (`Exam`, `Study`, `Saved Exams`, `Stats`).
- Never treat `toBeDisabled()` alone as sufficient: confirm disabled interactive controls render muted visual styling (`pointer-events: none`, `:disabled` CSS in `app/styles/components/buttons.css` and `app/styles/components/forms.css`).

## 3. Abuse, Double-Submit Cooldown & Sign-Out Zero-Residue Gate
- Every external side-effect button (e.g., Telegram requests, Firestore writes) must have an automated repeat-click / reload cooldown test asserting duplicate requests are blocked (e.g., 10-minute cooldown on access requests; no duplicate `NEW_USER_SIGN_IN` when server records exist).
- Cross-user state changes (Admin approval / revocation) must verify automatic real-time UI updates via `onSnapshot` without clicking manual refresh/recheck buttons.
- Sign-Out tests must verify both dirty sign-out warnings (`#appModalDialog` when offline/unsynced/mid-exam) and zero-residue cleanup (`localStorage`, `sessionStorage`, and `store` reset on confirm).

## 4. Pre-Interaction Counter, Multi-Admin Parity & Copy Audit Gate
- Assert badge and tab counters immediately when a view or dialog opens before switching sub-tabs.
- Iterate over every entry in config lists like `ADMIN_EMAILS` (`app/js/config.js`) in tests to ensure identical card rendering and display-name tags for every admin.
- Whenever a component's scope changes, audit trigger button labels, modal headings, and fallback message copy side-by-side.

## 5. Full-Stack Verification & CLI Deployment Gate
- Run `npm run format`, `npm run verify`, and `npx playwright test --reporter=list` before pushing a release.
- Whenever `firestore.rules` is modified, run `npm run deploy:rules` (after explicit confirmation / rule compliance).
- Whenever `tools/cloudflare-worker-telegram.js` is modified, run `npm run deploy:worker` alongside pushing client updates so production backend and frontend never drift.
