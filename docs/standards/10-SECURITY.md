# 10 — Security & Privacy Standard

## 1. Cross-Site Scripting (XSS) Prevention

- **Auto-Escaping by Default**: All dynamic HTML rendering must go through `html` tagged templates (`app/js/ui/dom.js`), which escape `&`, `<`, `>`, `"`, and `'` on every interpolated value before DOM insertion.
- **`raw()` Restricted to Trusted Sub-Templates**: The `raw()` marker may only wrap return values of other `html` templates—never raw strings from `localStorage`, URL parameters, Firebase user profiles (`displayName`, `photoURL`), or question text.
- **Avatar URL Validation**: Before setting `img.src = user.photoURL`, validate that the URL parses cleanly with `new URL()` and uses the `https:` protocol.

---

## 2. Content Security Policy (CSP)

Once all inline `<script>`, inline `<style>`, and inline `onclick="..."` handlers are removed in Steps 6–10, `app/index.html` will enforce a strict Content Security Policy via `<meta http-equiv="Content-Security-Policy">`:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="
  default-src 'self';
  script-src 'self' https://www.gstatic.com https://apis.google.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https://*.googleusercontent.com https://www.gravatar.com;
  connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://www.gstatic.com;
  frame-src https://*.firebaseapp.com https://accounts.google.com;
  object-src 'none';
  base-uri 'self';
"
/>
```

- Notice that `'unsafe-inline'` is **omitted** from `script-src`, blocking injected scripts from executing.

---

## 3. Firebase & Cloud Data Security

1. **Public Client Config vs. Security Rules**:
   - Firebase Web `apiKey` and `projectId` in `config.js` are public identifiers by Firebase design. Security is enforced by **Firebase Authentication Authorized Domains** and **Cloud Firestore Security Rules** (`firestore.rules`).
2. **Least-Privilege Firestore Rules (`firestore.rules`)**:
   - A user may only read and write their own document at `/users/{userId}` where `request.auth != null && request.auth.uid == userId`.
   - Incoming writes are schema-validated (field whitelist, type checks, size bounds) so a malicious client cannot write arbitrary payloads.
3. **Zero Secrets in Repository**:
   - Service account keys (`*.json`), `.env` files, API tokens (e.g., Gemini API keys used during historical data enrichment), and private certificates must never be committed.

---

## 4. Public Deployment Isolation

- Only the contents of `app/` are uploaded to the GitHub Pages artifact (ADR-0002).
- Raw exam scans (`raw_materials/`), intermediate extraction dumps (`data/`), and Python/Node maintenance scripts are excluded from the web artifact and not publicly downloadable from the website URL.
