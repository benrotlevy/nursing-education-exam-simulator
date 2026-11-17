# Manual Verification Checklist — Release `v2.4.0`

Our automated suites already verify unit logic, AES-256-GCM encryption/decryption, `firestore.rules` permissions, Cloudflare Worker formatting, responsive layouts, and offline Service Worker flows locally (`npm run verify` + `npx playwright test`).

This short **5-minute manual checklist** covers only the **live production integrations** that cannot run without real Google OAuth, live Firebase Firestore, GitHub Pages CDN, and your real Telegram bot.

**Live URL:** https://benrotlevy.github.io/nursing-education-exam-simulator/

---

## Test 1 — Plaintext `questions.json` Removed & Guest 10-Question Demo Mode (1 min)
1. Open an **Incognito / Private** browser tab and visit the live URL above.
2. **Expected:**
   - Top subtitle reads **`מצב הדגמה: 10 שאלות פתוחות מתוך 1079 שאלות במאגר`**.
   - Blue banner `#demoModeBanner` appears with **`🔒 מצב הדגמה (10 מתוך 1079 שאלות פתוחות)`** and **"התחבר עם Google לפתיחת המאגר"**.
   - **Study Mode (`💡 מצב למידה`)** works cleanly across the 10 sample questions.
   - **Exam Mode (`📝 מצב מבחן`)** lets guests run a **10-question miniature demo exam**, while the **25 / 50 / 100 question buttons show 🔒 and cannot be clicked**, and the **Source (`מקור השאלות`), Exam Category (`סינון לפי נושא`), and Study Category dropdowns are locked (disabled)**.
3. Open a new tab to:
   `https://benrotlevy.github.io/nursing-education-exam-simulator/data/questions.json`
4. **Expected:** Returns **`404 Not Found`** (plaintext catalog is no longer publicly served).
5. Open:
   `https://benrotlevy.github.io/nursing-education-exam-simulator/data/questions.enc.json`
6. **Expected:** Returns unreadable `AES-256-GCM` ciphertext (`iv` + `ciphertext` only).

---

## Test 2 — Admin Full Catalog & Cloud Key Verification (1 min)
1. In your normal browser window (or smartphone Chrome), sign in with **`benjaminrotlevy@gmail.com`**.
2. **Expected:**
   - Header unlocks immediately to **`מאגר פעיל: 1079 שאלות מאומתות`** and the Demo banner disappears.
   - Top bar shows the **`🛡️ דיווחים`** admin button.
   - Tap **`🛡️`** → confirm **`👥 משתמשים מורשים`** shows the real count of authorized users (e.g. `(1)` or `(2)`, including your Admin account and every added student, NOT `0`), switch to the tab to view the list, and confirm **🔑 הגדרות מפתח פענוח וקישור Telegram** displays **`מפתח פענוח מוגדר בענן ✅`**.

---

## Test 3 — New Unapproved Student Sign-In, Telegram Push Alert & 1-Tap Approval (2 min)
*(Requires a second non-admin Google account, e.g., another personal/student Gmail in an Incognito tab.)*
1. In an Incognito window, tap **"התחבר עם Google לפתיחת המאגר"** and sign in with the non-admin Gmail.
2. **Expected immediately:**
   - Amber banner appears showing the student's email and **`⏳ החשבון ממתין לאישור מנהל המערכת`**.
   - Header pill sync status shows amber **`⏳ ממתין לאישור גישה (מצב הדגמה)`** (no Firestore `permission-denied` loop).
   - Your **Telegram Bot** pushes a notification with the student's name and email (tap-to-copy `<code>` block if using manual entry).
   - The button **`💬 פנה למנהל ב-Telegram`** opens your configured `https://t.me/...` chat without revealing your phone number.
3. Optional check: have the test student type `"בדיקת הדסה"` in the note box and tap **`📩 שלח בקשת אישור גישה`** → confirm the updated Telegram alert arrives.
4. On your phone/laptop Admin window, open **`🛡️` → `👥 משתמשים מורשים`**:
   - **Expected:** The test student appears at the top under **`ממתין לאישור`** with their note.
   - Tap **`✅ אשר גישה`**.
5. Back in the Incognito student window, tap **`🔄 בדוק הרשאה מחדש`** (without signing out):
   - **Expected:** Within 1–2 seconds, toast says **`אושרת! המאגר המלא (1079 שאלות) נפתח בהצלחה 🎉`**, header switches to **`מאגר פעיל: 1079 שאלות מאומתות`**, Demo banner disappears, and green **`☁️ סנכרון ענן פעיל`** activates.

---

## Test 4 — Access Revocation & Sign-Out Memory Purge (1 min)
1. In Admin **`👥 משתמשים מורשים`**, tap **`🚫 השהה גישה`** on the test student.
2. Refresh the student Incognito window:
   - **Expected:** All 1,079 questions lock again, catalog drops back to **10 Demo Questions**, and red banner **`🚫 הגישה למאגר המלא עבור חשבון זה מושהית`** appears.
   - Clean up afterward by tapping **`🗑️ הסר`** in Admin so your list stays tidy.
3. On your Admin tab, tap **`התנתק`**:
   - **Expected:** Question count drops back immediately from `1079` to `10` Demo Questions (confirming in-memory full questions are cleared on sign-out).

---

## Test 5 — Installed PWA Offline Mode with Encrypted 1,079 Catalog (1 min)
1. Sign in with your approved account while online on your smartphone (or installed desktop PWA) so all 1,079 questions load once and cache locally.
2. Enable **Airplane Mode** (completely offline), fully close the PWA, and reopen it.
3. **Expected:**
   - The app opens without network errors and **all 1,079 questions unlock offline** via the cached key + Service Worker `questions.enc.json`.
   - Top indicator correctly reads **`📴 מצב לא מקוון (נשמר מקומית)`**.
4. Disable Airplane Mode when done.
