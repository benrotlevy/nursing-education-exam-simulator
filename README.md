# מערכת תרגול למבחן על-בסיסי בהדרכה קלינית (Clinical Preceptorship Exam Simulator — v2.1.0)

מערכת ווב מודולרית לתרגול ולהכנה למבחן הגמר/על-בסיסי בקורס הדרכה קלינית בסיעוד (מנהל הסיעוד, משרד הבריאות).
המערכת כתובה ב-**Pure Vanilla HTML5, CSS3 (`@layer`), ו-ES2022+ Modules** ללא תלות ב-Bundler או Framework חיצוני, פועלת בדפדפן על גבי GitHub Pages וכוללת סנכרון ענן מאובטח בזמן אמת דרך **Google Cloud / Firebase v11**.

---

## ⚡ סטטוס גרסה `v2.1.0` (Full-Stack Engineering Architecture)

- **מאגר שאלות קנוני ומאומת (`1,079` שאלות):**
  - **894 שאלות מאומתות רשמית (`verified: true`)** מתוך מפתחות תשובות רשמיים, סימוני מרקר וערעורים (כולל שחזור ממשלתי 2023 — 100 שאלות, שחזור ממשלתי 2021 — 13 שאלות מלאות, שחזורי 2024, מבחן מסכם הדסה 2023 ושאלונים ממשלתיים).
  - **185 שאלות משוחזרות (`verified: false`)** בעלות פתרון פדגוגי מנומק מבוסס סילבוס משרד הבריאות (כולל 50 שאלות מבחן בית מאוקטובר 2024 תחת תגית שקופה `פתרון משוער`).
  - **261 שאלות עם תשובה בודדת** המתועדות בנפרד ב-[`docs/single_answer_questions.md`](./docs/single_answer_questions.md) לפיתוח מסיחים עתידי.
- **ארכיטקטורת `v2.1.0` מודולרית ומופרדת שכבות:**
  - קובץ ה-HTML המונוליתי מ-`v1.0.0` (`~4,200` שורות) פוצל ל-`app/index.html` סמנטי ונקי (`478` שורות ללא אף `<script>` או `<style>` מוטמעים), **16 קובצי CSS** תחת `@layer tokens, base, layout, components, features, utilities`, ו-**27 מודולי ES2022+** בשכבות `core/`, `domain/`, `services/`, `ui/`, ו-`features/`.
  - קובץ הנתונים בזמן ריצה (`app/data/questions.json`) עבר דה-דופליקציה אוטומטית באמצעות `tools/build-questions.js` וצומצם מ-**4.31 MB** ל-**2.29 MB** (חיסכון של **46.7%** ברוחב הפס ללא אובדן מידע פדגוגי).
- **אבטחה, נגישות ובדיקות אוטומטיות מקצה לקצה:**
  - מדיניות אבטחת תוכן קפדנית (`Content-Security-Policy`) החוסמת הרצת סקריפטים מוטמעים (`script-src` ללא `'unsafe-inline'`), סינון XSS אוטומטי (`escapeHTML` / `html`), וחוקי אבטחה ב-[`firestore.rules`](./firestore.rules).
  - החלפת חלונות `alert()` / `confirm()` חוסמים ברכיב `<dialog>` נגיש (`app/js/ui/dialog.js`) ובהתראות Toast (`app/js/ui/toast.js`).
  - **124 בדיקות Unit, Data, Integration ו-DOM** (`node:test` + `happy-dom`) + **48 בדיקות Playwright E2E** על פני 4 פרופילי מסך (`Laptop 1440×900`, `Tablet 768×1024`, `Pixel 10 Pro XL 448×998`, `Galaxy S25 360×780`) ב-100% הצלחה (0 כישלונות, 0 דילוגים).

---

## 🚀 מאפייני המערכת

### 1. מנגנון ערבוב רנדומלי כפול (`app/js/domain/shuffle.js`)

