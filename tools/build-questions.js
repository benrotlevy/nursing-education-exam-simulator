/**
 * Compiles `data-pipeline/source/clean_questions.json` into the slimmed,
 * schema-validated runtime dataset `app/data/questions.json`.
 *
 * Usage:
 *   node tools/build-questions.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

export const VALID_CATEGORIES = [
  'תיאוריות למידה ולמידת מבוגרים',
  'מיומנויות פסיכומוטוריות וסימולציה',
  'משוב, הערכה ורפלקציה',
  'תפקיד המדריך ויחסי מדריך-סטודנט',
  'הסטודנט המתקשה ותוכניות התערבות',
  'אתיקה, חוק ובטיחות המטופל',
];

export function stripLiteratureLine(detailedText) {
  if (!detailedText) return '';
  return detailedText.replace(/\n?\s*•?\s*(?:מקור|עיגון) בספרות[^\n:]*:[\s\S]*$/i, '').trim();
}

export function normalizeOrigExplanation(origText) {
  if (!origText || typeof origText !== 'string') return undefined;
  const trimmed = origText.trim();
  if (!trimmed || trimmed.startsWith('התשובה הנכונה היא:')) {
    return undefined;
  }
  return trimmed;
}

export function compileQuestionsDataset(sourceQuestions) {
  if (!Array.isArray(sourceQuestions)) {
    throw new Error('Source dataset must be an array of question objects');
  }

  const seenIds = new Set();
  const validCategorySet = new Set(VALID_CATEGORIES);

  const compiled = sourceQuestions.map((raw, idx) => {
    if (!raw.id || !/^q_\d{3,4}$/.test(raw.id)) {
      throw new Error(`Invalid question id at index ${idx}: ${raw.id}`);
    }
    if (seenIds.has(raw.id)) {
      throw new Error(`Duplicate question id: ${raw.id}`);
    }
    seenIds.add(raw.id);

    if (!validCategorySet.has(raw.category)) {
      throw new Error(`Invalid category on ${raw.id}: ${raw.category}`);
    }
    if (!Array.isArray(raw.options) || raw.options.length < 3 || raw.options.length > 4) {
      throw new Error(`Invalid options count on ${raw.id}`);
    }
    if (
      typeof raw.correctIndex !== 'number' ||
      raw.correctIndex < 0 ||
      raw.correctIndex >= raw.options.length
    ) {
      throw new Error(`Invalid correctIndex on ${raw.id}: ${raw.correctIndex}`);
    }
    if (!raw.shortExplanation || !raw.detailedExplanation) {
      throw new Error(`Missing shortExplanation or detailedExplanation on ${raw.id}`);
    }
    if (raw.aiExplanation && raw.aiExplanation !== raw.detailedExplanation) {
      throw new Error(`aiExplanation differs from detailedExplanation on ${raw.id}`);
    }

    const questionItem = {
      id: raw.id,
      source: String(raw.source || '').trim(),
      category: raw.category,
      question: String(raw.question || '').trim(),
      options: raw.options.map((opt) => String(opt).trim()),
      correctIndex: raw.correctIndex,
      verified: Boolean(raw.verified),
      shortExplanation: String(raw.shortExplanation).trim(),
      detailedExplanation: stripLiteratureLine(raw.detailedExplanation),
    };

    const orig = normalizeOrigExplanation(raw.originalExplanation);
    if (orig) {
      questionItem.originalExplanation = orig;
    }

    return questionItem;
  });

  return {
    schemaVersion: 2,
    totalQuestions: compiled.length,
    questions: compiled,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const sourcePath = path.join(repoRoot, 'data-pipeline', 'source', 'clean_questions.json');
  const outDir = path.join(repoRoot, 'app', 'data');
  const outPath = path.join(outDir, 'questions.json');

  const rawText = fs.readFileSync(sourcePath, 'utf8');
  const sourceQuestions = JSON.parse(rawText);
  const compiledPayload = compileQuestionsDataset(sourceQuestions);

  fs.mkdirSync(outDir, { recursive: true });
  const jsonOutput = JSON.stringify(compiledPayload, null, 2) + '\n';
  fs.writeFileSync(outPath, jsonOutput, 'utf8');

  const oldBytes = Buffer.byteLength(rawText, 'utf8');
  const newBytes = Buffer.byteLength(jsonOutput, 'utf8');
  const savedKb = Math.round((oldBytes - newBytes) / 1024);

  console.log(
    `Built app/data/questions.json: ${compiledPayload.totalQuestions} questions (${Math.round(
      newBytes / 1024
    )} KB, saved ${savedKb} KB vs source)`
  );
}
