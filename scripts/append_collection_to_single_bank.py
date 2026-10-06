import json
import re
import sys
from clean_hebrew_utils import clean_hebrew

sys.stdout.reconfigure(encoding='utf-8')

# 1. Load current single answer db
with open('data/single_answer_raw_questions.json', 'r', encoding='utf-8') as f:
    current_single = json.load(f)

print(f"Current single answer questions: {len(current_single)}")

# 2. Load unique collection items
with open('data/collection_unique_items.json', 'r', encoding='utf-8') as f:
    unique_items = json.load(f)

single_candidates = [it for it in unique_items if it['opt_count'] <= 1]
print(f"Found {len(single_candidates)} unique single-answer candidates in collection")

def detect_category(q_text, a_text):
    combined = q_text + " " + a_text
    if any(k in combined for k in ["בנר", "נואלס", "אנדרגוגיה", "קולב", "בלום", "דייב", "ביהביוריסט", "קוגניטיב", "מבוגרים"]):
        return "תיאוריות למידה ולמידת מבוגרים"
    elif any(k in combined for k in ["סימולצי", "פסיכו מוטור", "פסיכומוטור", "תחקיר", "Debriefing", "דמה", "מיומנות"]):
        return "מיומנויות פסיכומוטוריות וסימולציה"
    elif any(k in combined for k in ["משוב", "הערכה", "רפלקצי", "מבחן", "ציון", "פורמטיב", "סומטיב"]):
        return "משוב, הערכה ורפלקציה"
    elif any(k in combined for k in ["מדריך", "תפקיד", "מוטיבצי", "יחסים", "חרדה", "סמכות", "מנהיג"]):
        return "תפקיד המדריך ויחסי מדריך-סטודנט"
    elif any(k in combined for k in ["מתקשה", "נכשל", "התערבות", "סיכון", "לקות", "חרדה"]):
        return "הסטודנט המתקשה ותוכניות התערבות"
    elif any(k in combined for k in ["אתיק", "חוק", "בטיחות", "סודיות", "זכויות", "טעות"]):
        return "אתיקה, חוק ובטיחות המטופל"
    else:
        return "הדרכה קלינית כללי"

new_entries = []
for idx, it in enumerate(single_candidates):
    q_clean = clean_hebrew(it['question'])
    # clean leading ) or ?
    q_clean = re.sub(r'^[?\)\.\s]+', '', q_clean).strip()
    if not q_clean.endswith('?') and not q_clean.endswith(':'):
        q_clean += '?'
    
    a_clean = clean_hebrew(it['answer'])
    a_clean = re.sub(r'^\s*[\.]?\s*', '', a_clean).strip()
    
    cat = detect_category(q_clean, a_clean)
    loc = f"עמוד {it['page']} ({it['section']} - שאלה {it['num']})"
    
    entry = {
        "id": f"single_coll_{idx+1:03d}",
        "sourceFile": "raw_materials/exams/אוסף שחזורים.pdf",
        "sourceLocation": loc,
        "question": q_clean,
        "knownAnswer": a_clean,
        "category": cat,
        "notes": "שחזור שאלת מבחן הכולל שאלה ותשובה נכונה משוחזרת בלבד ללא מסיחים"
    }
    new_entries.append(entry)

print(f"Generated {len(new_entries)} clean single answer entries")

# Combine and save
updated_single = current_single + new_entries
with open('data/single_answer_raw_questions.json', 'w', encoding='utf-8') as f:
    json.dump(updated_single, f, ensure_ascii=False, indent=2)

print(f"Total single-answer questions now: {len(updated_single)}")

# 3. Regenerate docs/single_answer_questions.md
md_lines = [
    "# מאגר שאלות עם תשובה אחת בלבד (שאלות שחזור ללא מסיחים)",
    "",
    "קובץ זה מתעד שאלות שחזור מתוך מבחני עבר וסיכומי סטודנטים הכוללות **שאלה ותשובה נכונה אחת בלבד** (ללא מסיחים / אפשרויות שגויות).",
    "",
    "שאלות אלו **אינן נכללות במאגר הסימולציה הראשי** (`questions.js`) כדי לשמור על תקינות מבחן אמריקאי מלא (3-4 מסיחים), אך נשמרות ומתועדות כאן כדי שבעתיד ניתן יהיה לבנות עבורן מסיחים מקצועיים ולשלבן במאגר.",
    "",
    f"**סך הכל שאלות במאגר:** {len(updated_single)} שאלות.",
    "",
    "---",
    "",
    "## התפלגות לפי מקורות",
    "",
    f"- **שחזור מבחן מאי (שחזור מבחן מאי הדרכה קלינית.docx)**: {sum(1 for q in updated_single if 'מאי' in q['sourceFile'])} שאלות",
    f"- **שחזור מבחן אמצע (שחזור מבחן אמצע הדרכה קלינית 06.docx)**: {sum(1 for q in updated_single if 'אמצע' in q['sourceFile'])} שאלות",
    f"- **שחזור ממשלתי 2024 (שחזור ממשלתי הדרכה קלינית 2024.pdf)**: {sum(1 for q in updated_single if '2024' in q['sourceFile'])} שאלות",
    f"- **אוסף שחזורים (אוסף שחזורים.pdf)**: {sum(1 for q in updated_single if 'אוסף' in q['sourceFile'])} שאלות",
    "",
    "---",
    "",
    "## טבלת שאלות שחזור לפי קטגוריות",
    ""
]

# Group by category
by_cat = {}
for q in updated_single:
    cat = q.get('category', 'כללי')
    if cat not in by_cat:
        by_cat[cat] = []
    by_cat[cat].append(q)

for cat, qs in sorted(by_cat.items()):
    md_lines.append(f"### {cat} ({len(qs)} שאלות)")
    md_lines.append("")
    md_lines.append("| מזהה | שאלה | תשובה ידועה | מקור ומיקום |")
    md_lines.append("|---|---|---|---|")
    for q in qs:
        q_text = q['question'].replace('|', '/')
        a_text = q['knownAnswer'].replace('|', '/')
        loc = q['sourceLocation'].replace('|', '/')
        md_lines.append(f"| `{q['id']}` | {q_text} | {a_text} | {loc} |")
    md_lines.append("")

with open('docs/single_answer_questions.md', 'w', encoding='utf-8') as f:
    f.write('\n'.join(md_lines))

print(f"Saved updated docs/single_answer_questions.md with {len(updated_single)} questions!")
