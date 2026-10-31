const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// 1. Update CSS
const oldCssTarget = `    .header-inner {
      max-width: 1100px;
      margin: 0 auto;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }`;

const newCssReplacement = `    .header-inner {
      max-width: 1100px;
      margin: 0 auto;
      padding: 12px 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      width: 100%;
    }

    .cloud-auth-bar {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn-google-auth {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 9999px;
      padding: 7px 15px;
      font-size: 0.88rem;
      font-weight: 700;
      color: #334155;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      transition: all 0.2s ease;
    }

    .btn-google-auth:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
      transform: translateY(-1px);
    }

    .btn-google-auth.loading {
      opacity: 0.6;
      pointer-events: none;
    }

    .user-pill {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 9999px;
      padding: 4px 12px 4px 6px;
      box-shadow: var(--shadow-sm);
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .user-meta {
      display: flex;
      flex-direction: column;
      line-height: 1.15;
    }

    .user-name {
      font-size: 0.84rem;
      font-weight: 700;
      color: #166534;
      max-width: 130px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sync-status-indicator {
      font-size: 0.72rem;
      color: #15803d;
      transition: all 0.3s ease;
    }

    .btn-signout {
      background: transparent;
      border: none;
      color: #dc2626;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
      transition: color 0.15s ease;
    }

    .btn-signout:hover {
      color: #991b1b;
      text-decoration: underline;
    }

    /* Floating Toast Notification */
    .app-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(30px);
      background: #0f172a;
      color: #ffffff;
      padding: 12px 24px;
      border-radius: 9999px;
      font-size: 0.92rem;
      font-weight: 700;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25);
      z-index: 9999;
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: none;
      white-space: nowrap;
      border: 1px solid rgba(255,255,255,0.1);
    }

    .app-toast.visible {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }`;

if (!html.includes(oldCssTarget)) {
  console.error("Error: oldCssTarget not found in index.html");
  process.exit(1);
}
html = html.replace(oldCssTarget, newCssReplacement);

// 2. Update media query
const oldMediaTarget = `    @media (max-width: 640px) {
      .header-inner {
        flex-direction: column;
        align-items: stretch;
      }
      .nav-tabs {
        width: 100%;
        justify-content: center;
      }
      .tab-btn {
        flex: 1;
        justify-content: center;
        padding: 8px 10px;
        font-size: 0.88rem;
      }
      .card {
        padding: 20px 16px;
      }
      .q-text {
        font-size: 1.15rem;
      }
      .option-item {
        padding: 12px 14px;
      }
    }`;

const newMediaReplacement = `    @media (max-width: 640px) {
      .header-inner {
        padding: 10px 14px;
        gap: 10px;
      }
      .header-top {
        gap: 8px;
      }
      .brand-title h1 {
        font-size: 1.05rem;
      }
      .brand-title p {
        font-size: 0.72rem;
      }
      .brand-icon {
        width: 36px;
        height: 36px;
        font-size: 18px;
      }
      .btn-google-auth {
        padding: 6px 10px;
        font-size: 0.78rem;
        gap: 6px;
      }
      .btn-google-auth svg {
        width: 15px;
        height: 15px;
      }
      .user-pill {
        padding: 3px 8px 3px 4px;
        gap: 6px;
      }
      .user-avatar {
        width: 26px;
        height: 26px;
      }
      .user-name {
        max-width: 80px;
        font-size: 0.76rem;
      }
      .nav-tabs {
        width: 100%;
        justify-content: center;
      }
      .tab-btn {
        flex: 1;
        justify-content: center;
        padding: 8px 6px;
        font-size: 0.85rem;
      }
      .card {
        padding: 20px 16px;
      }
      .q-text {
        font-size: 1.15rem;
      }
      .option-item {
        padding: 12px 14px;
      }
    }`;

if (!html.includes(oldMediaTarget)) {
  console.error("Error: oldMediaTarget not found in index.html");
  process.exit(1);
}
html = html.replace(oldMediaTarget, newMediaReplacement);

