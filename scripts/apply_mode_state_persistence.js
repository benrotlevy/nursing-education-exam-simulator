const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// 1. Add CSS for btn-abandon-exam
const oldCssRef = `.sync-status-indicator {
      font-size: 0.72rem;
      color: #15803d;
      transition: all 0.3s ease;
    }`;

const newCssAddition = `.sync-status-indicator {
      font-size: 0.72rem;
      color: #15803d;
      transition: all 0.3s ease;
    }

    .btn-abandon-exam {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #dc2626;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-abandon-exam:hover {
      background: #fee2e2;
      border-color: #f87171;
    }`;

if (!html.includes(oldCssRef)) {
  console.error("Error: oldCssRef not found");
  process.exit(1);
}
html = html.replace(oldCssRef, newCssAddition);

// 2. Add abandon exam button to screenActiveExam
const oldProgressText = `<div class="progress-text">
            <span id="examProgressCount">שאלה 1 מתוך 25</span>
            <span id="examAnsweredCount">נענו: 0</span>
          </div>`;

const newProgressText = `<div class="progress-text">
            <span id="examProgressCount">שאלה 1 מתוך 25</span>
            <span id="examAnsweredCount">נענו: 0</span>
            <button class="btn-abandon-exam" onclick="confirmAbandonExam()" title="יציאה מהמבחן וחזרה למסך הגדרת מבחן">
              ✕ יציאה מהמבחן
            </button>
          </div>`;

if (!html.includes(oldProgressText)) {
  console.error("Error: oldProgressText not found");
  process.exit(1);
}
html = html.replace(oldProgressText, newProgressText);

// 3. Update 'מבחן חדש' button on screenExamResults
const oldNewExamBtn = `<button class="btn btn-outline" onclick="switchTab('exam')" style="flex:1;">
            📝 מבחן חדש
          </button>`;

const newNewExamBtn = `<button class="btn btn-outline" onclick="resetExamToSetup()" style="flex:1;">
            📝 מבחן חדש
          </button>`;

if (!html.includes(oldNewExamBtn)) {
  console.error("Error: oldNewExamBtn not found");
  process.exit(1);
}
html = html.replace(oldNewExamBtn, newNewExamBtn);

// 4. Update state variables and keys
const oldStateKeys = `    const STORAGE_KEY_MISTAKES = "nursing_exam_mistakes_v1";
    const STORAGE_KEY_STATS = "nursing_exam_stats_v1";

    let state = {
      allQuestions: [],
      sources: [],
      categories: [
        "תיאוריות למידה ולמידת מבוגרים",
        "מיומנויות פסיכומוטוריות וסימולציה",
        "משוב, הערכה ורפלקציה",
        "תפקיד המדריך ויחסי מדריך-סטודנט",
        "הסטודנט המתקשה ותוכניות התערבות",
        "אתיקה, חוק ובטיחות המטופל"
      ],
      mistakes: new Set(), // Set of question IDs
      userStats: {
        totalAnswered: 0,
        totalCorrect: 0,
        examsCompleted: 0,
        categoryStats: {} // { catName: { correct: 0, total: 0 } }
      },
      // Active Exam
      currentExam: {
        questions: [],
        currentIndex: 0,
        userAnswers: {}, // { qIndex: selectedShuffledIndex }
        flagged: new Set(),
        shuffledOptionsCache: {} // { qIndex: { options: [], correctIndex: 0 } }
      },
      // Active Study
      currentStudy: {
        questions: [],
        currentIndex: 0,
        mistakesOnly: false,
        selectedCategory: "ALL",
        shuffledOptionsCache: {}
      }
    };`;

