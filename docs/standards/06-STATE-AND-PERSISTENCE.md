# 06 — State Management & Persistence Standard

## 1. Single Source of Truth (`core/store.js`)

All runtime application state lives in a single observable store instance created at startup in `main.js`.

### Canonical State Shape (`v2`)

```js
{
  schemaVersion: 2,
  // Catalog loaded once from data/questions.json
  catalog: {
    status: 'idle' | 'loading' | 'ready' | 'error',
    error: null | string,
    allQuestions: [],      // Question[]
    sources: [],           // string[]
    categories: []         // string[] (the 6 official syllabus categories)
  },
  // Navigation
  navigation: {
    activeTab: 'exam' | 'study' | 'saved-exams' | 'stats',
    examScreen: 'SETUP' | 'ACTIVE' | 'RESULTS'
  },
  // User Progress (persisted to localStorage + synced to Firestore)
  progress: {
    mistakes: {},          // { [questionId]: { addedAt: number } }
    savedExams: [],        // SavedExam[] (max 3)
    userStats: {
      totalAnswered: 0,
      totalCorrect: 0,
      examsCompleted: 0,
      categoryStats: {},   // { [catName]: { correct: number, total: number } }
      lastResetAt: 0       // epoch ms — enables reset propagation across devices!
    },
    updatedAt: 0           // epoch ms of latest local mutation
  },
  // Ephemeral / Session-persisted Active Exam
  examSession: null | {
    savedExamId: null | string,
    questions: [],
    currentIndex: 0,
    userAnswers: {},       // { [qIdx]: number }
    flagged: [],           // number[]
    eliminated: {},        // { [qIdx]: number[] }
    shuffledOptionsCache: {},
    resultSummary: null
  },
  // Ephemeral / Session-persisted Active Study
  studySession: {
    questions: [],
    currentIndex: 0,
    mistakesOnly: false,
    selectedCategory: 'ALL',
    shuffledOptionsCache: {},
    userAnswers: {}        // { [studyIdx]: number }
  },
  // Cloud Auth Status
  auth: {
    user: null | { uid: string, email: string, displayName: string, photoURL: string },
    syncStatus: 'offline' | 'idle' | 'syncing' | 'synced' | 'error'
  }
}
```

---

## 2. Storage Key Registry (`v2`)

Per the v2 architecture decision (ADR-0003), v2 starts with a clean, versioned key namespace in `config.js`:

| Constant                     | Key Name                   | Storage Engine   | Purpose                                                                                  |
| ---------------------------- | -------------------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| `STORAGE_KEYS.PROGRESS`      | `nursing_progress_v2`      | `localStorage`   | Consolidated `mistakes`, `savedExams`, `userStats`, `updatedAt`, and `schemaVersion: 2`. |
| `STORAGE_KEYS.EXAM_SESSION`  | `nursing_exam_session_v2`  | `sessionStorage` | Active in-progress exam state across page reloads.                                       |
| `STORAGE_KEYS.STUDY_SESSION` | `nursing_study_session_v2` | `sessionStorage` | Active study session state across tab switches and page reloads.                         |
| `STORAGE_KEYS.ACTIVE_TAB`    | `nursing_active_tab_v2`    | `sessionStorage` | Remembers the active navigation tab within the browser session.                          |

---

## 3. Cloud Synchronization & Conflict Resolution (`domain/sync-merge.js`)

In v1, merging used naive set-union for mistakes and `Math.max` for stats, which caused two bugs:

1. Answering a mistake correctly (removing it locally) was overwritten by the old cloud list on next sync.
2. Resetting statistics (`confirmResetStats`) was overwritten by the cloud's old higher numbers.

### v2 Deterministic Merge Rules

1. **Stats Reset Propagation**:
   - `userStats.lastResetAt` records the timestamp when the user explicitly reset their stats.
   - When merging local and remote states, if one side has a strictly newer `lastResetAt`, any stats/mistakes recorded _before_ that `lastResetAt` are discarded.
2. **Per-Question Mistake Tracking**:
   - `mistakes` maps `questionId -> { status: 'mistake' | 'resolved', updatedAt: epochMs }`.
   - When merging local and remote `mistakes`, for each `questionId`, the entry with the higher `updatedAt` wins! Active mistakes are those where `status === 'mistake'`.
3. **Saved Exams**:
   - Merged by `updatedAt` timestamp so adding, completing, or releasing a saved exam propagates deterministically across devices.