// 3. Update Header HTML
const oldHeaderTarget = `  <!-- Top Header -->
  <header>
    <div class="header-inner">
      <div class="brand">
        <div class="brand-icon">🩺</div>
        <div class="brand-title">
          <h1>מבחן הדרכה קלינית בסיעוד</h1>
          <p id="totalQuestionsHeader">טוען מאגר שאלות...</p>
        </div>
      </div>

      <nav class="nav-tabs">
        <button class="tab-btn active" id="tabExam" onclick="switchTab('exam')">
          📝 מצב מבחן
        </button>
        <button class="tab-btn" id="tabStudy" onclick="switchTab('study')">
          💡 מצב למידה
        </button>
        <button class="tab-btn" id="tabStats" onclick="switchTab('stats')">
          📊 סטטיסטיקה
          <span class="mistakes-counter-badge" id="navMistakesBadge" style="display:none;">0 טעויות</span>
        </button>
      </nav>
    </div>
  </header>`;

const newHeaderReplacement = `  <!-- Top Header -->
  <header>
    <div class="header-inner">
      <div class="header-top">
        <div class="brand">
          <div class="brand-icon">🩺</div>
          <div class="brand-title">
            <h1>מבחן הדרכה קלינית בסיעוד</h1>
            <p id="totalQuestionsHeader">טוען מאגר שאלות...</p>
          </div>
        </div>

        <!-- Cloud Auth / Sync Section -->
        <div class="cloud-auth-bar" id="cloudAuthBar">
          <button class="btn-google-auth" id="btnGoogleSignIn" onclick="window.triggerGoogleSignIn()" title="התחבר עם חשבון Google כדי לשמור ולסנכרן את הטעויות והסטטיסטיקות בין הטלפון למחשב">
            <svg class="google-icon" viewBox="0 0 24 24" width="18" height="18">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
            </svg>
            <span>סנכרון ענן (Google)</span>
          </button>

          <div class="user-pill" id="userPill" style="display:none;">
            <img class="user-avatar" id="userAvatar" src="" alt="avatar" />
            <div class="user-meta">
              <span class="user-name" id="userName">משתמש</span>
              <span class="sync-status-indicator" id="syncStatusIndicator">☁️ סנכרון ענן פעיל</span>
            </div>
            <button class="btn-signout" onclick="window.triggerGoogleSignOut()" title="התנתק מהחשבון">התנתק</button>
          </div>
        </div>
      </div>

      <nav class="nav-tabs">
        <button class="tab-btn active" id="tabExam" onclick="switchTab('exam')">
          📝 מצב מבחן
        </button>
        <button class="tab-btn" id="tabStudy" onclick="switchTab('study')">
          💡 מצב למידה
        </button>
        <button class="tab-btn" id="tabStats" onclick="switchTab('stats')">
          📊 סטטיסטיקה
          <span class="mistakes-counter-badge" id="navMistakesBadge" style="display:none;">0 טעויות</span>
        </button>
      </nav>
    </div>
  </header>`;

if (!html.includes(oldHeaderTarget)) {
  console.error("Error: oldHeaderTarget not found in index.html");
  process.exit(1);
}
html = html.replace(oldHeaderTarget, newHeaderReplacement);

// 4. Update Stats Screen with Cloud Info
const oldStatsTarget = `<div style="margin-top:32px; padding-top:20px; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">`;
const newStatsReplacement = `<div id="statsCloudSyncInfo" style="margin-top:28px; margin-bottom:16px; font-size:0.9rem; padding:10px 14px; background:#f8fafc; border-radius:var(--radius-sm); border:1px solid var(--border);">
          <span style="color:var(--text-muted);">💾 הנתונים נשמרים מקומית בדפדפן. לחץ למעלה על 'סנכרון ענן' כדי לסנכרן בין מכשירים.</span>
        </div>
        <div style="padding-top:16px; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">`;

