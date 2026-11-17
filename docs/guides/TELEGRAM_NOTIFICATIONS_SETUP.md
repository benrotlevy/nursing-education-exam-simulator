# Telegram Push Notifications, Access Control & Encrypted Catalog Setup Guide

This guide explains how to enable instant Telegram push alerts (for question reports and new student sign-in requests), publish updated Firestore Security Rules, and configure the AES-256-GCM encrypted catalog decryption key in Firestore.

---

## Part A: Publish Updated Firestore Security Rules (Required)

Because this repository does not contain a Firebase CLI project file (`firebase.json`), update the live rules directly in the Firebase Console:

1. Open [Firebase Console](https://console.firebase.google.com/) and select your project (`nursing-exam-simulator`).
2. Go to **Build → Firestore Database → Rules**.
3. Open [`firestore.rules`](../../firestore.rules) from this repository, copy its entire contents, and replace the rules editor content in Firebase Console.
4. Click **Publish**.

What this enables:
- **Invite-Only Allowlist (`/allowed_users/{email}`)**: Admins can add, approve, suspend, list, and delete users; verified students can read only their own entry and register an initial `PENDING` request (`active: false`).
- **Key-Gated Encrypted Catalog (`/app_config/catalog_key`)**: Readable **only** by verified Admins or actively approved users (`active == true`).
- **Admin Telegram Contact Link (`/app_config/contact`)**: Readable by signed-in users so pending students see your optional Telegram chat link without exposing your phone number.
- **Progress & Question Reports (`/users/{userId}`, `/question_reports/{reportId}`)**: Strictly limited to authorized users (`isAdmin() || isApprovedUser()`).

---

## Part B: Upload Your Catalog Decryption Key & Telegram Link (One-Time Setup)

1. Locally run `npm run encrypt:questions` (already run once) to generate:
   - `app/data/questions-demo.json` (10 public sample questions)
   - `app/data/questions.enc.json` (AES-256-GCM encrypted 1,079-question catalog)
   - `.secrets/catalog-key.json` (local git-ignored secret containing `keyBase64`)
2. Open the deployed site and sign in as an Administrator (`benjaminrotlevy@gmail.com` or `benjamin@rotlevy.com`).
3. Click **🛡️ ניהול** in the top bar → select the **👥 משתמשים מורשים** tab → expand **🔑 הגדרות מפתח פענוח וקישור Telegram**:
   - Paste `keyBase64` from `.secrets/catalog-key.json` and click **💾 שמור מפתח בענן**.
   - Paste your Telegram link (e.g. `https://t.me/<your_username>`) and click **💾 שמור קישור Telegram**.

---

## Part C: Create Your Telegram Bot & Get Your Chat ID (2 minutes)

1. Open Telegram and search for **`@BotFather`**.
2. Send `/newbot`, choose a display name (e.g., `Nursing Exam Reports`) and a username ending in `bot` (e.g., `nursing_exam_reports_bot`).
3. Copy the **HTTP API Token** (`123456789:ABCdef...`) — keep this secret!
4. Start a chat with your new bot in Telegram and send any message (e.g., `hello`).
5. Find your numeric **Chat ID**:
   - Message **`@userinfobot`** in Telegram and copy the `Id` number, **or**
   - Visit `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates` in your browser and read `"chat": {"id": 123456789}`.

---

## Part D: Deploy or Update the Cloudflare Worker Relay (3 minutes)

The client app sends alert metadata (`QUESTION_ISSUE_REPORT` and `NEW_USER_SIGN_IN`) to your Cloudflare Worker URL (`https://<worker>.workers.dev`). The Worker holds your Telegram credentials encrypted on Cloudflare's edge servers and forwards the formatted message to Telegram.

1. Sign in at [Cloudflare Workers](https://dash.cloudflare.com/) and open your Worker (`nursing-exam-telegram-relay`).
2. Click **Edit code**, replace the contents with [`tools/cloudflare-worker-telegram.js`](../../tools/cloudflare-worker-telegram.js), and click **Deploy**.
3. Ensure **Settings → Variables and Secrets** includes:
   - **`TELEGRAM_BOT_TOKEN`** *(Type: **Secret**)* → Paste your `@BotFather` bot token.
   - **`TELEGRAM_CHAT_ID`** *(Type: **Secret**)* → Paste your numeric Telegram chat ID.
   - **`ALLOWED_ORIGIN`** *(Type: **Text**, optional)* → Comma-separated site origins allowed to trigger notifications, e.g.:
     `https://benrotlevy.github.io,http://127.0.0.1:4173,http://localhost:4173`
4. Verify [`app/js/config.js`](../../app/js/config.js) has `TELEGRAM_WEBHOOK_URL` pointing to your Worker URL and push to `main`.
