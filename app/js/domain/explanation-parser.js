/**
 * Explanation Parser Domain (`app/js/domain/explanation-parser.js`)
 * Parses structured clinical rationale & distractor breakdowns and strips any
 * internal syllabus/literature citations (STUDY-04).
 */

/**
 * Parses a detailed explanation string into structured `rationale` and `distractors` array.
 * @param {string} detailedText
 * @returns {{ rationale: string, distractors: string[] }}
 */
export function parseExplanationComponents(detailedText) {
  if (!detailedText || typeof detailedText !== 'string') {
    return { rationale: '', distractors: [] };
  }

  let rationale = '';
  let distractorRaw = '';

  const ratMatch = detailedText.match(
    /•?\s*הרציונל[^\n:]*:\s*([\s\S]*?)(?=•?\s*ניתוח המסיחים|•?\s*(מקור|עיגון) בספרות|$)/
  );
  if (ratMatch) {
    rationale = ratMatch[1].trim();
  }

  const distMatch = detailedText.match(
    /•?\s*ניתוח המסיחים[^\n:]*:\s*([\s\S]*?)(?=•?\s*(מקור|עיגון) בספרות|$)/
  );
  if (distMatch) {
    distractorRaw = distMatch[1].trim();
  }

  if (!rationale && !distractorRaw) {
    const clean = detailedText.replace(/•?\s*(מקור בספרות|עיגון בספרות|סילבוס)[^\n]*/gi, '').trim();
    return { rationale: clean, distractors: [] };
  }

  let distractors = [];
  if (distractorRaw) {
    if (distractorRaw.includes('\n-') || distractorRaw.startsWith('-')) {
      distractors = distractorRaw
        .split(/\n?-\s+/)
        .map((d) => d.trim())
        .filter((d) => d.length > 1);
    } else if (distractorRaw.includes(';')) {
      distractors = distractorRaw
        .split(';')
        .map((d) => d.trim())
        .filter((d) => d.length > 1);
    } else if (distractorRaw.includes('. ') || distractorRaw.includes('.\n')) {
      distractors = distractorRaw
        .split(/(?<=\.)\s+/)
        .map((d) => d.trim())
        .filter((d) => d.length > 1);
    } else {
      distractors = [distractorRaw];
    }
  }

  return { rationale, distractors };
}

/**
 * Extracts a normalized view-model for rendering a question's explanation card.
 * @param {Object} question
 */
export function extractExplanationViewModel(question = {}) {
  const shortText =
    question.shortExplanation ||
    (question.aiExplanation ? question.aiExplanation.split('\n')[0] : question.explanation) ||
    'התשובה המסומנת היא התשובה הנכונה.';
  const detailedText =
    question.detailedExplanation || question.aiExplanation || question.explanation || '';
  const origText =
    question.originalExplanation &&
    question.originalExplanation.trim() &&
    !question.originalExplanation.startsWith('התשובה הנכונה היא:')
      ? question.originalExplanation.trim()
      : null;

  const hasDetails = Boolean(detailedText && detailedText.trim() !== shortText.trim());
  const parsed = hasDetails
    ? parseExplanationComponents(detailedText)
    : { rationale: '', distractors: [] };

  return {
    shortText,
    detailedText,
    hasDetails,
    rationale: parsed.rationale,
    distractors: parsed.distractors,
    origText,
  };
}