if (!html.includes(oldStatsTarget)) {
  console.error("Error: oldStatsTarget not found in index.html");
  process.exit(1);
}
html = html.replace(oldStatsTarget, newStatsReplacement);

// 5. Update saveMistakes and saveStats to trigger cloudSync
const oldSaveMistakes = `    function saveMistakes() {
      try {
        localStorage.setItem(STORAGE_KEY_MISTAKES, JSON.stringify(Array.from(state.mistakes)));
        updateMistakesUI();
      } catch (e) {
        console.error("Failed to save mistakes:", e);
      }
    }`;

const newSaveMistakes = `    function saveMistakes() {
      try {
        localStorage.setItem(STORAGE_KEY_MISTAKES, JSON.stringify(Array.from(state.mistakes)));
        updateMistakesUI();
        if (window.cloudSync && typeof window.cloudSync.schedulePush === 'function') {
          window.cloudSync.schedulePush();
        }
      } catch (e) {
        console.error("Failed to save mistakes:", e);
      }
    }`;

const oldSaveStats = `    function saveStats() {
      try {
        localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(state.userStats));
      } catch (e) {
        console.error("Failed to save stats:", e);
      }
    }`;

const newSaveStats = `    function saveStats() {
      try {
        localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(state.userStats));
        if (window.cloudSync && typeof window.cloudSync.schedulePush === 'function') {
          window.cloudSync.schedulePush();
        }
      } catch (e) {
        console.error("Failed to save stats:", e);
      }
    }`;

if (!html.includes(oldSaveMistakes) || !html.includes(oldSaveStats)) {
  console.error("Error: oldSaveMistakes or oldSaveStats not found in index.html");
  process.exit(1);
}
html = html.replace(oldSaveMistakes, newSaveMistakes);
html = html.replace(oldSaveStats, newSaveStats);

// 6. Update confirmResetStats
const oldResetTarget = `        updateMistakesUI();
        renderStats();
        alert("הנתונים אופסו בהצלחה.");`;

const newResetReplacement = `        updateMistakesUI();
        renderStats();
        if (window.cloudSync && typeof window.cloudSync.resetCloudData === 'function') {
          window.cloudSync.resetCloudData();
        }
        alert("הנתונים אופסו בהצלחה.");`;

if (!html.includes(oldResetTarget)) {
  console.error("Error: oldResetTarget not found in index.html");
  process.exit(1);
}
html = html.replace(oldResetTarget, newResetReplacement);

