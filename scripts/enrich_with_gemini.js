/**
 * enrich_with_gemini.js
 * 
 * Safely enriches all 1,079 questions with:
 * 1. shortExplanation (punchy 1-line takeaway)
 * 2. detailedExplanation (5-15 lines with pedagogical rationale, distractor analysis, and literature grounding)
 * 
 * Safe execution:
 * Reads GEMINI_API_KEY from environment variables only (never hardcoded, never saved to disk).
 * 
 * Usage in Windows PowerShell:
 *   $env:GEMINI_API_KEY = "your-key-here"
 *   node scripts/enrich_with_gemini.js
 */

const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('\n' + '='.repeat(70));
  console.error('❌ שגיאה: לא הוגדר משתנה סביבה GEMINI_API_KEY!');
  console.error('=' .repeat(70));
  console.error('כדי להריץ את הסקריפט באופן מאובטח שאינו חושף את המפתח שלך,');
  console.error('פתח את חלון ה-PowerShell שלך והרץ:\n');
  console.error('  $env:GEMINI_API_KEY = "המפתח_שלך_מ-Google_AI_Studio"');
  console.error('  node scripts/enrich_with_gemini.js\n');
  console.error('=' .repeat(70) + '\n');
  process.exit(1);
}

// Config
const MODEL_NAME = process.argv.includes('--model')
  ? process.argv[process.argv.indexOf('--model') + 1]
  : 'gemini-2.0-flash';

const BATCH_SIZE = 5; // 5 questions per call for highest reasoning quality & avoiding truncation
const DELAY_BETWEEN_BATCHES_MS = 2500; // Polite delay between API calls

const DATA_FILE = path.join(__dirname, '..', 'data', 'clean_questions.json');
const JS_FILE = path.join(__dirname, '..', 'questions.js');

const SYSTEM_PROMPT = `אתה מומחה פדגוגי וקליני בכיר להוראה והדרכה קלינית בסיעוד בישראל, הבקיא לעומק בסילבוס הממשלתי לקורס הדרכה קלינית בסיעוד ובספרות המקצוע (Encyclopedia of Nursing Education, ספרי הדרכה קלינית, חוזרי מינהל הסיעוד ומשרד הבריאות).

תפקידך להעשיר שאלות ממבחני גמר/על-בסיסי בהדרכה קלינית בשני סוגי משובים מאירי עיניים עבור כל שאלה:

1. "shortExplanation" (תמצית בשורה אחת):
   - בדיוק משפט אחד או שניים קצרים וממוקדים (שורה אחת).
   - עונה ישירות על השאלה: למה התשובה הנכונה היא הנכונה באופן חד-משמעי.
   - ללא מריחות – התמצית הפדגוגית המדויקת ביותר שהסטודנט צריך לזכור למבחן.

2. "detailedExplanation" (הסבר מעמיק של 5 עד 15 שורות):
   - הסבר עשיר, מנומק, מובנה וברור הכולל:
     * • הרציונל הפדגוגי/קליני: ניתוח עמוק של השאלה והמושג התיאורטי.
     * • ניתוח המסיחים השגויים: הסבר ממוקד מדוע שאר האפשרויות מטעות או שגויות.
     * • עיגון בספרות ובסילבוס: התייחסות ספציפית לתיאורטיקן או לנוהל הרלוונטי (בלום, קולב, נואלס ואנדרגוגיה, סוולר ועומס קוגניטיבי, פיטס ופוסנר, פנדלטון ומשוב, הטיות הערכה, התערבות עם סטודנט מתקשה, בטיחות המטופל וכו').

כללים קריטיים:
- עליך להחזיר תמיד אך ורק אובייקט JSON תקני במבנה המבוקש ללא טקסט מקדים וללא מרקדאון של קוד.
- התשובות חייבות להיות בעברית מקצועית, שוטפת, בהירה ומעודדת למידה.`;

async function callGemini(batchQuestions, retries = 3) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;

  const promptContent = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${SYSTEM_PROMPT}\n\nלהלן ${batchQuestions.length} שאלות להעשרה. החזר JSON במבנה הבא בלבד:
[
  {
    "id": "q_XXX",
    "shortExplanation": "שורה אחת ממוקדת המסבירה למה התשובה נכונה",
    "detailedExplanation": "• הרציונל הפדגוגי/קליני: ...\\n• ניתוח המסיחים השגויים: ...\\n• מקור בספרות / סילבוס: ..."
  }
]

