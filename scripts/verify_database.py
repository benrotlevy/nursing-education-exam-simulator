import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

VALID_CATEGORIES = {
    "תיאוריות למידה ולמידת מבוגרים",
    "מיומנויות פסיכומוטוריות וסימולציה",
    "משוב, הערכה ורפלקציה",
    "תפקיד המדריך ויחסי מדריך-סטודנט",
    "הסטודנט המתקשה ותוכניות התערבות",
    "אתיקה, חוק ובטיחות המטופל"
}

def verify():
    # Read questions.js by stripping window.EXAM_QUESTIONS = and trailing ;
    with open('questions.js', encoding='utf-8') as f:
        content = f.read()
        
    start_idx = content.find('window.EXAM_QUESTIONS = ') + len('window.EXAM_QUESTIONS = ')
    end_idx = content.rfind(';')
    json_str = content[start_idx:end_idx].strip()
    
    questions = json.loads(json_str)
    print(f"Loaded {len(questions)} questions from questions.js.")
    
    errors = []
    seen_ids = set()
    
    for idx, q in enumerate(questions):
        # 1. ID check
        qid = q.get('id')
        if not qid or qid in seen_ids:
            errors.append(f"Q#{idx}: Invalid or duplicate id: {qid}")
        seen_ids.add(qid)
        
        # 2. Question text
        if not q.get('question') or len(q['question']) < 5:
            errors.append(f"Q#{idx} ({qid}): Question text too short or empty")
            
        # 3. Options
        opts = q.get('options', [])
        if len(opts) not in [3, 4]:
            errors.append(f"Q#{idx} ({qid}): Invalid number of options: {len(opts)}")
            
        # 4. Correct index
        corr = q.get('correctIndex')
        if corr is None or not (0 <= corr < len(opts)):
            errors.append(f"Q#{idx} ({qid}): Invalid correctIndex: {corr} for {len(opts)} options")
            
        # 5. Category
        cat = q.get('category')
        if cat not in VALID_CATEGORIES:
            errors.append(f"Q#{idx} ({qid}): Invalid category: {cat}")
            
        # 6. Explanation
        if not q.get('explanation'):
            errors.append(f"Q#{idx} ({qid}): Missing explanation")
            
    if errors:
        print(f"FAILED with {len(errors)} errors:")
        for err in errors[:10]:
            print(" -", err)
        sys.exit(1)
    else:
        print(f"SUCCESS! All {len(questions)} questions passed 100% of validation rules!")
        print(f"Unique IDs: {len(seen_ids)}")
        print(f"Categories verified: {len(VALID_CATEGORIES)}")

if __name__ == "__main__":
    verify()