const newStateKeys = `    const STORAGE_KEY_MISTAKES = "nursing_exam_mistakes_v1";
    const STORAGE_KEY_STATS = "nursing_exam_stats_v1";
    const STORAGE_KEY_STUDY_STATE = "nursing_study_state_v1";
    const STORAGE_KEY_EXAM_STATE = "nursing_exam_state_v1";
    const STORAGE_KEY_ACTIVE_TAB = "nursing_active_tab_v1";

    let state = {
      allQuestions: [],
      sources: [],
      categories: [
        "תיאוריות למידה ולמידת מבוגרים",
        "מיומנויות פסיכומוטוריות וסימולציה",
        "משוב, הערכה ורפלקציה",
        "תפקיד המדריך ויחסי מדריך-סטודנט",
        "הסטודנט המתקשה ותוכניות התערבות",
        "אתיקה, חוק ובטיחות המטופל"
      ],
      mistakes: new Set(), // Set of question IDs
      userStats: {
        totalAnswered: 0,
        totalCorrect: 0,
        examsCompleted: 0,
        categoryStats: {} // { catName: { correct: 0, total: 0 } }
      },
      // Active Exam
      activeExamScreen: 'SETUP', // 'SETUP', 'ACTIVE', 'RESULTS'
      currentExam: {
        questions: [],
        currentIndex: 0,
        userAnswers: {}, // { qIndex: selectedShuffledIndex }
        flagged: new Set(),
        shuffledOptionsCache: {} // { qIndex: { options: [], correctIndex: 0 } }
      },
      // Active Study
      currentStudy: {
        questions: [],
        currentIndex: 0,
        mistakesOnly: false,
        selectedCategory: "ALL",
        shuffledOptionsCache: {},
        userAnswers: {} // { [studyQIndex]: selectedOptIdx }
      }
    };`;

if (!html.includes(oldStateKeys)) {
  console.error("Error: oldStateKeys not found");
  process.exit(1);
}
html = html.replace(oldStateKeys, newStateKeys);

// 5. Update DOMContentLoaded to restore session states
const oldDomInit = `    window.addEventListener("DOMContentLoaded", () => {
      loadStorage();
      initQuestions();
      renderStats();
    });`;

const newDomInit = `    window.addEventListener("DOMContentLoaded", () => {
      loadStorage();
      initQuestions();

      // Restore Study Mode session if saved
      const restoredStudy = restoreStudySession();
      if (!restoredStudy) {
        initStudyMode();
      }

      // Restore Exam Mode session if saved
      restoreExamSession();

      renderStats();

      // Restore active tab
      let initialTab = 'exam';
      try {
        const savedTab = sessionStorage.getItem(STORAGE_KEY_ACTIVE_TAB);
        if (savedTab && ['exam', 'study', 'stats'].includes(savedTab)) {
          initialTab = savedTab;
        }
      } catch (e) {}

      switchTab(initialTab);
    });

    function saveStudySession() {
      try {
        const study = state.currentStudy;
        const sessionData = {
          currentIndex: study.currentIndex,
          mistakesOnly: study.mistakesOnly,
          selectedCategory: study.selectedCategory,
          userAnswers: study.userAnswers || {},
          questionIds: study.questions.map(q => q.id),
          shuffledOptionsCache: study.shuffledOptionsCache || {}
        };
        sessionStorage.setItem(STORAGE_KEY_STUDY_STATE, JSON.stringify(sessionData));
      } catch (e) {
        console.warn("Failed to save study session:", e);
      }
    }

    function restoreStudySession() {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY_STUDY_STATE);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data.questionIds || data.questionIds.length === 0) return false;

        const qMap = new Map(state.allQuestions.map(q => [q.id, q]));
        const restoredQuestions = data.questionIds.map(id => qMap.get(id)).filter(Boolean);
        if (restoredQuestions.length === 0) return false;

        state.currentStudy = {
          questions: restoredQuestions,
          currentIndex: Math.min(data.currentIndex || 0, restoredQuestions.length - 1),
          mistakesOnly: !!data.mistakesOnly,
          selectedCategory: data.selectedCategory || "ALL",
          shuffledOptionsCache: data.shuffledOptionsCache || {},
          userAnswers: data.userAnswers || {}
        };

        const catSelect = document.getElementById("studyCategoryFilter");
        if (catSelect) catSelect.value = state.currentStudy.selectedCategory;
        const btnMistakes = document.getElementById("btnStudyMistakesOnly");
        if (btnMistakes) {
          if (state.currentStudy.mistakesOnly) {
            btnMistakes.classList.add("btn-primary");
            btnMistakes.classList.remove("btn-outline");
          } else {
            btnMistakes.classList.remove("btn-primary");
            btnMistakes.classList.add("btn-outline");
          }
        }
        return true;
      } catch (e) {
        console.warn("Failed to restore study session:", e);
        return false;
      }
    }

    function saveExamSession() {
      try {
        const exam = state.currentExam;
        if (!exam || !exam.questions || exam.questions.length === 0 || state.activeExamScreen === 'SETUP') {
          sessionStorage.removeItem(STORAGE_KEY_EXAM_STATE);
          return;
        }
        const sessionData = {
          activeExamScreen: state.activeExamScreen,
          currentIndex: exam.currentIndex,
          userAnswers: exam.userAnswers || {},
          flagged: Array.from(exam.flagged || []),
          questionIds: exam.questions.map(q => q.id),
          shuffledOptionsCache: exam.shuffledOptionsCache || {}
        };
        sessionStorage.setItem(STORAGE_KEY_EXAM_STATE, JSON.stringify(sessionData));
      } catch (e) {
        console.warn("Failed to save exam session:", e);
      }
    }

    function restoreExamSession() {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY_EXAM_STATE);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data.questionIds || data.questionIds.length === 0) return false;

        const qMap = new Map(state.allQuestions.map(q => [q.id, q]));
        const restoredQuestions = data.questionIds.map(id => qMap.get(id)).filter(Boolean);
        if (restoredQuestions.length === 0) return false;

        state.activeExamScreen = data.activeExamScreen || 'ACTIVE';
        state.currentExam = {
          questions: restoredQuestions,
          currentIndex: Math.min(data.currentIndex || 0, restoredQuestions.length - 1),
          userAnswers: data.userAnswers || {},
          flagged: new Set(data.flagged || []),
          shuffledOptionsCache: data.shuffledOptionsCache || {}
        };
        return true;
      } catch (e) {
        console.warn("Failed to restore exam session:", e);
        return false;
      }
    }`;