// 7. Add Firebase ES Module script before </body>
const firebaseScript = `
  <!-- Firebase Cloud Sync (Modular SDK v11) -->
  <script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
    import { 
      getAuth, 
      signInWithPopup, 
      signOut, 
      GoogleAuthProvider, 
      onAuthStateChanged 
    } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
    import { 
      getFirestore, 
      doc, 
      getDoc, 
      setDoc, 
      onSnapshot 
    } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

    const firebaseConfig = {
      apiKey: "AIzaSyAoy9RhCjtYn0xQ7tmmdqVdecsg8NWCtbM",
      authDomain: "nursing-exam-simulator.firebaseapp.com",
      projectId: "nursing-exam-simulator",
      storageBucket: "nursing-exam-simulator.firebasestorage.app",
      messagingSenderId: "756220661476",
      appId: "1:756220661476:web:2598724629ebb0dbea26f1"
    };

    let app, auth, db, provider;
    try {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
    } catch (e) {
      console.warn("Firebase initialization failed:", e);
    }

    let unsubscribeSnapshot = null;
    let pushDebounceTimer = null;
    let isReceivingRemoteUpdate = false;

    window.cloudSync = {
      getAuthUser() {
        return auth ? auth.currentUser : null;
      },

      async signIn() {
        if (!auth) {
          alert("שירותי הענן אינם זמינים כעת (למשל במצב ללא אינטרנט).");
          return;
        }
        const btn = document.getElementById("btnGoogleSignIn");
        if (btn) btn.classList.add("loading");
        try {
          await signInWithPopup(auth, provider);
          showToast("התחברת בהצלחה! מסנכרן עם הענן ☁️");
        } catch (err) {
          console.error("Firebase Sign-in error:", err);
          if (err.code === "auth/popup-blocked") {
            alert("הדפדפן חסם את חלון ההתחברות. אנא אשר פתיחת חלונות קופצים (Popups) בדפדפן עבור אתר זה ונסה שוב.");
          } else if (err.code === "auth/unauthorized-domain") {
            alert("דומיין לא מאושר ב-Firebase! יש להוסיף את הדומיין benrotlevy.github.io ב-Firebase Console תחת Authentication -> Settings -> Authorized Domains.");
          } else if (err.code !== "auth/popup-closed-by-user") {
            alert("שגיאה בהתחברות: " + (err.message || err.code));
          }
        } finally {
          if (btn) btn.classList.remove("loading");
        }
      },

      async signOut() {
        if (!auth) return;
        try {
          if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
            unsubscribeSnapshot = null;
          }
          await signOut(auth);
          showToast("התנתקת מחשבון הענן. הנתונים ממשיכים להישמר מקומית בדפדפן.");
        } catch (err) {
          console.error("Firebase Sign-out error:", err);
        }
      },

      schedulePush() {
        if (!auth || !auth.currentUser || isReceivingRemoteUpdate) return;
        clearTimeout(pushDebounceTimer);
        pushDebounceTimer = setTimeout(async () => {
          try {
            const userDocRef = doc(db, "users", auth.currentUser.uid);
            const dataToPush = {
              email: auth.currentUser.email || "",
              displayName: auth.currentUser.displayName || "",
              mistakes: Array.from(state.mistakes),
              userStats: state.userStats,
              updatedAt: new Date().toISOString()
            };
            await setDoc(userDocRef, dataToPush, { merge: true });
            flashSyncIndicator();
          } catch (err) {
            console.warn("Cloud push warning:", err);
          }
        }, 600);
      },

      async resetCloudData() {
        if (!auth || !auth.currentUser) return;
        try {
          const userDocRef = doc(db, "users", auth.currentUser.uid);
          await setDoc(userDocRef, {
            mistakes: [],
            userStats: {
              totalAnswered: 0,
              totalCorrect: 0,
              examsCompleted: 0,
              categoryStats: {}
            },
            updatedAt: new Date().toISOString()
          }, { merge: true });
          flashSyncIndicator();
        } catch (err) {
          console.error("Failed to reset cloud data:", err);
        }
      }
    };

    if (auth) {
      onAuthStateChanged(auth, async (user) => {
        updateAuthUI(user);
        if (user) {
          const userDocRef = doc(db, "users", user.uid);
          try {
            const snap = await getDoc(userDocRef);
            if (snap.exists()) {
              mergeRemoteData(snap.data());
              window.cloudSync.schedulePush();
            } else {
              window.cloudSync.schedulePush();
            }
          } catch (err) {
            console.warn("Initial Firestore getDoc failed:", err);
          }

          if (unsubscribeSnapshot) unsubscribeSnapshot();
          unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
            if (!docSnap.exists()) return;
            mergeRemoteData(docSnap.data(), true);
          }, (err) => {
            console.warn("Snapshot listener error:", err);
          });
        } else {
          if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
            unsubscribeSnapshot = null;
          }
        }
      });
    }

    function mergeRemoteData(remote, isRealtime = false) {
      if (!remote) return;
      isReceivingRemoteUpdate = true;
      try {
        if (Array.isArray(remote.mistakes)) {
          remote.mistakes.forEach(id => state.mistakes.add(id));
        }

        if (remote.userStats) {
          const rStats = remote.userStats;
          state.userStats.totalAnswered = Math.max(state.userStats.totalAnswered || 0, rStats.totalAnswered || 0);
          state.userStats.totalCorrect = Math.max(state.userStats.totalCorrect || 0, rStats.totalCorrect || 0);
          state.userStats.examsCompleted = Math.max(state.userStats.examsCompleted || 0, rStats.examsCompleted || 0);

          if (rStats.categoryStats) {
            state.userStats.categoryStats = state.userStats.categoryStats || {};
            for (const [cat, data] of Object.entries(rStats.categoryStats)) {
              if (!state.userStats.categoryStats[cat]) {
                state.userStats.categoryStats[cat] = { correct: 0, total: 0 };
              }
              state.userStats.categoryStats[cat].total = Math.max(state.userStats.categoryStats[cat].total || 0, data.total || 0);
              state.userStats.categoryStats[cat].correct = Math.max(state.userStats.categoryStats[cat].correct || 0, data.correct || 0);
            }
          }
        }

        localStorage.setItem(STORAGE_KEY_MISTAKES, JSON.stringify(Array.from(state.mistakes)));
        localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(state.userStats));

        if (typeof updateMistakesUI === 'function') updateMistakesUI();
        if (typeof renderStats === 'function') renderStats();

        flashSyncIndicator();
      } finally {
        setTimeout(() => { isReceivingRemoteUpdate = false; }, 300);
      }
    }

    function updateAuthUI(user) {
      const btn = document.getElementById("btnGoogleSignIn");
      const pill = document.getElementById("userPill");
      const nameEl = document.getElementById("userName");
      const avatarEl = document.getElementById("userAvatar");
      const statsCloudBadge = document.getElementById("statsCloudSyncInfo");

      if (user) {
        if (btn) btn.style.display = "none";
        if (pill) pill.style.display = "inline-flex";
        if (nameEl) nameEl.textContent = user.displayName || user.email || "משתמש";
        if (avatarEl) {
          avatarEl.src = user.photoURL || "https://www.gravatar.com/avatar/?d=mp";
        }
        if (statsCloudBadge) {
          statsCloudBadge.innerHTML = \`<span style="color:#16a34a; font-weight:700;">☁️ מחובר לחשבון Google:</span> <span>\${user.displayName || user.email}</span> &bull; <span style="color:#15803d;">סנכרון ענן פעיל</span>\`;
        }
      } else {
        if (btn) btn.style.display = "inline-flex";
        if (pill) pill.style.display = "none";
        if (statsCloudBadge) {
          statsCloudBadge.innerHTML = \`<span style="color:var(--text-muted);">💾 הנתונים נשמרים מקומית בדפדפן. לחץ למעלה על 'סנכרון ענן' כדי לסנכרן בין מכשירים.</span>\`;
        }
      }
    }

    function flashSyncIndicator() {
      const indicator = document.getElementById("syncStatusIndicator");
      if (!indicator) return;
      indicator.textContent = "☁️ סונכרן הרגע";
      indicator.style.color = "#15803d";
      indicator.style.fontWeight = "700";
      setTimeout(() => {
        indicator.textContent = "☁️ סנכרון ענן פעיל";
        indicator.style.fontWeight = "400";
      }, 2000);
    }

    function showToast(message) {
      let toast = document.getElementById("appGlobalToast");
      if (!toast) {
        toast = document.createElement("div");
        toast.id = "appGlobalToast";
        toast.className = "app-toast";
        document.body.appendChild(toast);
      }
      toast.textContent = message;
      toast.classList.add("visible");
      setTimeout(() => {
        toast.classList.remove("visible");
      }, 3500);
    }

    window.triggerGoogleSignIn = () => {
      if (window.cloudSync && typeof window.cloudSync.signIn === 'function') {
        window.cloudSync.signIn();
      } else {
        alert("טוען שירותי ענן, אנא נסה שוב בעוד רגע...");
      }
    };

    window.triggerGoogleSignOut = () => {
      if (window.cloudSync && typeof window.cloudSync.signOut === 'function') {
        window.cloudSync.signOut();
      }
    };
  </script>
</body>`;

html = html.replace('</body>', firebaseScript);

fs.writeFileSync('index.html', html, 'utf8');
console.log("Successfully integrated Firebase Cloud Sync into index.html!");
