# Future Features Roadmap

This document outlines planned future enhancements for the **Clinical Preceptorship Nursing Exam Simulator** (`nursing-education-exam-simulator`). All designs adhere to the project's core architectural principles: **Pure Vanilla ES2022+ Modules** (no bundler), **GitHub Pages static hosting (`app/`)**, **Firebase Auth & Firestore**, and strict **Content-Security-Policy (CSP)** / **`firestore.rules`** security boundaries.

---

## 1. Question Issue Reporting, Admin Dashboard & Telegram Push Notifications

### Overview

Allow students to report errors in specific questions (wrong answer key, typo, outdated guideline, or unclear explanation) directly from **Study Mode**, **Exam Mode**, and **Exam Results Review**, while giving the administrator (Ben) both an in-app review dashboard and instant mobile alerts.

### User Flow

- Add a discrete **`🚩 דיווח על שאלה`** button in:
  - Study Mode question header / explanation box (`app/js/features/study/study-view.js`)
  - Exam Mode question header (`app/js/features/exam/exam-view.js`)
  - Exam Results review cards (`#examReviewList`)
- Clicking opens an accessible `<dialog>` modal (`app/js/features/report-issue/report-dialog.js`) containing:
  - Auto-filled question metadata (`questionId`, `source`, `category`).
  - Issue category selector:
    - `KEY_ERROR` — תשובה נכונה שגויה במפתח התשובות
    - `EXPLANATION_ERROR` — טעות בהסבר הפדגוגי או בניתוח המסיחים
    - `TYPO_TEXT` — שגיאת כתיב, ניסוח מקוטע או טקסט חסר
    - `OUTDATED` — חומר / נוהל לא מעודכן
    - `OTHER` — אחר
  - Free-text comment field (max `1000` characters) with live character counter.
  - Reporter identity (auto-filled from Google Sign-In if authenticated, or optional/anonymous).

### Data Model & Firestore Security (`firestore.rules`)

Reports are stored in `/question_reports/{reportId}`:

- `questionId`, `questionText` (truncated preview), `source`, `category`, `issueType`, `comment`, `reporterEmail`, `reporterUid`, `status` (`"OPEN"` | `"RESOLVED"` | `"DISMISSED"`), `createdAt`, `resolvedAt`.
- **Security Rules**:
  - `allow create`: Permitted with strict schema validation (`hasOnlyAllowedFields`, length bounds, `status == 'OPEN'`).
  - `allow read, update, delete`: Strictly restricted to verified administrator (`isAdmin()` checking `request.auth != null && request.auth.token.email_verified == true && request.auth.token.email == 'benjamin@rotlevy.com'`).

### In-App Admin Dashboard

- Only rendered in the UI after Firebase Auth confirms the signed-in user matches the admin email/UID.
- Displays a live badge **`🚩 דיווחים (N)`** for unresolved (`OPEN`) reports.
- Clicking opens an admin panel where the owner can inspect the question details, copy `questionId` for quick editing in `questions.json`, and click **Mark as Resolved** or **Dismiss**.

### Secret-Safe Instant Telegram Push Notifications

Because the web app is hosted statically on GitHub Pages, **no Telegram Bot Token may ever be placed in client-side JS**.

- **Architecture**: Deploy a lightweight (~15-line) **Cloudflare Worker** (free tier: 100k req/day) holding `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` as encrypted server-side environment secrets.
- **Flow**:
  1. Client saves the report to Firestore `/question_reports`.
  2. Client sends a non-blocking `POST` request with report summary to the Cloudflare Worker endpoint (whitelisted in `app/index.html` CSP `connect-src`).
  3. Worker validates the request origin/payload and forwards a formatted Hebrew alert to Ben's private Telegram chat.

---

## 2. Progressive Web App (PWA) — Installable from Chrome

### Overview

Make the simulator installable directly from Chrome on Android, Windows, macOS, and iOS ("Install App" / "התקן אפליקציה" / "Add to Home Screen"), enabling standalone full-screen launch, home-screen icon, and reliable offline caching.

### Implementation Components