if (!html.includes(oldDomInit)) {
  console.error("Error: oldDomInit not found");
  process.exit(1);
}
html = html.replace(oldDomInit, newDomInit);

// 6. Update switchTab
const oldSwitchTab = `    function switchTab(tabId) {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));

      if (tabId === 'exam') {
        document.getElementById("tabExam").classList.add("active");
        document.getElementById("screenExamSetup").classList.add("active");
      } else if (tabId === 'study') {
        document.getElementById("tabStudy").classList.add("active");
        document.getElementById("screenStudyMode").classList.add("active");
        renderCurrentStudyQuestion();
      } else if (tabId === 'stats') {
        document.getElementById("tabStats").classList.add("active");
        document.getElementById("screenStats").classList.add("active");
        renderStats();
      }
    }`;

const newSwitchTab = `    function switchTab(tabId) {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));

      if (tabId === 'exam') {
        document.getElementById("tabExam").classList.add("active");
        if (state.activeExamScreen === 'ACTIVE' && state.currentExam && state.currentExam.questions && state.currentExam.questions.length > 0) {
          document.getElementById("screenActiveExam").classList.add("active");
          renderCurrentExamQuestion();
          renderExamQuickGrid();
        } else if (state.activeExamScreen === 'RESULTS' && state.currentExam && state.currentExam.questions && state.currentExam.questions.length > 0) {
          document.getElementById("screenExamResults").classList.add("active");
        } else {
          state.activeExamScreen = 'SETUP';
          document.getElementById("screenExamSetup").classList.add("active");
        }
      } else if (tabId === 'study') {
        document.getElementById("tabStudy").classList.add("active");
        document.getElementById("screenStudyMode").classList.add("active");
        renderCurrentStudyQuestion();
      } else if (tabId === 'stats') {
        document.getElementById("tabStats").classList.add("active");
        document.getElementById("screenStats").classList.add("active");
        renderStats();
      }

      try {
        sessionStorage.setItem(STORAGE_KEY_ACTIVE_TAB, tabId);
      } catch (e) {}
    }

    function confirmAbandonExam() {
      if (confirm("האם ברצונך לצאת מהמבחן הנוכחי? התשובות של מבחן זה שטרם הוגש יאופסו.")) {
        resetExamToSetup();
      }
    }

    function resetExamToSetup() {
      state.activeExamScreen = 'SETUP';
      state.currentExam = {
        questions: [],
        currentIndex: 0,
        userAnswers: {},
        flagged: new Set(),
        shuffledOptionsCache: {}
      };
      try {
        sessionStorage.removeItem(STORAGE_KEY_EXAM_STATE);
      } catch (e) {}
      document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
      document.getElementById("screenExamSetup").classList.add("active");
      document.getElementById("tabExam").classList.add("active");
    }`;

if (!html.includes(oldSwitchTab)) {
  console.error("Error: oldSwitchTab not found");
  process.exit(1);
}
html = html.replace(oldSwitchTab, newSwitchTab);

