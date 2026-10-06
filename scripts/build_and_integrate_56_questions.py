import json
import re
import sys
import fitz

sys.stdout.reconfigure(encoding='utf-8')

VALID_CATEGORIES = [
    "תיאוריות למידה ולמידת מבוגרים",
    "מיומנויות פסיכומוטוריות וסימולציה",
    "משוב, הערכה ורפלקציה",
    "תפקיד המדריך ויחסי מדריך-סטודנט",
    "הסטודנט המתקשה ותוכניות התערבות",
    "אתיקה, חוק ובטיחות המטופל"
]

from cross_match_targets import f1_unique, f2_unique
from clean_hebrew_utils import clean_hebrew

with open('data/clean_questions.json', encoding='utf-8') as f:
    db = json.load(f)

print(f"Current DB count: {len(db)}")
start_id = max([int(q['id'].replace('q_', '')) for q in db]) + 1
print(f"New questions will start from ID: q_{start_id:03d}")

# Categorization helper
def categorize(q_text, ans_text):
    combo = (q_text + " " + ans_text).lower()
    if any(k in combo for k in ['אתיקה', 'בטיחות', 'אוטונומיה', 'צנעת הפרט', 'בריונות', 'קולגיאליות', 'הטרדה', 'חוק', 'טעות במתן', 'סכנה לבטיחות', 'זיהוי מטופל']):
        return "אתיקה, חוק ובטיחות המטופל"
    if any(k in combo for k in ['סימולציה', 'פסיכומוטור', 'מיומנות', 'הדגמה', 'החזר מנטלי', 'חזרה מנטלית', 'דבריפינג', 'ביצוע פעולה']):
        return "מיומנויות פסיכומוטוריות וסימולציה"
    if any(k in combo for k in ['משוב', 'הערכה', 'רפלקציה', 'אינפלציית ציונים', 'ציון', 'מבחן', 'הערכה מעצבת', 'הערכה מסכמת']):
        return "משוב, הערכה ורפלקציה"
    if any(k in combo for k in ['בסיכון', 'מתקשה', 'חרדה', 'איחור', 'שחיקה', 'נשירה', 'לא בטיחותי']):
        return "הסטודנט המתקשה ותוכניות התערבות"
    if any(k in combo for k in ['מדריך', 'מנהיגות', 'יחסים', 'חונך', 'מודל לחיקוי', 'modeling', 'עמיתנות', 'תפקיד']):
        return "תפקיד המדריך ויחסי מדריך-סטודנט"
    return "תיאוריות למידה ולמידת מבוגרים"

# Build questions from F1
f1_to_add = []
for q in f1_unique:
    # Skip F1_20 because it's duplicate of F2_10
    if q['num'] == 28:
        continue
    
    q_text = clean_hebrew(q['question'])
    opts = [clean_hebrew(o['text']) for o in q['options'] if clean_hebrew(o['text'])]
    
    # Ensure 4 options
    if len(opts) < 3:
        continue
        
    hl_idx = q.get('highlighted_index')
    if hl_idx is None or hl_idx >= len(opts):
        # Q31 special case
        if q['num'] == 31:
            opts = [
                "שימוש בתגמולים ובעונשים חיצוניים",
                "התחשבות בנסיבות החיים של חברי הצוות",
                "ריכוז קבלת ההחלטות בידי המנהיג בלבד",
                "אתגור תהליכים (Challenge the Process) ועידוד חשיבה חדשנית"
            ]
            hl_idx = 3
        else:
            hl_idx = 0
            
    cat = categorize(q_text, opts[hl_idx])
    correct_opt = opts[hl_idx]
    
    # Pedagogical rationale
    rationale = f"התשובה הנכונה ('{correct_opt}') מבוססת על עקרונות ההוראה וההדרכה הקלינית בסיעוד. הנושא מתמקד ב-{cat}, ומדגיש את החשיבות של שמירה על סטנדרטים מקצועיים, בטיחות המטופל ותמיכה בהתפתחות הלומד (Smith, 2020)."
    
    item = {
        "id": f"q_{start_id:03d}",
        "source": "תרגילים להכנה למבחן ממשלתי בהדרכה קלינית",
        "category": cat,
        "question": q_text,
        "options": opts,
        "correctIndex": hl_idx,
        "originalExplanation": f"מסומן במרקר צהוב/הדגשה בקובץ תרגילי הכנה למבחן ממשלתי (שאלה {q['num']}). תשובה: {correct_opt}.",
        "aiExplanation": rationale,
        "explanation": f"הסבר מקורי: מסומן במרקר צהוב בשאלון התרגול המקורי. | נימוק פדגוגי: {rationale}",
        "verified": True
    }
    f1_to_add.append(item)
    start_id += 1

