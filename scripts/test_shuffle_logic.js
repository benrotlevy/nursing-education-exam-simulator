// Test core logic from index.html
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getShuffledQuestionOptions(q) {
  const indexedOptions = q.options.map((optText, origIndex) => ({
    text: optText,
    isCorrect: origIndex === q.correctIndex
  }));
  const shuffled = shuffleArray(indexedOptions);
  const newCorrectIndex = shuffled.findIndex(item => item.isCorrect);
  return {
    options: shuffled.map(item => item.text),
    correctIndex: newCorrectIndex
  };
}

global.window = {};
require('../questions.js');
const questions = window.EXAM_QUESTIONS;

console.log("Testing 1000 shuffles across database questions...");
let allPassed = true;
for (let i = 0; i < 1000; i++) {
  const q = questions[i % questions.length];
  const origCorrectText = q.options[q.correctIndex];
  const shuffled = getShuffledQuestionOptions(q);
  const shuffledCorrectText = shuffled.options[shuffled.correctIndex];
  
  if (origCorrectText !== shuffledCorrectText) {
    console.error("Mismatch detected!", { orig: origCorrectText, shuffled: shuffledCorrectText });
    allPassed = false;
    break;
  }
}

if (allPassed) {
  console.log("SHUFFLE TEST PASSED 100%! Correct answer text is preserved in all 1000 random shuffles.");
}