// 7. Update startExam
const oldStartExamEnd = `      state.currentExam = {
        questions: shuffledQuestions,
        currentIndex: 0,
        userAnswers: {},
        flagged: new Set(),
        shuffledOptionsCache: {} // Will generate shuffled options for each on the fly
      };

      document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
      document.getElementById("screenActiveExam").classList.add("active");

      renderExamQuickGrid();
      renderCurrentExamQuestion();
    }`;

const newStartExamEnd = `      state.activeExamScreen = 'ACTIVE';
      state.currentExam = {
        questions: shuffledQuestions,
        currentIndex: 0,
        userAnswers: {},
        flagged: new Set(),
        shuffledOptionsCache: {}
      };
      saveExamSession();

      document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
      document.getElementById("screenActiveExam").classList.add("active");

      renderExamQuickGrid();
      renderCurrentExamQuestion();
    }`;

if (!html.includes(oldStartExamEnd)) {
  console.error("Error: oldStartExamEnd not found");
  process.exit(1);
}
html = html.replace(oldStartExamEnd, newStartExamEnd);

// 8. Update selectExamOption, toggleExamFlag, prevExamQuestion, nextExamQuestion, jumpToExamQuestion
const oldExamNav = `    function selectExamOption(shuffledOptIdx) {
      state.currentExam.userAnswers[state.currentExam.currentIndex] = shuffledOptIdx;
      renderCurrentExamQuestion();
      renderExamQuickGrid();
    }

    function toggleExamFlag() {
      const idx = state.currentExam.currentIndex;
      if (state.currentExam.flagged.has(idx)) {
        state.currentExam.flagged.delete(idx);
      } else {
        state.currentExam.flagged.add(idx);
      }
      renderCurrentExamQuestion();
      renderExamQuickGrid();
    }

    function prevExamQuestion() {
      if (state.currentExam.currentIndex > 0) {
        state.currentExam.currentIndex--;
        renderCurrentExamQuestion();
      }
    }

    function nextExamQuestion() {
      if (state.currentExam.currentIndex < state.currentExam.questions.length - 1) {
        state.currentExam.currentIndex++;
        renderCurrentExamQuestion();
      }
    }

    function jumpToExamQuestion(index) {
      state.currentExam.currentIndex = index;
      renderCurrentExamQuestion();
    }`;

const newExamNav = `    function selectExamOption(shuffledOptIdx) {
      state.currentExam.userAnswers[state.currentExam.currentIndex] = shuffledOptIdx;
      saveExamSession();
      renderCurrentExamQuestion();
      renderExamQuickGrid();
    }

    function toggleExamFlag() {
      const idx = state.currentExam.currentIndex;
      if (state.currentExam.flagged.has(idx)) {
        state.currentExam.flagged.delete(idx);
      } else {
        state.currentExam.flagged.add(idx);
      }
      saveExamSession();
      renderCurrentExamQuestion();
      renderExamQuickGrid();
    }

    function prevExamQuestion() {
      if (state.currentExam.currentIndex > 0) {
        state.currentExam.currentIndex--;
        saveExamSession();
        renderCurrentExamQuestion();
      }
    }

    function nextExamQuestion() {
      if (state.currentExam.currentIndex < state.currentExam.questions.length - 1) {
        state.currentExam.currentIndex++;
        saveExamSession();
        renderCurrentExamQuestion();
      }
    }

    function jumpToExamQuestion(index) {
      state.currentExam.currentIndex = index;
      saveExamSession();
      renderCurrentExamQuestion();
    }`;

if (!html.includes(oldExamNav)) {
  console.error("Error: oldExamNav not found");
  process.exit(1);
}
html = html.replace(oldExamNav, newExamNav);

// 9. Update submitExam to set activeExamScreen = 'RESULTS'
const oldSubmitEnd = `      // Render Review List
      renderExamReviewList(exam);

      document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
      document.getElementById("screenExamResults").classList.add("active");
    }`;

const newSubmitEnd = `      state.activeExamScreen = 'RESULTS';
      saveExamSession();

      // Render Review List
      renderExamReviewList(exam);

      document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
      document.getElementById("screenExamResults").classList.add("active");
    }`;

if (!html.includes(oldSubmitEnd)) {
  console.error("Error: oldSubmitEnd not found");
  process.exit(1);
}
html = html.replace(oldSubmitEnd, newSubmitEnd);

