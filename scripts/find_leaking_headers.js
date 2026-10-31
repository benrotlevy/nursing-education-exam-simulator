const fs = require('fs');
const qs = JSON.parse(fs.readFileSync('data/clean_questions.json', 'utf8'));

const results = [];

qs.forEach(q => {
  const oe = q.originalExplanation || '';
  if (oe.includes('מבחן') || oe.includes('שחזור')) {
    // Find index of 'מבחן'
    const idx = Math.max(oe.lastIndexOf('מבחן'), oe.lastIndexOf('שחזור'));
    if (idx > 10) { // not right at the start
      const after = oe.slice(idx);
      results.push({
        id: q.id,
        after: after,
        tail: oe.slice(-60)
      });
    }
  }
});

console.log("Found matches:", results.length);
results.forEach(r => console.log(r.id, "-->", JSON.stringify(r.after)));
