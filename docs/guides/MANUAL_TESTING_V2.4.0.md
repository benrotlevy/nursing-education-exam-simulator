# Manual Verification Checklist — Release `v2.4.1` (Live Verification)

Our automated suites already verify unit logic, AES-256-GCM encryption/decryption, `firestore.rules` permissions, Cloudflare Worker formatting, responsive layouts, Demo Mode locks, real-time `onSnapshot` auto-unlock, Sign-Out local purge/warning, and offline Service Worker flows locally (`npm run verify` + `npx playwright test`).

This short **4-minute manual checklist** focuses on the remaining live production checks that require real Google OAuth, live Cloud Firestore, GitHub Pages CDN, and your real Telegram bot.

**Live URL:** https://benrotlevy.github.io/nursing-education-exam-simulator/

---

## Test 1 — Plaintext `questions.json` Removed & Guest Demo Mode Locks *(Previously Passed — Quick Spot-Check Optional)*
1. Open an **Incognito / Private** browser tab and visit the live URL above.
2. **Expected:**
   - Top subtitle reads **`מצב הדגמה: 10 שאלות פתוחות מתוך 1079 שאלות במאגר`**.
   - Blue banner `#demoModeBanner` appears with **`🔒 מצב הדגמה (10 מתוך 1079 שאלות פתוחות)`** and **"התחבר עם Google לפתיחת המאגר"**.
   - **Exam Mode (`📝 מצב מבחן`)** lets guests run a **10-question miniature demo exam**, while **25 / 50 / 100 question buttons show 🔒 and cannot be clicked**, and Source / Category / Study filters are disabled.
   - **Saved Exams (`📦 מבחנים שמורים`)**: Verify the dropdown and **`🔒 שמור ונעל מבחן זה`** button are locked/disabled in Demo Mode.
3. Open `https://benrotlevy.github.io/nursing-education-exam-simulator/data/questions.json` → **Expected:** `404 Not Found`.

---

## Test 2 — Admin Sign-In, Both Admins Visible & Header Label (1 min)
1. Sign in with **`benjaminrotlevy@gmail.com`** (or `benjamin@rotlevy.com`).
2. **Expected:**
   - **No `"ממתין לאישור מנהל"` toast or banner flash** during sign-in (shows brief checking status or opens directly with **`התחברת בהצלחה! מסנכרן עם הענן ☁️`**).
   - Header unlocks immediately to **`מאגר פעיל: 1079 שאלות מאומתות`** and top header Admin button displays **`🛡️ ניהול`** (NOT `דיווחים`).
   - Tap **`🛡️ ניהול`** → **`👥 משתמשים מורשים`** → confirm **both Admin accounts** (`benjaminrotlevy@gmail.com` AND `benjamin@rotlevy.com`) appear in the list, and **🔑 הגדרות מפתח פענוח וקישור Telegram** displays **`מפתח פענוח מוגדר בענן ✅`**.

---

## Test 3 — New Student Sign-In, Telegram Alert, Real-Time Auto-Unlock & Re-Login (1.5 min)
*(Requires a second non-admin Gmail in an Incognito tab.)*
1. In an Incognito window, tap **"התחבר עם Google לפתיחת המאגר"** and sign in with the non-admin Gmail.
2. **Expected immediately:**
   - Amber banner appears showing the student's email and **`⏳ החשבון ממתין לאישור מנהל המערכת`**.
   - Your **Telegram Bot** pushes a notification with the student's name and email, and **`💬 פנה למנהל ב-Telegram`** opens your configured `https://t.me/...` chat without exposing your phone number.
3. Keep the student Incognito window open and visible (do **NOT** click anything on it).
4. On your Admin window, open **`🛡️ ניהול` → `👥 משתמשים מורשים`** and tap **`✅ אשר גישה`** on the test student.
5. Watch the Incognito student window:
   - **Expected automatically within 1–2 seconds (no button click needed!):** Toast says **`אושרת! המאגר המלא (1079 שאלות) נפתח בהצלחה 🎉`**, header switches to **`מאגר פעיל: 1079 שאלות מאומתות`**, Demo banner disappears, and Saved Exams / >10 counts / filters unlock immediately.
6. Sign out and sign back in with that approved student Gmail:
   - **Expected:** **No `"ממתין לאישור מנהל"` banner or toast flash** while signing in; unlocks smoothly to `1079` questions.

---

## Test 4 — Access Revocation & Sign-Out Local Purge + Unsynced Warning (1.5 min)
1. In Admin **`👥 משתמשים מורשים`**, tap **`🚫 השהה גישה`** on the test student → check the student window locks back to 10 Demo Questions (and clean up afterward by tapping **`🗑️ הסר`** in Admin).
2. **Synced Sign-Out Purge Check:** When signed in cleanly with green `☁️ סנכרון ענן פעיל` and no active unfinished exam, tap **`התנתק`**:
   - **Expected:** Signs out immediately without a warning prompt, resets stats/mistakes/saved exams from `localStorage` and `sessionStorage` to `0`, and drops back to 10 Demo Questions.
3. **Unsynced Data Warning Check:** Sign in, start a quick 10-question exam (or go offline / use a Pending account and answer 1 question so local data is not synced yet), then tap **`התנתק`**:
   - **Expected:** Confirmation dialog warns you that local progress / an active exam exists and signing out will delete all local data from the device. Tapping **בטל** keeps everything intact; tapping **התנתק ומחק נתונים מקומיים** signs out and wipes all `localStorage` & `sessionStorage` entries.

---

## Test 5 — Installed PWA Offline Mode with Encrypted 1,079 Catalog (1 min)
1. Sign in with your approved account while online on your smartphone (or installed desktop PWA) so all 1,079 questions load once and cache locally.
2. Enable **Airplane Mode** (completely offline), fully close the PWA, and reopen it.
3. **Expected:**
   - The app opens without network errors and **all 1,079 questions unlock offline** via the cached key + Service Worker `questions.enc.json`.
   - Top indicator correctly reads **`📴 מצב לא מקוון (נשמר מקומית)`**.
4. Disable Airplane Mode when done.