// 10. Update retryWrongExamQuestions
const oldRetryWrong = `    function retryWrongExamQuestions() {
      const wrongList = state.currentExam.questions.filter((q, idx) => {
        const userChoice = state.currentExam.userAnswers[idx];
        const shuffled = state.currentExam.shuffledOptionsCache[idx];
        return userChoice === undefined || userChoice !== shuffled.correctIndex;
      });

      if (wrongList.length === 0) {
        alert("לא היו שגיאות במבחן זה! כל הכבוד!");
        return;
      }

      state.currentExam = {
        questions: shuffleArray(wrongList),
        currentIndex: 0,
        userAnswers: {},
        flagged: new Set(),
        shuffledOptionsCache: {}
      };

      document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
      document.getElementById("screenActiveExam").classList.add("active");
      renderExamQuickGrid();
      renderCurrentExamQuestion();
    }`;

const newRetryWrong = `    function retryWrongExamQuestions() {
      const wrongList = state.currentExam.questions.filter((q, idx) => {
        const userChoice = state.currentExam.userAnswers[idx];
        const shuffled = state.currentExam.shuffledOptionsCache[idx];
        return userChoice === undefined || userChoice !== shuffled.correctIndex;
      });

      if (wrongList.length === 0) {
        alert("לא היו שגיאות במבחן זה! כל הכבוד!");
        return;
      }

      state.activeExamScreen = 'ACTIVE';
      state.currentExam = {
        questions: shuffleArray(wrongList),
        currentIndex: 0,
        userAnswers: {},
        flagged: new Set(),
        shuffledOptionsCache: {}
      };
      saveExamSession();

      document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
      document.getElementById("screenActiveExam").classList.add("active");
      renderExamQuickGrid();
      renderCurrentExamQuestion();
    }`;

if (!html.includes(oldRetryWrong)) {
  console.error("Error: oldRetryWrong not found");
  process.exit(1);
}
html = html.replace(oldRetryWrong, newRetryWrong);

// 11. Update initStudyMode
const oldInitStudy = `      state.currentStudy.questions = shuffleArray(pool);
      state.currentStudy.currentIndex = 0;
      state.currentStudy.shuffledOptionsCache = {};
    }`;

const newInitStudy = `      state.currentStudy.questions = shuffleArray(pool);
      state.currentStudy.currentIndex = 0;
      state.currentStudy.shuffledOptionsCache = {};
      state.currentStudy.userAnswers = {};
      saveStudySession();
    }`;

if (!html.includes(oldInitStudy)) {
  console.error("Error: oldInitStudy not found");
  process.exit(1);
}
html = html.replace(oldInitStudy, newInitStudy);

// 12. Update renderCurrentStudyQuestion
const oldRenderStudy = `    function renderCurrentStudyQuestion() {
      const study = state.currentStudy;
      const total = study.questions.length;

      document.getElementById("studyTotalCount").textContent = total;
      const box = document.getElementById("studyExplanationBox");
      box.classList.remove("visible");

      if (total === 0) {
        document.getElementById("studyCurrentIndex").textContent = "0";
        document.getElementById("studyQText").textContent = 
          study.mistakesOnly ? "מאגר הטעויות שלך ריק כרגע! כל הכבוד 🎉" : "אין שאלות בקטגוריה זו.";
        document.getElementById("studyOptionsContainer").innerHTML = "";
        return;
      }

      const q = study.questions[study.currentIndex];
      document.getElementById("studyCurrentIndex").textContent = study.currentIndex + 1;
      document.getElementById("studyQCategory").textContent = q.category || "כללי";
      document.getElementById("studyQSource").textContent = q.source || "שחזור";
      document.getElementById("studyQUnverified").style.display = q.verified === false ? "inline-flex" : "none";
      document.getElementById("studyQText").textContent = q.question;

      // Shuffled Options
      if (!study.shuffledOptionsCache[study.currentIndex]) {
        study.shuffledOptionsCache[study.currentIndex] = getShuffledQuestionOptions(q);
      }
      const shuffledData = study.shuffledOptionsCache[study.currentIndex];

      const container = document.getElementById("studyOptionsContainer");
      container.innerHTML = "";
      const letters = ["א", "ב", "ג", "ד", "ה"];

      shuffledData.options.forEach((optText, optIdx) => {
        const item = document.createElement("div");
        item.className = "option-item";
        item.id = \`studyOpt_\${optIdx}\`;

        item.innerHTML = \`
          <div class="option-letter">\${letters[optIdx] || optIdx + 1}</div>
          <div class="option-content">\${optText}</div>
        \`;

        item.onclick = () => answerStudyQuestion(optIdx);
        container.appendChild(item);
      });
    }`;

