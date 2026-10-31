const fs = require('fs');

const VALID_CATEGORIES = new Set([
  "תיאוריות למידה ולמידת מבוגרים",
  "מיומנויות פסיכומוטוריות וסימולציה",
  "משוב, הערכה ורפלקציה",
  "תפקיד המדריך ויחסי מדריך-סטודנט",
  "הסטודנט המתקשה ותוכניות התערבות",
  "אתיקה, חוק ובטיחות המטופל"
]);

function verify() {
  const content = fs.readFileSync('questions.js', 'utf8');
  const startIdx = content.indexOf('window.EXAM_QUESTIONS = ') + 'window.EXAM_QUESTIONS = '.length;
  const endIdx = content.lastIndexOf(';');
  const jsonStr = content.slice(startIdx, endIdx).trim();
  
  const questions = JSON.parse(jsonStr);
  console.log(`Loaded ${questions.length} questions from questions.js.`);
  
  const errors = [];
  const seenIds = new Set();
  
  questions.forEach((q, idx) => {
    const qid = q.id;
    if (!qid || seenIds.has(qid)) {
      errors.push(`Q#${idx}: Invalid or duplicate id: ${qid}`);
    }
    seenIds.add(qid);
    
    if (!q.question || q.question.length < 5) {
      errors.push(`Q#${idx} (${qid}): Question text too short or empty`);
    }
    
    const opts = q.options || [];
    if (![3, 4].includes(opts.length)) {
      errors.push(`Q#${idx} (${qid}): Invalid number of options: ${opts.length}`);
    }
    
    const corr = q.correctIndex;
    if (corr === undefined || corr === null || corr < 0 || corr >= opts.length) {
      errors.push(`Q#${idx} (${qid}): Invalid correctIndex: ${corr} for ${opts.length} options`);
    }
    
    const cat = q.category;
    if (!VALID_CATEGORIES.has(cat)) {
      errors.push(`Q#${idx} (${qid}): Invalid category: ${cat}`);
    }
    
    if (!q.explanation) {
      errors.push(`Q#${idx} (${qid}): Missing explanation`);
    }
  });
  
  if (errors.length > 0) {
    console.error(`FAILED with ${errors.length} errors:`);
    errors.slice(0, 10).forEach(e => console.error(" - " + e));
    process.exit(1);
  } else {
    console.log(`SUCCESS! All ${questions.length} questions passed 100% of validation rules!`);
    console.log(`Unique IDs: ${seenIds.size}`);
    console.log(`Categories verified: ${VALID_CATEGORIES.size}`);
  }
}

verify();
