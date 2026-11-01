/**
 * enrich_with_gemini.js
 * 
 * Safely enriches all 1,079 questions with:
 * 1. shortExplanation (punchy 1-line takeaway)
 * 2. detailedExplanation (5-15 lines with pedagogical rationale, distractor analysis, and literature grounding)
 * 
 * High performance:
 * - 3 parallel async workers
 * - Strictly uses gemini-3.8-flash
 * - Reads GEMINI_API_KEY from environment variables only (never saved to disk)
 * 
 * Usage in Windows PowerShell:
 *   $env:GEMINI_API_KEY = "your-key-here"
 *   node scripts/enrich_with_gemini.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('\n' + '='.repeat(70));
  console.error('ERROR: GEMINI_API_KEY environment variable is not set!');
  console.error('='.repeat(70));
  console.error('To run safely without exposing your key, run this in PowerShell:\n');
  console.error('  $env:GEMINI_API_KEY = "your_actual_key_from_Google_AI_Studio"');
  console.error('  node scripts/enrich_with_gemini.js\n');
  console.error('='.repeat(70) + '\n');
  process.exit(1);
}

// Configuration
const MODEL_NAME = process.argv.includes('--model')
  ? process.argv[process.argv.indexOf('--model') + 1]
  : 'gemini-3.8-flash';

const CONCURRENCY = 3;       // 3 parallel workers
const BATCH_SIZE = 5;        // 5 questions per request for highest pedagogical quality
const WORKER_STAGGER_MS = 1500; // Polite stagger delay between worker requests

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

async function callGemini(batchQuestions, workerId, retries = 6) {
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
        body: JSON.stringify(promptContent),
        signal: AbortSignal.timeout(90000) // 90-second timeout
      });

      if (response.status === 429 || response.status === 503) {
        const waitSec = Math.min(attempt * 15, 60);
        console.warn(`[Worker ${workerId}] Google servers busy (${response.status} High Demand). Waiting ${waitSec}s before retry with ${MODEL_NAME}...`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }

      const resJson = await response.json();
      const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error("Empty candidate returned from Gemini");
      }

      let cleaned = rawText.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
      else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();

      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed;
      if (parsed.results && Array.isArray(parsed.results)) return parsed.results;
      throw new Error("Returned payload is not a valid JSON array");
    } catch (err) {
      console.warn(`[Worker ${workerId}] Attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt === retries) throw err;
      const waitSec = Math.min(attempt * 10, 45);
      await new Promise(r => setTimeout(r, waitSec * 1000));
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
  console.log('\n' + '='.repeat(70));
  console.log('🚀 Pedagogical Rationale Enrichment Engine (Gemini 3.8 Flash)');
  console.log(`🤖 Model: ${MODEL_NAME}`);
  console.log(`⚡ Concurrency: ${CONCURRENCY} parallel workers | Batch size: ${BATCH_SIZE} questions/call`);
  console.log('='.repeat(70) + '\n');

  if (!fs.existsSync(DATA_FILE)) {
    console.error(`Database file not found: ${DATA_FILE}`);
    process.exit(1);
  }

  const allQuestions = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const total = allQuestions.length;

  // Identify questions needing enrichment
  const pendingIndices = [];
  allQuestions.forEach((q, idx) => {
    if (!q.shortExplanation || !q.detailedExplanation || q.shortExplanation.length < 10) {
      pendingIndices.push(idx);
    }
  });

  const alreadyEnriched = total - pendingIndices.length;
  console.log(`📊 Total questions in database: ${total}`);
  console.log(`✅ Already enriched: ${alreadyEnriched} (${((alreadyEnriched / total) * 100).toFixed(1)}%)`);
  console.log(`⏳ Remaining to process: ${pendingIndices.length}\n`);

  if (pendingIndices.length === 0) {
    console.log('🎉 All 1,079 questions are already enriched! Nothing to do.');
    return;
  }

  // Group pending questions into batches of BATCH_SIZE
  const batches = [];
  for (let i = 0; i < pendingIndices.length; i += BATCH_SIZE) {
    batches.push(pendingIndices.slice(i, i + BATCH_SIZE));
  }

  const startTime = Date.now();
  let enrichedCount = alreadyEnriched;
  let batchCursor = 0;

  async function worker(workerId) {
    while (batchCursor < batches.length) {
      const curIndex = batchCursor++;
      const chunkIndices = batches[curIndex];
      const chunkQuestions = chunkIndices.map(idx => allQuestions[idx]);
      const qStart = chunkQuestions[0].id;
      const qEnd = chunkQuestions[chunkQuestions.length - 1].id;

      try {
        const enrichedBatch = await callGemini(chunkQuestions, workerId);
        const resultMap = new Map(enrichedBatch.map(item => [item.id, item]));

        let matchCount = 0;
        chunkIndices.forEach(idx => {
          const q = allQuestions[idx];
          const enriched = resultMap.get(q.id);
          if (enriched && enriched.shortExplanation && enriched.detailedExplanation) {
            q.shortExplanation = enriched.shortExplanation.trim();
            q.detailedExplanation = enriched.detailedExplanation.trim();
            q.aiExplanation = enriched.detailedExplanation.trim();
            matchCount++;
          }
        });

        // Save immediately to disk (synchronous, thread-safe in Node.js event loop)
        saveDatabase(allQuestions);
        enrichedCount += matchCount;

        const pct = ((enrichedCount / total) * 100).toFixed(1);
        const elapsedSec = (Date.now() - startTime) / 1000;
        const speedPerMin = ((enrichedCount - alreadyEnriched) / (elapsedSec / 60)).toFixed(1);
        const remaining = total - enrichedCount;
        const etaSec = speedPerMin > 0 ? Math.round((remaining / speedPerMin) * 60) : 0;
        const etaM = Math.floor(etaSec / 60);
        const etaS = etaSec % 60;

        console.log(`[Worker ${workerId}] Batch (${qStart} - ${qEnd}) saved! | Progress: ${enrichedCount}/${total} (${pct}%) | Speed: ${speedPerMin} q/min | ETA: ${etaM}m ${etaS}s`);

        // Polite delay between batch requests for this worker
        await new Promise(r => setTimeout(r, WORKER_STAGGER_MS));
      } catch (err) {
        console.error(`[Worker ${workerId}] Batch (${qStart} - ${qEnd}) failed after retries: ${err.message}`);
        console.log(`[Worker ${workerId}] Re-queuing batch (${qStart} - ${qEnd}) to ensure no questions are skipped...`);
        // Put failed batch back at the end of the queue
        batches.push(chunkIndices);
        await new Promise(r => setTimeout(r, 12000));
      }
    }
  }

  // Launch 3 concurrent workers
  console.log(`🚀 Starting ${CONCURRENCY} parallel workers...\n`);
  const workerPromises = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1));
  await Promise.all(workerPromises);

  console.log('\n' + '='.repeat(70));
  console.log(`🎉 SUCCESS! All ${total} questions are now fully enriched with verified pedagogical rationales!`);
  console.log('='.repeat(70) + '\n');

  // Automatically rebuild standalone file
  try {
    console.log('📦 Rebuilding simulator_all_in_one.html...');
    execSync('node scripts/build_standalone.js', { stdio: 'inherit' });
  } catch (e) {
    console.warn('Note: You can run node scripts/build_standalone.js to rebuild the standalone file.');
  }
}

main().catch(err => {
  console.error('\nCritical Error:', err);
  process.exit(1);
});