const newRenderStudy = `    function renderCurrentStudyQuestion() {
      const study = state.currentStudy;
      const total = study.questions.length;

      document.getElementById("studyTotalCount").textContent = total;
      const box = document.getElementById("studyExplanationBox");

      if (total === 0) {
        box.classList.remove("visible");
        document.getElementById("studyCurrentIndex").textContent = "0";
        document.getElementById("studyQText").textContent = 
          study.mistakesOnly ? "מאגר הטעויות שלך ריק כרגע! כל הכבוד 🎉" : "אין שאלות בקטגוריה זו.";
        document.getElementById("studyOptionsContainer").innerHTML = "";
        return;
      }

      const q = study.questions[study.currentIndex];
      document.getElementById("studyCurrentIndex").textContent = study.currentIndex + 1;
      document.getElementById("studyQCategory").textContent = q.category || "כללי";
      document.getElementById("studyQSource").textContent = q.source || "שחזור";
      document.getElementById("studyQUnverified").style.display = q.verified === false ? "inline-flex" : "none";
      document.getElementById("studyQText").textContent = q.question;

      // Shuffled Options
      if (!study.shuffledOptionsCache[study.currentIndex]) {
        study.shuffledOptionsCache[study.currentIndex] = getShuffledQuestionOptions(q);
      }
      const shuffledData = study.shuffledOptionsCache[study.currentIndex];

      const container = document.getElementById("studyOptionsContainer");
      container.innerHTML = "";
      const letters = ["א", "ב", "ג", "ד", "ה"];

      // Check if user already answered this study question
      const prevAnswer = study.userAnswers ? study.userAnswers[study.currentIndex] : undefined;
      const isAnswered = prevAnswer !== undefined;

      shuffledData.options.forEach((optText, optIdx) => {
        const item = document.createElement("div");
        item.className = "option-item";
        item.id = \`studyOpt_\${optIdx}\`;

        if (isAnswered) {
          item.classList.add("disabled");
          if (optIdx === shuffledData.correctIndex) {
            item.classList.add("correct");
          } else if (optIdx === prevAnswer) {
            item.classList.add("wrong");
          }
        } else {
          item.onclick = () => answerStudyQuestion(optIdx);
        }

        item.innerHTML = \`
          <div class="option-letter">\${letters[optIdx] || optIdx + 1}</div>
          <div class="option-content">\${optText}</div>
        \`;
        container.appendChild(item);
      });

      // Show explanation if already answered
      if (isAnswered) {
        const isCorrect = prevAnswer === shuffledData.correctIndex;
        const explHeader = document.getElementById("studyExplanationHeader");
        const explText = document.getElementById("studyExplanationText");

        if (isCorrect) {
          explHeader.innerHTML = "✅ נכון מאוד! כל הכבוד:";
          explHeader.style.color = "#166534";
        } else {
          explHeader.innerHTML = "❌ לא מדויק. להלן ההסבר המלא:";
          explHeader.style.color = "#991b1b";
        }

        explText.innerHTML = renderExplanationHTML(q);
        box.classList.add("visible");
      } else {
        box.classList.remove("visible");
      }
    }`;

if (!html.includes(oldRenderStudy)) {
  console.error("Error: oldRenderStudy not found");
  process.exit(1);
}
html = html.replace(oldRenderStudy, newRenderStudy);

