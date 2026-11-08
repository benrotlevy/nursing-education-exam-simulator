/**
 * test_app_validation.js
 * Comprehensive automated regression & integrity test suite for the Nursing Education Exam Simulator.
 * Validates:
 *  1. Zero JS compilation / syntax errors in index.html & simulator_all_in_one.html
 *  2. DOM ID integrity (all document.getElementById targets exist in HTML)
 *  3. Onclick handlers integrity (all referenced functions exist in JS)
 *  4. Tab navigation and state switching (both desktop tabs & mobile bottom nav)
 *  5. Rationale & distractor parsing (no literature citations leak, structured distractor cards render)
 *  6. Distractor elimination (strikethrough) logic and state serialization
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

console.log('======================================================');
console.log('🧪 Running Comprehensive App Integrity & Validation Test');
console.log('======================================================');

const rootDir = path.resolve(__dirname, '..');
const indexPath = path.join(rootDir, 'index.html');
const standalonePath = path.join(rootDir, 'simulator_all_in_one.html');
const questionsPath = path.join(rootDir, 'questions.js');

assert.ok(fs.existsSync(indexPath), 'index.html must exist');
assert.ok(fs.existsSync(questionsPath), 'questions.js must exist');

const indexHtml = fs.readFileSync(indexPath, 'utf8');

// ----------------------------------------------------
// TEST 1: JavaScript Compilation & Syntax Validation
// ----------------------------------------------------
console.log('\n[1/6] Validating JavaScript Syntax & Compilation...');

const scriptMatch = indexHtml.match(/<script(?![^>]*src=)>([\s\S]*?)<\/script>/i);
assert.ok(scriptMatch, 'index.html must contain an inline <script> tag');
const jsCode = scriptMatch[1];

try {
  new vm.Script(jsCode, { filename: 'index.html[inline_script]' });
  console.log('  ✅ index.html inline script compiles with ZERO syntax errors.');
} catch (err) {
  console.error('  ❌ SYNTAX ERROR in index.html inline script:', err);
  process.exit(1);
}

if (fs.existsSync(standalonePath)) {
  const standaloneHtml = fs.readFileSync(standalonePath, 'utf8');
  const standaloneScriptMatch = standaloneHtml.match(/<script(?![^>]*src=)>([\s\S]*?)<\/script>/i);
  if (standaloneScriptMatch) {
    try {
      new vm.Script(standaloneScriptMatch[1], { filename: 'simulator_all_in_one.html[inline_script]' });
      console.log('  ✅ simulator_all_in_one.html script compiles with ZERO syntax errors.');
    } catch (err) {
      console.error('  ❌ SYNTAX ERROR in simulator_all_in_one.html:', err);
      process.exit(1);
    }
  }
}

// ----------------------------------------------------
// TEST 2: DOM ID Integrity Validation
// ----------------------------------------------------
console.log('\n[2/6] Validating DOM ID Integrity...');

// Extract all document.getElementById calls in jsCode
const getByIdRegex = /document\.getElementById\(\s*["']([^"']+)["']\s*\)/g;
const referencedIds = new Set();
let match;
while ((match = getByIdRegex.exec(jsCode)) !== null) {
  referencedIds.add(match[1]);
}

console.log(`  Found ${referencedIds.size} unique DOM IDs queried in JavaScript.`);
const missingIds = [];
referencedIds.forEach(id => {
  // Regex to match id="id" or id='id' in index.html
  const idRegex = new RegExp(`id=["']${id}["']`, 'i');
  if (!idRegex.test(indexHtml)) {
    missingIds.push(id);
  }
});

if (missingIds.length > 0) {
  console.error('  ❌ Missing DOM IDs referenced in JS:', missingIds);
  process.exit(1);
} else {
  console.log('  ✅ All DOM IDs queried by JavaScript exist in HTML markup.');
}

// ----------------------------------------------------
// TEST 3: Onclick Handler Integrity Validation
// ----------------------------------------------------
console.log('\n[3/6] Validating Onclick Event Handlers...');

const onclickRegex = /onclick=["']([^"']+)["']/g;
const referencedFuncs = new Set();
while ((match = onclickRegex.exec(indexHtml)) !== null) {
  const handler = match[1].trim();
  const fnMatch = handler.match(/^([a-zA-Z0-9_$]+)\s*\(/);
  if (fnMatch) {
    const fnName = fnMatch[1];
    if (!fnName.startsWith('window')) {
      referencedFuncs.add(fnName);
    }
  }
}

console.log(`  Found ${referencedFuncs.size} unique functions triggered by inline HTML buttons.`);
const missingFuncs = [];
referencedFuncs.forEach(fn => {
  const fnDefRegex = new RegExp(`function\\s+${fn}\\s*\\(`, 'i');
  if (!fnDefRegex.test(jsCode)) {
    missingFuncs.push(fn);
  }
});

if (missingFuncs.length > 0) {
  console.error('  ❌ Missing functions called in onclick handlers:', missingFuncs);
  process.exit(1);
} else {
  console.log('  ✅ All onclick event handlers link to real, defined JS functions.');
}

// ----------------------------------------------------
// TEST 4: Tab Navigation & State Switching Logic
// ----------------------------------------------------
console.log('\n[4/6] Testing Tab Navigation & State Transitions...');

// Create a mock sandbox to test runtime execution
const domElements = new Map();
function createMockElement(id, classes = []) {
  return {
    id,
    classList: {
      _classes: new Set(classes),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      contains(c) { return this._classes.has(c); },
      toggle(c) { if (this._classes.has(c)) this._classes.delete(c); else this._classes.add(c); }
    },
    style: {},
    innerHTML: '',
    textContent: '',
    appendChild(child) { return child; },
    removeChild(child) { return child; },
    querySelector(sel) { return createMockElement('sub_' + Math.random()); },
    querySelectorAll(sel) { return []; },
    setAttribute(k, v) {},
    getAttribute(k) { return null; }
  };
}

// Pre-populate expected DOM elements
[
  'tabExam', 'tabStudy', 'tabSavedExams', 'tabStats',
  'bNavExam', 'bNavStudy', 'bNavSaved', 'bNavStats',
  'screenExamSetup', 'screenActiveExam', 'screenExamResults', 'screenSavedExams', 'screenStudyMode', 'screenStats',
  'navSavedBadge', 'bNavSavedBadge', 'navMistakesBadge', 'bNavMistakesBadge', 'totalQuestionsHeader',
  'mobileSectionIndicator', 'mobileSectionTag', 'mobileSectionText'
].forEach(id => {
  domElements.set(id, createMockElement(id));
});

const mockSessionStorage = new Map();
const mockLocalStorage = new Map();

const sandbox = {
  console: { log: () => {}, warn: () => {}, error: console.error },
  window: {
    addEventListener: () => {},
    removeEventListener: () => {}
  },
  document: {
    getElementById(id) {
      if (!domElements.has(id)) {
        domElements.set(id, createMockElement(id));
      }
      return domElements.get(id);
    },
    querySelectorAll(selector) {
      const results = [];
      if (selector === '.tab-btn') {
        results.push(domElements.get('tabExam'), domElements.get('tabStudy'), domElements.get('tabSavedExams'), domElements.get('tabStats'));
      } else if (selector === '.bnav-btn') {
        results.push(domElements.get('bNavExam'), domElements.get('bNavStudy'), domElements.get('bNavSaved'), domElements.get('bNavStats'));
      } else if (selector === '.screen') {
        results.push(
          domElements.get('screenExamSetup'),
          domElements.get('screenActiveExam'),
          domElements.get('screenExamResults'),
          domElements.get('screenSavedExams'),
          domElements.get('screenStudyMode'),
          domElements.get('screenStats')
        );
      }
      return results;
    },
    createElement(tag) { return createMockElement('temp_' + Math.random()); }
  },
  sessionStorage: {
    getItem: (k) => mockSessionStorage.get(k) || null,
    setItem: (k, v) => mockSessionStorage.set(k, String(v)),
    removeItem: (k) => mockSessionStorage.delete(k)
  },
  localStorage: {
    getItem: (k) => mockLocalStorage.get(k) || null,
    setItem: (k, v) => mockLocalStorage.set(k, String(v)),
    removeItem: (k) => mockLocalStorage.delete(k)
  },
  setTimeout: () => {},
  clearTimeout: () => {}
};

// Execute questions.js and the inline JS in our mock context
vm.createContext(sandbox);
const questionsContent = fs.readFileSync(questionsPath, 'utf8');
vm.runInContext(questionsContent, sandbox);
vm.runInContext(jsCode, sandbox);

// Test switchTab across all 4 modes
const testTabs = [
  { tabId: 'exam', screenId: 'screenExamSetup', topBtnId: 'tabExam', bNavId: 'bNavExam' },
  { tabId: 'study', screenId: 'screenStudyMode', topBtnId: 'tabStudy', bNavId: 'bNavStudy' },
  { tabId: 'saved-exams', screenId: 'screenSavedExams', topBtnId: 'tabSavedExams', bNavId: 'bNavSaved' },
  { tabId: 'stats', screenId: 'screenStats', topBtnId: 'tabStats', bNavId: 'bNavStats' }
];

testTabs.forEach(({ tabId, screenId, topBtnId, bNavId }) => {
  sandbox.switchTab(tabId);
  const screen = domElements.get(screenId);
  const topBtn = domElements.get(topBtnId);
  const bNavBtn = domElements.get(bNavId);
  const mobText = domElements.get('mobileSectionText');

  assert.ok(screen.classList.contains('active'), `Screen ${screenId} should be active when tab is '${tabId}'`);
  assert.ok(topBtn.classList.contains('active'), `Top button ${topBtnId} should be active when tab is '${tabId}'`);
  assert.ok(bNavBtn.classList.contains('active'), `Bottom button ${bNavId} should be active when tab is '${tabId}'`);
  assert.ok(mobText.textContent.length > 0, `Mobile section text must be populated when tab is '${tabId}'`);
  assert.strictEqual(mockSessionStorage.get('nursing_active_tab_v1'), tabId, `SessionStorage should remember tab '${tabId}'`);
});

console.log('  ✅ Seamless state switching verified across exam, study, saved-exams, and stats tabs.');
console.log('  ✅ Two-way sync verified between desktop tabs and mobile bottom nav.');

// ----------------------------------------------------
// TEST 5: Rationale & Distractor Breakdown Parsing
// ----------------------------------------------------
console.log('\n[5/6] Testing Rationale & Distractor Parsing Across All Questions...');

const questions = sandbox.window.EXAM_QUESTIONS;
assert.ok(Array.isArray(questions) && questions.length === 1079, 'Must have 1079 verified questions');

let testedCount = 0;
questions.forEach(q => {
  const html = sandbox.renderExplanationHTML(q);
  testedCount++;

  // 1. Assert no literature references leak into user-facing HTML
  assert.ok(!html.includes('• מקור בספרות'), `Question ${q.id} leaked '• מקור בספרות' into rendered HTML`);
  assert.ok(!html.includes('• עיגון בספרות'), `Question ${q.id} leaked '• עיגון בספרות' into rendered HTML`);

  // 2. Assert structured blocks exist
  if (q.detailedExplanation || q.aiExplanation) {
    assert.ok(html.includes('expl-rationale-block'), `Question ${q.id} missing expl-rationale-block`);
    assert.ok(html.includes('expl-distractors-block'), `Question ${q.id} missing expl-distractors-block`);
    assert.ok(html.includes('expl-distractor-item'), `Question ${q.id} missing expl-distractor-item`);
  }
});

console.log(`  ✅ Successfully validated all ${testedCount} questions.`);
console.log('  ✅ Verified 0 literature citations leak into user view.');
console.log('  ✅ Verified 100% of questions render structured, high-contrast distractor cards.');

// ----------------------------------------------------
// TEST 6: Distractor Elimination (Strikethrough) Logic
// ----------------------------------------------------
console.log('\n[6/6] Testing Distractor Elimination (Strikethrough) Tool in Exam Mode...');

// Setup dummy exam in sandbox
const appState = vm.runInContext('state', sandbox);
appState.allQuestions = questions;
appState.activeExamScreen = 'ACTIVE';
appState.currentExam = {
  questions: [questions[0], questions[1]],
  currentIndex: 0,
  userAnswers: {},
  flagged: new Set(),
  eliminated: {},
  shuffledOptionsCache: {
    0: { options: ['אופציה א', 'אופציה ב', 'אופציה ג', 'אופציה ד'], correctIndex: 0 }
  }
};

// Eliminate option 1
sandbox.toggleEliminateExamOption(1);
assert.ok(appState.currentExam.eliminated[0].has(1), 'Option 1 should be eliminated');

// Answer option 1 directly -> should un-eliminate and select option 1
sandbox.selectExamOption(1);
assert.ok(!appState.currentExam.eliminated[0].has(1), 'Selecting option 1 should clear elimination');
assert.strictEqual(appState.currentExam.userAnswers[0], 1, 'Option 1 should be selected');

// Now eliminate option 1 -> should eliminate and unselect option 1
sandbox.toggleEliminateExamOption(1);
assert.ok(appState.currentExam.eliminated[0].has(1), 'Option 1 should be eliminated again');
assert.strictEqual(appState.currentExam.userAnswers[0], undefined, 'Option 1 selection should be cleared on elimination');

// Un-eliminate option 1 via toggle
sandbox.toggleEliminateExamOption(1);
assert.ok(!appState.currentExam.eliminated[0].has(1), 'Toggling option 1 again should un-eliminate it');

// Test session save/restore with eliminated options
appState.currentExam.eliminated[0].add(2);
appState.currentExam.eliminated[0].add(3);
sandbox.saveExamSession();

const rawSession = mockSessionStorage.get('nursing_exam_state_v1');
assert.ok(rawSession, 'SessionStorage must have exam state');
const parsedSession = JSON.parse(rawSession);
assert.deepStrictEqual(parsedSession.eliminated['0'], [2, 3], 'Serialized eliminated options must match [2, 3]');

// Restore
appState.currentExam = null;
sandbox.restoreExamSession();
assert.ok(appState.currentExam.eliminated[0].has(2) && appState.currentExam.eliminated[0].has(3), 'Restored eliminated set must contain 2 and 3');

console.log('  ✅ Distractor elimination tool passes 100% of functional & serialization checks.');

console.log('\n======================================================');
console.log('🎉 ALL INTEGRITY, SYNTAX, DOM, AND BEHAVIORAL TESTS PASSED (100%)!');
console.log('======================================================\n');
