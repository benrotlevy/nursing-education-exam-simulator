import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/hadassah_2023_parsed.json', encoding='utf-8') as f:
    qs = json.load(f)

start = int(sys.argv[1]) if len(sys.argv) > 1 else 0
end = int(sys.argv[2]) if len(sys.argv) > 2 else 10

for q in qs[start:end]:
    print(f"=== Q{q['num']} ===")
    print(f"שאלה: {q['question']}")
    for i, o in enumerate(q['options']):
        print(f"  [{i}] {o}")
    print()