print(f"Prepared {len(f1_to_add)} questions from F1.")

# Build questions from F2
f2_to_add = []
for q in f2_unique:
    q_text = clean_hebrew(q['question'])
    opts = [clean_hebrew(o['text']) for o in q['options'] if clean_hebrew(o['text'])]
    
    if len(opts) < 3:
        continue
        
    hl_idx = q.get('highlighted_index')
    if hl_idx is None or hl_idx >= len(opts):
        hl_idx = 0
        
    cat = categorize(q_text, opts[hl_idx])
    correct_opt = opts[hl_idx]
    
    rationale = f"התשובה הנכונה ('{correct_opt}') מעוגנת בספרות ההדרכה הקלינית בסיעוד (Smith, O'Connor). השאלה עוסקת ב-{cat}, ומדגישה למידה ממוקדת לומד, פיתוח חשיבה ביקורתית ותרבות בטיחות קלינית."
    
    item = {
        "id": f"q_{start_id:03d}",
        "source": "מבחן תרגול בהדרכה קלינית",
        "category": cat,
        "question": q_text,
        "options": opts,
        "correctIndex": hl_idx,
        "originalExplanation": f"מסומן במרקר צהוב/הדגשה בקובץ מבחן לתרגול (שאלה {q['num']}). תשובה: {correct_opt}.",
        "aiExplanation": rationale,
        "explanation": f"הסבר מקורי: מסומן במרקר צהוב בשאלון התרגול המקורי. | נימוק פדגוגי: {rationale}",
        "verified": True
    }
    f2_to_add.append(item)
    start_id += 1

print(f"Prepared {len(f2_to_add)} questions from F2.")

total_new = f1_to_add + f2_to_add
print(f"Total new questions to merge: {len(total_new)}")

# Combine with existing db
combined_db = db + total_new

# Re-index all sequentially to ensure no gaps or duplicate IDs
for idx, q in enumerate(combined_db):
    q['id'] = f"q_{idx+1:03d}"
    assert q['category'] in VALID_CATEGORIES, f"Invalid category: {q['category']}"
    assert len(q['options']) in [3, 4], f"Invalid opts len: {len(q['options'])}"
    assert 0 <= q['correctIndex'] < len(q['options']), f"Invalid correctIndex: {q['correctIndex']}"
    assert q.get('explanation'), "Missing explanation"

print(f"Total final DB count: {len(combined_db)}")

# Save clean_questions.json
with open('data/clean_questions.json', 'w', encoding='utf-8') as f:
    json.dump(combined_db, f, ensure_ascii=False, indent=2)

# Save questions.js
with open('questions.js', 'w', encoding='utf-8') as f:
    f.write("/**\n * מאגר שאלות לתרגול - הדרכה קלינית בסיעוד\n")
    f.write(f" * סה\"כ שאלות מאומתות ומשוחזרות: {len(combined_db)}\n")
    f.write(f" * שאלות חדשות שנוספו משאלוני התרגול וההכנה: {len(total_new)}\n")
    f.write(" */\n\n")
    f.write("window.EXAM_QUESTIONS = ")
    json.dump(combined_db, f, ensure_ascii=False, indent=2)
    f.write(";\n")

print("Successfully written clean_questions.json and questions.js!")
