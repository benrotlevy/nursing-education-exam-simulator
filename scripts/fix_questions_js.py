import json

with open('data/clean_questions.json', encoding='utf-8') as f:
    db = json.load(f)

# Save questions.js with window.EXAM_QUESTIONS
with open('questions.js', 'w', encoding='utf-8') as f:
    f.write("// מאגר שאלות לתרגול - הדרכה קלינית בסיעוד\n")
    f.write(f"// סה\"כ שאלות: {len(db)}\n")
    f.write("window.EXAM_QUESTIONS = ")
    json.dump(db, f, ensure_ascii=False, indent=2)
    f.write(";\n")

print("Fixed questions.js with window.EXAM_QUESTIONS!")