1. **Web App Manifest (`app/manifest.webmanifest`)**:
   - `name`: `"סימולטור מבחן הדרכה קלינית בסיעוד"`
   - `short_name`: `"הדרכה קלינית"`
   - `start_url`: `"./"`
   - `scope`: `"./"`
   - `display`: `"standalone"`
   - `dir`: `"rtl"`
   - `lang`: `"he"`
   - `theme_color` & `background_color` matching `app/styles/tokens.css`.
   - App icons: `192x192` and `512x512` PNGs (including `purpose: "maskable"`).
   - Link in `app/index.html`: `<link rel="manifest" href="./manifest.webmanifest">` and `<meta name="theme-color" content="...">`.

2. **Service Worker (`app/sw.js`)**:
   - Registered on app boot in `app/js/main.js` (`navigator.serviceWorker.register('./sw.js')`).
   - **Cache Strategy**:
     - App shell (`index.html`, `styles/**`, `js/**`, `data/questions.json`): **Network-First** (with Cache fallback) or **Stale-While-Revalidate** with versioned cache key (e.g. `nursing-sim-v2.2.0`) so new deployments take effect promptly while offline use remains seamless.
     - **Explicit Bypass**: Never intercept or cache external Firebase/Google API traffic (`googleapis.com`, `firebaseio.com`, `firebaseapp.com`, `accounts.google.com`) so Firestore sync and Google Sign-In continue working cleanly.

3. **CSP & Install Prompt UX**:
   - Verify `app/index.html` CSP allows `manifest-src 'self'` and `worker-src 'self'`.
   - Optionally listen to `beforeinstallprompt` to show a subtle **"📲 התקן כאפליקציה"** button on supported browsers.

---

## 3. Invite-Only Access Control (Approved Users Managed by Admin)

### Overview

Restrict access to the simulator so that only users explicitly approved by the administrator can sign in and use the application, with an intuitive interface inside the Admin Dashboard to add or revoke approved email addresses.

### Data Model & Security Rules (`firestore.rules`)

- **Collection `/allowed_users/{email}`** (document ID is the normalized lowercase email address):
  - Fields: `email` (string), `addedBy` (string), `addedAt` (timestamp), `active` (boolean), `note` (optional string, e.g., student name/cohort).
- **Rules**:
  - `allow read, write: if isAdmin();`
  - `allow get: if request.auth != null && request.auth.token.email_verified == true && request.auth.token.email == email;` (allows an authenticated user to check only their own approval status, without listing other approved emails).
- **Helper `isApprovedUser()`**:
  ```rules
  function isApprovedUser() {
    return request.auth != null
      && request.auth.token.email_verified == true
      && exists(/databases/$(database)/documents/allowed_users/$(request.auth.token.email))
      && get(/databases/$(database)/documents/allowed_users/$(request.auth.token.email)).data.active == true;
  }
  ```
- **Enforced on `/users/{userId}`**: Only `isApprovedUser() || isAdmin()` can read or write user progress.

### Protecting Question Bank Data (Important Architectural Choice)

Because GitHub Pages serves static files publicly, `app/data/questions.json` is technically reachable via its direct URL unless moved behind authentication:

- **Level 1 (App Gate + Cloud Data Protection)**:
  - Upon load, the app requires Google Sign-In and checks `/allowed_users/{email}`. Unapproved users see a polite RTL lock screen (_"הגישה למערכת מוגבלת למשתמשים מאושרים בלבד"_) with their email displayed and a Sign Out button. All Firestore sync is blocked at the database level.
- **Level 2 (Full Question Bank Protection — Recommended for Strict Privacy)**:
  - Move `questions.json` out of public static `app/data/` into a Firestore collection (e.g., `/catalog/questions_v2` or chunked documents) protected by `allow read: if isApprovedUser() || isAdmin();`.
  - After sign-in verification passes, `question-repository.js` fetches the catalog from Firestore (and caches it locally for approved sessions) instead of a public JSON file.

### Admin Dashboard Management UI

Inside the Admin Dashboard, add a **"👥 ניהול משתמשים מורשים"** section:

- **Add User Form**: Email input (lowercased & trimmed) + optional note (e.g., `"מחזור חורף 2026"`) + **"הוסף משתמש"** button.
- **Approved Users List**: Shows all approved emails, date added, active/revoked status, and a **"הסר גישה"** button to deactivate or delete an entry immediately.