- **סדר השאלות:** מתערבב בכל מבחן וסבב תרגול מחדש (אלגוריתם Fisher-Yates טהור ללא מוטציה על קלט המקור).
- **סדר המסיחים (א', ב', ג', ד'):** מתערבב רנדומלית בכל הצגה של שאלה תוך מעקב מדויק ב-100% אחר `correctIndex`.

### 2. ארבעה מצבי עבודה מסונכרנים

- **📝 מצב מבחן (`app/js/features/exam/`):**
  - בחירת כמות שאלות (`10 / 25 / 50 / 100 / מאגר טעויות בלבד`), מקור ספציפי וקטגוריה.
  - פסילת מסיחים (`✕`), סימון שאלות לעיון חוזר (`★`), רשת ניווט מהירה (`Quick Grid`), ושימור מלא של מבחן פעיל ב-`sessionStorage` (`nursing_exam_session_v2`).
  - מסך תוצאות מפורט עם כרטיסי הסבר פדגוגיים וכפתור **"תרגל עכשיו רק את השגיאות"**.
- **💡 מצב למידה (`app/js/features/study/`):**
  - משוב מיידי לכל שאלה עם כרטיסיית **"בשורה אחת"**, אקורדיון רציונל פדגוגי ופירוק מסיחים שגויים (`app/js/ui/explanation-card.js`).
  - כפתור **"העתק שאלה ל-AI"** המייצר פרומפט מובנה בעברית להתייעצות עם מודלי שפה (`app/js/domain/ai-prompt.js` + `app/js/services/clipboard.js`).
- **📦 אזור מבחנים שמורים ובידוד שאלות (`app/js/features/saved-exams/`):**
  - שמירת עד **3 מבחנים מלאים** בבידוד (`Quarantine Zone`): כל שאלות המבחן השמור יוצאות מיד ממאגר התרגול והלמידה כדי למנוע ספוילרים עד לביצוע סימולציה מלאה או שחרור יזום למאגר.
- **📊 דשבורד סטטיסטיקה וניתוח מוכנות (`app/js/features/stats/`):**
  - חישוב אחוזי הצלחה מצטברים וניתוח שליטה לפי **6 קטגוריות הליבה של הקורס**:
    1. תיאוריות למידה ולמידת מבוגרים
    2. מיומנויות פסיכומוטוריות וסימולציה
    3. משוב, הערכה ורפלקציה
    4. תפקיד המדריך ויחסי מדריך-סטודנט
    5. הסטודנט המתקשה ותוכניות התערבות
    6. אתיקה, חוק ובטיחות המטופל
  - זיהוי אוטומטי של הנושא החלש ביותר ומעבר בלחיצה אחת לתרגול ממוקד שלו במצב למידה.

### 3. סנכרון ענן דטרמיניסטי (`app/js/services/cloud-sync.js` & `app/js/domain/sync-merge.js`)

- פתרון קונפליקטים מבוסס חותמות זמן (`mistakeTimestamps` + `removed: true` tombstones) המונע חזרה של טעויות שנפתרו ממכשיר אחר (`SYNC-02`).
- הפצת איפוס סטטיסטיקה בין מכשירים באמצעות `userStats.lastResetAt` (`SYNC-03`).

---

## 🏗️ מבנה הפרויקט (`v2.0.0`)