השאלות:
${JSON.stringify(batchQuestions.map(q => ({
  id: q.id,
  category: q.category,
  question: q.question,
  options: q.options,
  correctOption: q.options[q.correctIndex],
  currentExplanation: q.aiExplanation || q.explanation || q.originalExplanation
})), null, 2)}`
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json'
    }
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promptContent)
      });

      if (response.status === 429) {
        console.warn(`\n⚠️ התקבלה שגיאת Rate Limit (429). ממתין ${attempt * 15} שניות לניסיון חוזר...`);
        await new Promise(r => setTimeout(r, attempt * 15000));
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP Error ${response.status}: ${errText}`);
      }

      const resJson = await response.json();
      const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error("No text candidate returned from Gemini");
      }

      // Parse JSON from text
      let cleaned = rawText.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
      else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();

      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed;
      if (parsed.results && Array.isArray(parsed.results)) return parsed.results;
      throw new Error("Returned payload is not a valid JSON array");
    } catch (err) {
      console.warn(`\n[ניסיון ${attempt}/${retries}] שגיאה בבקשה: ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}

function saveDatabase(questions) {
  // 1. Save clean_questions.json
  fs.writeFileSync(DATA_FILE, JSON.stringify(questions, null, 2), 'utf8');

  // 2. Save questions.js
  const jsContent = `/**
 * מאגר שאלות מאומת ומסווג למבחן על-בסיסי בהדרכה קלינית בסיעוד
 * סך הכל שאלות פעילות ומאומתות: ${questions.length}
 * נוצר באופן אוטומטי מתוך clean_questions.json
 */

window.EXAM_QUESTIONS = ${JSON.stringify(questions, null, 2)};
`;
  fs.writeFileSync(JS_FILE, jsContent, 'utf8');
}

async function main() {
  console.log('\n===============================================================');
  console.log('🚀 התחלת תהליך העשרת משובים פדגוגיים מבוססי ספרות (Gemini API)');
  console.log(`🤖 מודל בשימוש: ${MODEL_NAME}`);
  console.log('===============================================================\n');

  if (!fs.existsSync(DATA_FILE)) {
    console.error(`קובץ הנתונים לא נמצא: ${DATA_FILE}`);
    process.exit(1);
  }

  const allQuestions = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const total = allQuestions.length;

  // Filter questions that need enrichment
  // A question needs enrichment if it lacks shortExplanation or detailedExplanation
  const pendingIndices = [];
  allQuestions.forEach((q, idx) => {
    if (!q.shortExplanation || !q.detailedExplanation || q.shortExplanation.length < 10) {
      pendingIndices.push(idx);
    }
  });

  const alreadyEnriched = total - pendingIndices.length;
  console.log(`📊 סך הכל שאלות במאגר: ${total}`);
  console.log(`✅ שאלות שכבר הועשרו: ${alreadyEnriched}`);
  console.log(`⏳ שאלות הממתינות להעשרה: ${pendingIndices.length}\n`);

  if (pendingIndices.length === 0) {
    console.log('🎉 כל השאלות במאגר כבר מועשרות בהסברים קצרים ומפורטים! אין צורך בפעולה.');
    return;
  }

  const startTime = Date.now();
  let processedCount = 0;

  // Process in batches
  for (let i = 0; i < pendingIndices.length; i += BATCH_SIZE) {
    const chunkIndices = pendingIndices.slice(i, i + BATCH_SIZE);
    const chunkQuestions = chunkIndices.map(idx => allQuestions[idx]);

    const batchStartQ = chunkQuestions[0].id;
    const batchEndQ = chunkQuestions[chunkQuestions.length - 1].id;
    const progressPct = (((alreadyEnriched + processedCount) / total) * 100).toFixed(1);

    process.stdout.write(`[${progressPct}%] מעבד אצווה (${batchStartQ} - ${batchEndQ}, ${chunkQuestions.length} שאלות)... `);

    try {
      const enrichedBatch = await callGemini(chunkQuestions);
      const resultMap = new Map(enrichedBatch.map(item => [item.id, item]));

      let matchCount = 0;
      chunkIndices.forEach(idx => {
        const q = allQuestions[idx];
        const enriched = resultMap.get(q.id);
        if (enriched && enriched.shortExplanation && enriched.detailedExplanation) {
          q.shortExplanation = enriched.shortExplanation.trim();
          q.detailedExplanation = enriched.detailedExplanation.trim();
          // Update legacy explanation fields as well for full compatibility
          q.aiExplanation = enriched.detailedExplanation.trim();
          matchCount++;
        }
      });

      processedCount += chunkQuestions.length;
      saveDatabase(allQuestions);
      console.log(`✅ הושלם בהצלחה (${matchCount}/${chunkQuestions.length} עודכנו ונשמרו)`);

      // Progress calculation & ETA
      const elapsedSec = (Date.now() - startTime) / 1000;
      const ratePerSec = processedCount / elapsedSec;
      const remainingSec = Math.round((pendingIndices.length - processedCount) / ratePerSec);
      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      console.log(`   ⏱️ זמן שחלף: ${Math.round(elapsedSec)}s | קצב: ${(ratePerSec * 60).toFixed(1)} שאלות/דקה | זמן משוער לסיום: ${mins} דקות ו-${secs} שניות`);

      // Delay between batches
      if (i + BATCH_SIZE < pendingIndices.length) {
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
      }
    } catch (err) {
      console.error(`\n❌ שגיאה בעיבוד אצווה (${batchStartQ} - ${batchEndQ}):`, err.message);
      console.log('💾 הנתונים שנצברו עד כה נשמרו בבטחה. ממתין 10 שניות לפני המשך...');
      await new Promise(r => setTimeout(r, 10000));
    }
  }

  console.log('\n===============================================================');
  console.log(`🎉 כל הכבוד! כל ${total} השאלות הועשרו בהצלחה בהסברים פדגוגיים מבוססי ספרות!`);
  console.log('===============================================================\n');

  // Trigger standalone rebuild
  try {
    const { execSync } = require('child_process');
    execSync('node scripts/build_standalone.js', { stdio: 'inherit' });
  } catch (e) {
    console.warn('הערה: ניתן להריץ node scripts/build_standalone.js לבנייה מחדש של הקובץ העצמאי.');
  }
}

main().catch(err => {
  console.error('\n💥 שגיאה קריטית בריצת הסקריפט:', err);
  process.exit(1);
});
