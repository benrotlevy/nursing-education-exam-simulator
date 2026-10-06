# Encoding: utf-8
"""
Integration script to merge:
- 100 questions from Halil 2023 Exam (q_967 to q_1066)
- 13 full MCQs from 2021 Exam (q_1067 to q_1079)
Into data/clean_questions.json and questions.js

And append:
- 21 recall items from 2021 Exam
Into data/single_answer_raw_questions.json and docs/single_answer_questions.md
"""
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

sys.path.append('scripts')
from halil_data_part1 import HALIL_PART1
from halil_data_part2 import HALIL_PART2
from exam_2021_data import EXAM_2021_MCQS, EXAM_2021_RECALL_ITEMS

VALID_CATEGORIES = {
    "תיאוריות למידה ולמידת מבוגרים",
    "מיומנויות פסיכומוטוריות וסימולציה",
    "משוב, הערכה ורפלקציה",
    "תפקיד המדריך ויחסי מדריך-סטודנט",
    "הסטודנט המתקשה ותוכניות התערבות",
    "אתיקה, חוק ובטיחות המטופל"
}

def run_integration():
    # 1. Load current questions
    with open('data/clean_questions.json', 'r', encoding='utf-8') as f:
        db = json.load(f)
    
    current_count = len(db)
    print(f"Current DB question count: {current_count}")
    
    # 2. Add Halil 2023 (100 questions)
    next_id_num = current_count + 1
    added_halil = 0
    for q in HALIL_PART1 + HALIL_PART2:
        assert q['category'] in VALID_CATEGORIES, f"Invalid category: {q['category']}"
        assert 0 <= q['correctIndex'] < len(q['options']), f"Invalid correctIndex: {q['correctIndex']}"
        
        new_q = {
            "id": f"q_{next_id_num}",
            "source": "שחזור מבחן ממשלתי 2023 (שחזור חליל)",
            "category": q['category'],
            "question": q['question'],
            "options": q['options'],
            "correctIndex": q['correctIndex'],
            "explanation": q['explanation'],
            "verified": True,
            "originalExplanation": "מפתח תשובות רשמי (עמוד 13 בקובץ שחזור חליל)",
            "aiExplanation": q['aiExplanation']
        }
        db.append(new_q)
        next_id_num += 1
        added_halil += 1
        
    print(f"Added {added_halil} questions from Halil 2023. DB now at {len(db)}")
    
    # 3. Add 2021 Exam MCQs (13 questions)
    added_2021 = 0
    for q in EXAM_2021_MCQS:
        assert q['category'] in VALID_CATEGORIES, f"Invalid category: {q['category']}"
        assert 0 <= q['correctIndex'] < len(q['options']), f"Invalid correctIndex: {q['correctIndex']}"
        
        new_q = {
            "id": f"q_{next_id_num}",
            "source": "שחזור מבחן ממשלתי הדרכה קלינית 2021",
            "category": q['category'],
            "question": q['question'],
            "options": q['options'],
            "correctIndex": q['correctIndex'],
            "explanation": q['explanation'],
            "verified": True,
            "originalExplanation": "תשובה מסומנת ומאומתת בטופס שחזור המבחן המקורי",
            "aiExplanation": q['aiExplanation']
        }
        db.append(new_q)
        next_id_num += 1
        added_2021 += 1
        
    print(f"Added {added_2021} questions from 2021 Exam. DB now at {len(db)}")
    
    # 4. Save clean_questions.json
    with open('data/clean_questions.json', 'w', encoding='utf-8') as f:
        json.dump(db, f, ensure_ascii=False, indent=2)
    print("Saved data/clean_questions.json")
    
    # 5. Export to questions.js
    with open('questions.js', 'w', encoding='utf-8') as f:
        f.write("window.EXAM_QUESTIONS = " + json.dumps(db, ensure_ascii=False, indent=2) + ";\n")
    print("Saved questions.js")
    
    # 6. Update single_answer_raw_questions.json
    with open('data/single_answer_raw_questions.json', 'r', encoding='utf-8') as f:
        single_items = json.load(f)
    print(f"Current single answer count: {len(single_items)}")
    
    for idx, item in enumerate(EXAM_2021_RECALL_ITEMS, 1):
        single_entry = {
            "id": f"single_2021_{idx:03d}",
            "sourceFile": "raw_materials/exams/שחזור מבחן ממשלתי הדרכה קלינית 2021.pdf",
            "sourceLocation": "שחזור בכתב יד (2021)",
            "question": item['prompt'],
            "knownAnswer": item['correctAnswer'],
            "category": item['category'],
            "notes": "פריט שחזור ממשלתי 2021 ללא מסיחים מלאים (התשובה אותרה ומאומתת בספרות)"
        }
        single_items.append(single_entry)
        
    with open('data/single_answer_raw_questions.json', 'w', encoding='utf-8') as f:
        json.dump(single_items, f, ensure_ascii=False, indent=2)
    print(f"Updated data/single_answer_raw_questions.json. New count: {len(single_items)}")
    
    # 7. Update docs/single_answer_questions.md
    with open('docs/single_answer_questions.md', 'r', encoding='utf-8') as f:
        md_content = f.read()
        
    # Replace count in header
    md_content = md_content.replace(f"**סך הכל שאלות במאגר:** {len(single_items) - len(EXAM_2021_RECALL_ITEMS)} שאלות.", f"**סך הכל שאלות במאגר:** {len(single_items)} שאלות.")
    
    # Add source entry
    source_addition = f"- **שחזור ממשלתי 2021 (שחזור מבחן ממשלתי הדרכה קלינית 2021.pdf)**: {len(EXAM_2021_RECALL_ITEMS)} שאלות\n"
    target_marker = "- **אוסף שחזורים (אוסף שחזורים.pdf)**: 164 שאלות\n"
    if target_marker in md_content:
        md_content = md_content.replace(target_marker, target_marker + source_addition)
        
    # Append section for 2021 recall items
    new_section = f"\n\n### שחזור מבחן ממשלתי הדרכה קלינית 2021 ({len(EXAM_2021_RECALL_ITEMS)} שאלות)\n\n"
    new_section += "| מזהה | שאלה | תשובה ידועה | קטגוריה ומיקום |\n"
    new_section += "|---|---|---|---|\n"
    for idx, item in enumerate(EXAM_2021_RECALL_ITEMS, 1):
        clean_q = item['prompt'].replace('|', '-').replace('\n', ' ')
        clean_a = item['correctAnswer'].replace('|', '-').replace('\n', ' ')
        clean_cat = item['category']
        new_section += f"| `single_2021_{idx:03d}` | {clean_q} | {clean_a} | {clean_cat} (שחזור 2021) |\n"
        
    md_content += new_section
    
    with open('docs/single_answer_questions.md', 'w', encoding='utf-8') as f:
        f.write(md_content)
    print("Updated docs/single_answer_questions.md")

if __name__ == '__main__':
    run_integration()
