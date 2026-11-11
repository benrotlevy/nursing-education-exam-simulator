/**
 * Study Mode AI Prompt Formatter (`app/js/domain/ai-prompt.js`)
 * Generates the structured Hebrew consultation prompt for external LLMs (STUDY-05).
 */

const LETTERS = ['א', 'ב', 'ג', 'ד', 'ה'];

/**
 * Formats a question and its currently displayed (shuffled) options into a structured
 * Hebrew prompt grounded in the Israeli Ministry of Health Nursing Administration syllabus.
 * @param {{ category?: string, source?: string, question: string }} question
 * @param {string[]} displayedOptions
 * @returns {string}
 */
export function formatQuestionForAI(question, displayedOptions = []) {
  const formattedOptions = displayedOptions
    .map((opt, idx) => `  ${LETTERS[idx] || idx + 1}. ${opt}`)
    .join('\n');

  return `שלום! אני לומד/ת למבחן ההסמכה הממשלתי בהדרכה קלינית בסיעוד של משרד הבריאות (מנהל הסיעוד בישראל).
אשמח לעזרתך כמומחה בכיר בהדרכה קלינית בסיעוד בניתוח השאלה הבאה מתוך מבחני ההסמכה.

═══════════════════════════════════════════════════════════════
📌 פרטי השאלה:
• תחום / קטגוריה: ${question.category || 'הדרכה קלינית בסיעוד'}
• מקור: ${question.source || 'שחזור מבחן ממשלתי'}
═══════════════════════════════════════════════════════════════

❓ גוף השאלה:
${question.question}

📋 אפשרויות התשובה:
${formattedOptions}

═══════════════════════════════════════════════════════════════
🎯 הנחיות למענה:
אנא בסס את תשובתך על סילבוס מנהל הסיעוד וספרות החובה הרשמית (ספרו של רמי אבירם, Bastable, Billings & Halstead, הטקסונומיה של בלום, מעגל הלמידה של קולב, מודל השיפוט הקליני של טאנר, חוזרי מנהל הסיעוד וקוד האתיקה לאחיות בישראל).

אנא הצג את תשובתך במבנה הברור הבא:
1. ✅ התשובה הנכונה ביותר: (ציין את אות התשובה ואת ניסוחה המדויק).
2. 🎯 הרציונל הפדגוגי/קליני המעמיק: (הסבר מעמיק של העיקרון הפדגוגי המנחה, מדוע פעולה זו נדרשת מהמדריך הקליני, וכיצד היא מקדמת את למידת הסטודנט ובטיחות המטופל).
3. 🔍 ניתוח ביקורתי של כל אחד מהמסיחים השגויים: (הסבר מפורט לכל מסיח בנפרד – מדוע אינו נכון, מה הפגם בגישה זו או מדוע הוא פחות מתאים).
4. 📚 עיגון בספרות ובסילבוס: (קישור לתיאוריה, לפרק בספרות המקצועית או להנחיית משרד הבריאות הרלוונטית).
═══════════════════════════════════════════════════════════════`;
}
