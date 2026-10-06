import json
import sys
from build_home_exam_questions import HOME_QUESTIONS_DATA, VALID_CATEGORIES

sys.stdout.reconfigure(encoding='utf-8')

# 1. Load current database
with open('data/clean_questions.json', 'r', encoding='utf-8') as f:
    raw_db = json.load(f)

db = [q for q in raw_db if int(q['id'].split('_')[1]) <= 916]
print(f"Base DB question count: {len(db)}")
assert len(db) == 916, f"Expected 916 questions, got {len(db)}"

# 2. Build new question objects
new_questions = []
start_id = 917

for idx, q_data in enumerate(HOME_QUESTIONS_DATA):
    q_id = f"q_{start_id + idx}"
    obj = {
        "id": q_id,
        "question": q_data["question"],
        "options": q_data["options"],
        "correctIndex": q_data["correctIndex"],
        "category": q_data["category"],
        "explanation": q_data["explanation"],
        "originalExplanation": "",
        "aiExplanation": q_data["explanation"],
        "source": "מבחן בית קורס הדרכה קלינית (27.10.2024)",
        "verified": False
    }
    new_questions.append(obj)

print(f"Built {len(new_questions)} new question objects (IDs {new_questions[0]['id']} to {new_questions[-1]['id']})")

# 3. Append to DB
full_db = db + new_questions
print(f"New total DB question count: {len(full_db)}")
assert len(full_db) == 966, f"Expected 966 questions, got {len(full_db)}"

# 4. Save to data/clean_questions.json
with open('data/clean_questions.json', 'w', encoding='utf-8') as f:
    json.dump(full_db, f, ensure_ascii=False, indent=2)

print("Saved updated data/clean_questions.json")

# 5. Update questions.js
js_content = "// Database of nursing clinical instruction exam questions\n"
js_content += "// Generated automatically - DO NOT EDIT DIRECTLY\n\n"
js_content += "window.EXAM_QUESTIONS = " + json.dumps(full_db, ensure_ascii=False, indent=2) + ";\n"

with open('questions.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

print("Saved updated questions.js")
