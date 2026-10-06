import json

with open("data/clean_questions.json", "r", encoding="utf-8") as f:
    questions = json.load(f)

with open("temp_check_695.txt", "w", encoding="utf-8") as out:
    for q in questions:
        if q["id"] in [f"q_{i}" for i in range(695, 715)]:
            out.write(f"=== {q['id']} (correctIndex: {q['correctIndex']}, verified: {q.get('verified')}, source: {q.get('source')}) ===\n")
            out.write(f"Q: {q['question']}\n")
            for i, opt in enumerate(q["options"]):
                out.write(f"  {i}: {opt}\n")
            out.write("\n")
print("Done writing temp_check_695.txt")