```text
/
├── app/                              # תיקיית ה-Web App הנפרסת ל-GitHub Pages
│   ├── index.html                    # שלד HTML5 סמנטי עם CSP קפדני (ללא JS/CSS מוטמעים)
│   ├── data/
│   │   └── questions.json            # מאגר 1,079 השאלות המקומפל לזמן ריצה (2.29 MB)
│   ├── styles/                       # ארכיטקטורת CSS מודולרית מבוססת @layer (16 קבצים)
│   │   ├── main.css
│   │   ├── tokens.css
│   │   ├── base.css
│   │   ├── layout.css
│   │   ├── utilities.css
│   │   ├── components/               # badges, buttons, cards, dialog, explanation, forms, toast
│   │   └── features/                 # exam, study, saved-exams, stats
│   └── js/
│       ├── main.js                   # נקודת כניסה, חיבור תלויות ו-Event Delegation
│       ├── config.js                 # קבועים, מפתחות אחסון v2 והגדרות Firebase
│       ├── core/                     # store.js, storage.js, router.js, events.js
│       ├── domain/                   # לוגיקה עסקית טהורה (shuffle, question-pool, exam-session, וכו')
│       ├── services/                 # question-repository.js, clipboard.js, cloud-sync.js
│       ├── ui/                       # dom.js, toast.js, dialog.js, explanation-card.js
│       └── features/                 # exam/, study/, saved-exams/, stats/, auth/
├── data-pipeline/
│   └── source/
│       └── clean_questions.json      # מקור האמת הקנוני של 1,079 השאלות
├── tools/
│   ├── build-questions.js            # קומפילציה ואימות של clean_questions.json -> app/data/questions.json
│   └── serve.js                      # שרת פיתוח מקומי (Node HTTP ללא תלויות חיצוניות)
├── tests/
│   ├── data/                         # בדיקות סכמה ושלמות פדגוגית של כל 1,079 השאלות
│   ├── unit/                         # בדיקות יחידה מהירות למודולי domain/ ו-core/
│   ├── integration/                  # בדיקות אינטגרציה (Storage, Router, Cloud Sync, Dialogs)
│   ├── dom/                          # בדיקות רינדור DOM ואבטחת XSS באמצעות happy-dom
│   └── e2e/                          # בדיקות Playwright E2E על פני 4 גדלי מסך
├── docs/
│   ├── standards/                    # "התנ"ך ההנדסי" של הפרויקט (מסמכים 01 עד 12)
│   ├── adr/                          # Architecture Decision Records (0001 עד 0004)
│   ├── STPR.md                       # תוכנית ודוח בדיקות תוכנה מלא (Software Test Plan & Report)
│   ├── INDEXING_STATUS.md            # היסטוריית אינדוקס חומרי הגלם
│   └── single_answer_questions.md    # מאגר 261 שאלות שחזור עם תשובה בודדת
├── firestore.rules                   # חוקי אבטחה של Cloud Firestore
├── package.json
├── eslint.config.js
└── playwright.config.js
```

---

## 💻 פיתוח מקומי והרצת בדיקות

### דרישות קדם

- **Node.js `>= 20.0.0`**

### פקודות שימושיות

```bash
# התקנת כלי הפיתוח והבדיקות (ESLint, Prettier, Happy-DOM, Playwright)
npm install

# הפעלת שרת פיתוח מקומי בכתובת http://127.0.0.1:4173
npm start

# הרצת בדיקות Lint + פורמט + כל 63 בדיקות ה-Unit / Data / Integration / DOM
npm run verify

# הרצת 20 בדיקות ה-E2E בדפדפן אמיתי על פני 4 גדלי מסך (Laptop, Tablet, Pixel 10 Pro XL, Galaxy S25)
npm run test:e2e

# בנייה מחדש של app/data/questions.json מתוך data-pipeline/source/clean_questions.json
npm run build:data
```

---

## 📚 תיעוד הנדסי ומסמכי סטנדרטים

- **[Engineering Standards ("התנ"ך ההנדסי")](./docs/standards/README.md)** — ארכיטקטורה, תקני קוד, CSS, נגישות RTL, ניהול מצב, אבטחה ו-Definition of Done.
- **[Software Test Plan & Report (`docs/STPR.md`)](./docs/STPR.md)** — מטריצת עקיבות דרישות ודוח ריצת בדיקות מלא.
- **[מדריך תרומה ופיתוח (`CONTRIBUTING.md`)](./CONTRIBUTING.md)** — תהליך העבודה ב-Git, הוספת פיצ'רים ועדכון מאגר השאלות.
- **[יומן שינויים (`CHANGELOG.md`)](./CHANGELOG.md)** — פירוט השינויים המלא בין `v1.0.0` ל-`v2.0.0`.
