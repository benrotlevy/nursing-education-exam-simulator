const fs = require('fs');

// 1. Update data/clean_questions.json
const cleanPath = 'data/clean_questions.json';
const questions = JSON.parse(fs.readFileSync(cleanPath, 'utf8'));

let targetQ = null;
questions.forEach(q => {
  if (q.id === 'q_606') {
    targetQ = q;
    q.question = 'מגע, הבעות פנים, שפת גוף ושפה פשוטה הם דוגמאות ל:';
    q.correctIndex = 1; // 'תקשורת מילולית ובלתי מילולית .'
    q.verified = true;
    q.originalExplanation = "סומן במקור במרקר צהוב: 'תקשורת מילולית ובלתי מילולית .'";
    q.aiExplanation = "ההגדרה בשאלה משלבת שני אפיקי תקשורת מרכזיים בהדרכה ובטיפול:\n1. תקשורת בלתי מילולית: מגע, הבעות פנים ושפת גוף (קשר עין, מנח גוף).\n2. תקשורת מילולית: שימוש במילים, כולל שפה פשוטה וברורה המותאמת להבנת המטופל/הסטודנט.\nלכן יחד הם דוגמאות לתקשורת מילולית ובלתי מילולית.";
    q.explanation = "התשובה הנכונה: 'תקשורת מילולית ובלתי מילולית .'. השאלה משלבת מרכיבים בלתי-מילוליים (מגע, הבעות פנים, שפת גוף) יחד עם מרכיב מילולי (שפה פשוטה וברורה).";
  }
});

if (!targetQ) {
  console.error("Error: q_606 not found in clean_questions.json!");
  process.exit(1);
}

fs.writeFileSync(cleanPath, JSON.stringify(questions, null, 2), 'utf8');
console.log("Updated data/clean_questions.json for q_606.");

// 2. Update questions.js
const jsContent = 'window.EXAM_QUESTIONS = ' + JSON.stringify(questions, null, 2) + ';\n';
fs.writeFileSync('questions.js', jsContent, 'utf8');
console.log("Updated questions.js for q_606.");

// 3. Update data/all_pdf_questions.json if present
try {
  const allPdfPath = 'data/all_pdf_questions.json';
  if (fs.existsSync(allPdfPath)) {
    const allPdf = JSON.parse(fs.readFileSync(allPdfPath, 'utf8'));
    allPdf.forEach(q => {
      if (q.id === 'q_0653' || (q.question && q.question.includes('שפה פשוטה'))) {
        q.question = 'מגע, הבעות פנים, שפת גוף ושפה פשוטה הם דוגמאות ל:';
        q.correctIndex = 1;
        q.explanation = "התשובה הנכונה היא: 'תקשורת מילולית ובלתי מילולית .'.";
      }
    });
    fs.writeFileSync(allPdfPath, JSON.stringify(allPdf, null, 2), 'utf8');
    console.log("Updated data/all_pdf_questions.json.");
  }
} catch (e) {
  console.warn("Could not update all_pdf_questions:", e.message);
}

// 4. Update simulator_all_in_one.html
const htmlPath = 'index.html';
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const targetScript = '<script src="questions.js"></script>';
if (htmlContent.includes(targetScript)) {
  const standalone = htmlContent.replace(targetScript, '<script>\n' + jsContent + '\n</script>');
  fs.writeFileSync('simulator_all_in_one.html', standalone, 'utf8');
  console.log("Regenerated simulator_all_in_one.html (" + standalone.length + " bytes).");
} else {
  console.error("Warning: targetScript not found in index.html, simulator_all_in_one.html not regenerated.");
}
