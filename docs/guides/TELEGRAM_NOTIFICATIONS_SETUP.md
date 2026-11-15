# Telegram Push Notifications & Admin Rules Setup Guide

This guide explains how to enable instant Telegram push alerts when a signed-in user reports an issue on a question, **without exposing your Telegram Bot Token or Chat ID in client-side code**, and how to publish the updated Firestore Security Rules.

---

## Part A: Publish Updated Firestore Security Rules (Required)

Because this repository does not contain a Firebase CLI project file (`firebase.json`), update the live rules directly in the Firebase Console:

1. Open [Firebase Console](https://console.firebase.google.com/) and select your project (`nursing-exam-simulator`).
2. Go to **Build → Firestore Database → Rules**.
3. Open [`firestore.rules`](../../firestore.rules) from this repository, copy its entire contents, and replace the rules editor content in Firebase Console.
4. Click **Publish**.

What this enables:
- Signed-in users (`request.auth != null`) can **create** validated documents in `/question_reports`.
- Only the authorized administrator emails (`benjaminrotlevy@gmail.com`, `benjamin@rotlevy.com`) can **read**, **update status**, or **delete** reports in `/question_reports`.

---

## Part B: Create Your Telegram Bot & Get Your Chat ID (2 minutes)

1. Open Telegram and search for **`@BotFather`**.
2. Send `/newbot`, choose a display name (e.g., `Nursing Exam Reports`) and a username ending in `bot` (e.g., `nursing_exam_reports_bot`).
3. Copy the **HTTP API Token** (`123456789:ABCdef...`) — keep this secret!
4. Start a chat with your new bot in Telegram and send any message (e.g., `hello`).
5. Find your numeric **Chat ID**:
   - Message **`@userinfobot`** in Telegram and copy the `Id` number, **or**
   - Visit `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates` in your browser and read `"chat": {"id": 123456789}`.

---

## Part C: Deploy the Free Cloudflare Worker Relay (3 minutes)

The client app sends report metadata to your Cloudflare Worker URL (`https://<worker>.workers.dev`). The Worker holds your Telegram credentials encrypted on Cloudflare's edge servers and forwards the formatted message to Telegram.

1. Sign in or create a free account at [Cloudflare Workers](https://dash.cloudflare.com/).
2. Navigate to **Workers & Pages → Create → Create Worker**.
3. Give it a name (e.g., `nursing-exam-telegram-relay`) and click **Deploy**.
4. Click **Edit code**, delete the sample code, and paste the full contents of [`tools/cloudflare-worker-telegram.js`](../../tools/cloudflare-worker-telegram.js).
5. Click **Deploy** (top right).
6. Go to the Worker's **Settings → Variables and Secrets** and add:
   - **`TELEGRAM_BOT_TOKEN`** *(Type: **Secret**)* → Paste your `@BotFather` bot token.
   - **`TELEGRAM_CHAT_ID`** *(Type: **Secret**)* → Paste your numeric Telegram chat ID.
   - **`ALLOWED_ORIGIN`** *(Type: **Text**, optional)* → Comma-separated site origins allowed to trigger notifications, e.g.:
     `https://benjaminrotlevy.github.io,http://127.0.0.1:4173,http://localhost:4173`
7. Copy your deployed Worker URL (for example: `https://nursing-exam-telegram-relay.<your-subdomain>.workers.dev`).

---

## Part D: Connect the Worker URL to the App

1. Open [`app/js/config.js`](../../app/js/config.js).
2. Set `TELEGRAM_WEBHOOK_URL` to your Worker URL:
   ```js
   export const TELEGRAM_WEBHOOK_URL =
     'https://nursing-exam-telegram-relay.<your-subdomain>.workers.dev';
   ```
3. *(Recommended Hardening)* In [`app/index.html`](../../app/index.html), replace the wildcard `https://*.workers.dev` inside `Content-Security-Policy` `connect-src` with your exact Worker origin.
4. Test by signing in to the local app (`npm start`), clicking **🚩 דווח על טעות** on any question, submitting a report, and confirming the Telegram message arrives immediately.
