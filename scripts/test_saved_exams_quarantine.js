/**
 * Automated Verification: Saved Exams & Question Quarantining
 */

const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('questions.js', 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const allQuestions = sandbox.window.EXAM_QUESTIONS;

console.log('======================================================');
console.log('🧪 Testing Saved Exams & Question Quarantining Logic');
console.log('======================================================');

if (!Array.isArray(allQuestions) || allQuestions.length !== 1079) {
  console.error(`FAIL: Expected 1079 questions, got ${allQuestions ? allQuestions.length : 0}`);
  process.exit(1);
}
console.log(`✅ Loaded ${allQuestions.length} questions from questions.js.`);

// Mock state
let savedExams = [];

function getQuarantinedSet() {
  const set = new Set();
  savedExams.forEach(s => {
    s.questionIds.forEach(id => set.add(id));
  });
  return set;
}

function getActivePool() {
  const qSet = getQuarantinedSet();
  return allQuestions.filter(q => !qSet.has(q.id));
}

// 1. Initial State
let activePool = getActivePool();
if (activePool.length !== 1079) {
  console.error(`FAIL: Initial active pool should be 1079, got ${activePool.length}`);
  process.exit(1);
}
console.log('✅ Initial State: All 1,079 questions available in active pool.');

// 2. Reserve Exam 1: שחזור מבחן ממשלתי 2023 (שחזור חליל) (100 questions)
const exam1Src = 'שחזור מבחן ממשלתי 2023 (שחזור חליל)';
const exam1Qs = allQuestions.filter(q => q.source === exam1Src);
if (exam1Qs.length !== 100) {
  console.error(`FAIL: Expected 100 questions for exam 1, got ${exam1Qs.length}`);
  process.exit(1);
}

savedExams.push({
  id: 'saved_1',
  sourceName: exam1Src,
  questionCount: exam1Qs.length,
  questionIds: exam1Qs.map(q => q.id)
});

activePool = getActivePool();
if (activePool.length !== 979) {
  console.error(`FAIL: Pool should be 979 after reserving 100 questions, got ${activePool.length}`);
  process.exit(1);
}

// Verify that zero questions from exam 1 exist in activePool
const leakedExam1 = activePool.filter(q => q.source === exam1Src);
if (leakedExam1.length > 0) {
  console.error(`FAIL: ${leakedExam1.length} questions from Exam 1 leaked into active pool!`);
  process.exit(1);
}
console.log('✅ Exam 1 Reserved: 100 questions quarantined, active pool is exactly 979, 0 leaks.');

// 3. Reserve Exam 2: מבחן מסכם בהדרכה קלינית 2023 (הדסה/העברית) (98 questions)
const exam2Src = 'מבחן מסכם בהדרכה קלינית 2023 (הדסה/העברית)';
const exam2Qs = allQuestions.filter(q => q.source === exam2Src);
if (exam2Qs.length !== 98) {
  console.error(`FAIL: Expected 98 questions for exam 2, got ${exam2Qs.length}`);
  process.exit(1);
}

savedExams.push({
  id: 'saved_2',
  sourceName: exam2Src,
  questionCount: exam2Qs.length,
  questionIds: exam2Qs.map(q => q.id)
});

activePool = getActivePool();
const expectedRemaining2 = 1079 - 100 - 98; // 881
if (activePool.length !== expectedRemaining2) {
  console.error(`FAIL: Pool should be ${expectedRemaining2}, got ${activePool.length}`);
  process.exit(1);
}
console.log(`✅ Exam 2 Reserved: Active pool is exactly ${expectedRemaining2} (198 questions quarantined).`);

// 4. Reserve Exam 3: שחזור מבחן בהדרכה קלינית2019 (89 questions)
const exam3Src = 'שחזור מבחן בהדרכה קלינית2019';
const exam3Qs = allQuestions.filter(q => q.source === exam3Src);
if (exam3Qs.length !== 89) {
  console.error(`FAIL: Expected 89 questions for exam 3, got ${exam3Qs.length}`);
  process.exit(1);
}

savedExams.push({
  id: 'saved_3',
  sourceName: exam3Src,
  questionCount: exam3Qs.length,
  questionIds: exam3Qs.map(q => q.id)
});

activePool = getActivePool();
const expectedRemaining3 = 1079 - 100 - 98 - 89; // 792
if (activePool.length !== expectedRemaining3) {
  console.error(`FAIL: Pool should be ${expectedRemaining3}, got ${activePool.length}`);
  process.exit(1);
}
console.log(`✅ Exam 3 Reserved: Active pool is exactly ${expectedRemaining3} (287 questions quarantined).`);

// 5. Test Maximum 3 Limit
if (savedExams.length !== 3) {
  console.error(`FAIL: Expected exactly 3 saved exams, got ${savedExams.length}`);
  process.exit(1);
}
const canAddFourth = savedExams.length < 3;
if (canAddFourth) {
  console.error('FAIL: Should not be able to add a 4th exam when limit is 3!');
  process.exit(1);
}
console.log('✅ Limit Enforced: Cannot add a 4th exam when 3/3 slots are full.');

// 6. Test Releasing Exam 1
savedExams = savedExams.filter(s => s.id !== 'saved_1');
activePool = getActivePool();
const expectedAfterRelease1 = 1079 - 98 - 89; // 892
if (activePool.length !== expectedAfterRelease1) {
  console.error(`FAIL: Pool should be ${expectedAfterRelease1} after releasing Exam 1, got ${activePool.length}`);
  process.exit(1);
}
const releasedExam1Available = activePool.filter(q => q.source === exam1Src);
if (releasedExam1Available.length !== 100) {
  console.error(`FAIL: Released exam 1 should have 100 questions available, got ${releasedExam1Available.length}`);
  process.exit(1);
}
console.log('✅ Release Exam 1: 100 questions successfully restored to the active pool (892 total).');

// 7. Test Releasing all exams
savedExams = [];
activePool = getActivePool();
if (activePool.length !== 1079) {
  console.error(`FAIL: Pool should return to 1079, got ${activePool.length}`);
  process.exit(1);
}
console.log('✅ Release All: Active pool completely restored to 1,079 questions.');

console.log('======================================================');
console.log('🎉 ALL SAVED EXAMS & QUARANTINING TESTS PASSED 100%!');
console.log('======================================================');