// 13. Update answerStudyQuestion
const oldAnswerStudy = `    function answerStudyQuestion(selectedOptIdx) {
      const study = state.currentStudy;
      const q = study.questions[study.currentIndex];
      const shuffledData = study.shuffledOptionsCache[study.currentIndex];
      const isCorrect = selectedOptIdx === shuffledData.correctIndex;

      // Disable other options to prevent multiple clicks
      const options = document.querySelectorAll("#studyOptionsContainer .option-item");
      options.forEach((opt, idx) => {
        opt.onclick = null;
        opt.classList.add("disabled");
        if (idx === shuffledData.correctIndex) {
          opt.classList.add("correct");
        } else if (idx === selectedOptIdx && !isCorrect) {
          opt.classList.add("wrong");
        }
      });

      // Update statistics
      state.userStats.totalAnswered++;
      const cat = q.category || "כללי";
      if (!state.userStats.categoryStats[cat]) {
        state.userStats.categoryStats[cat] = { correct: 0, total: 0 };
      }
      state.userStats.categoryStats[cat].total++;

      if (isCorrect) {
        state.userStats.totalCorrect++;
        state.userStats.categoryStats[cat].correct++;
        // Remove from mistake bank if present
        if (state.mistakes.has(q.id)) {
          state.mistakes.delete(q.id);
        }
      } else {
        // Add to mistake bank
        state.mistakes.add(q.id);
      }

      saveMistakes();
      saveStats();

      // Show Explanation Box
      const explBox = document.getElementById("studyExplanationBox");
      const explHeader = document.getElementById("studyExplanationHeader");
      const explText = document.getElementById("studyExplanationText");

      if (isCorrect) {
        explHeader.innerHTML = "✅ נכון מאוד! כל הכבוד:";
        explHeader.style.color = "#166534";
      } else {
        explHeader.innerHTML = "❌ לא מדויק. להלן ההסבר המלא:";
        explHeader.style.color = "#991b1b";
      }

      explText.innerHTML = renderExplanationHTML(q);
      explBox.classList.add("visible");
    }`;

const newAnswerStudy = `    function answerStudyQuestion(selectedOptIdx) {
      const study = state.currentStudy;
      if (!study.userAnswers) study.userAnswers = {};
      study.userAnswers[study.currentIndex] = selectedOptIdx;

      const q = study.questions[study.currentIndex];
      const shuffledData = study.shuffledOptionsCache[study.currentIndex];
      const isCorrect = selectedOptIdx === shuffledData.correctIndex;

      // Update statistics
      state.userStats.totalAnswered++;
      const cat = q.category || "כללי";
      if (!state.userStats.categoryStats[cat]) {
        state.userStats.categoryStats[cat] = { correct: 0, total: 0 };
      }
      state.userStats.categoryStats[cat].total++;

      if (isCorrect) {
        state.userStats.totalCorrect++;
        state.userStats.categoryStats[cat].correct++;
        // Remove from mistake bank if present
        if (state.mistakes.has(q.id)) {
          state.mistakes.delete(q.id);
        }
      } else {
        // Add to mistake bank
        state.mistakes.add(q.id);
      }

      saveMistakes();
      saveStats();
      saveStudySession();

      renderCurrentStudyQuestion();
    }`;

if (!html.includes(oldAnswerStudy)) {
  console.error("Error: oldAnswerStudy not found");
  process.exit(1);
}
html = html.replace(oldAnswerStudy, newAnswerStudy);

// 14. Update prevStudyQuestion / nextStudyQuestion
const oldStudyNav = `    function prevStudyQuestion() {
      if (state.currentStudy.currentIndex > 0) {
        state.currentStudy.currentIndex--;
        renderCurrentStudyQuestion();
      }
    }

    function nextStudyQuestion() {
      if (state.currentStudy.currentIndex < state.currentStudy.questions.length - 1) {
        state.currentStudy.currentIndex++;
        renderCurrentStudyQuestion();
      } else {
        // Wrap around with new shuffle!
        state.currentStudy.questions = shuffleArray(state.currentStudy.questions);
        state.currentStudy.currentIndex = 0;
        state.currentStudy.shuffledOptionsCache = {};
        renderCurrentStudyQuestion();
      }
    }`;

const newStudyNav = `    function prevStudyQuestion() {
      if (state.currentStudy.currentIndex > 0) {
        state.currentStudy.currentIndex--;
        saveStudySession();
        renderCurrentStudyQuestion();
      }
    }

    function nextStudyQuestion() {
      if (state.currentStudy.currentIndex < state.currentStudy.questions.length - 1) {
        state.currentStudy.currentIndex++;
        saveStudySession();
        renderCurrentStudyQuestion();
      } else {
        // Wrap around with new shuffle!
        state.currentStudy.questions = shuffleArray(state.currentStudy.questions);
        state.currentStudy.currentIndex = 0;
        state.currentStudy.shuffledOptionsCache = {};
        state.currentStudy.userAnswers = {};
        saveStudySession();
        renderCurrentStudyQuestion();
      }
    }`;

if (!html.includes(oldStudyNav)) {
  console.error("Error: oldStudyNav not found");
  process.exit(1);
}
html = html.replace(oldStudyNav, newStudyNav);

fs.writeFileSync('index.html', html, 'utf8');
console.log("Successfully applied mode state persistence to index.html!");
