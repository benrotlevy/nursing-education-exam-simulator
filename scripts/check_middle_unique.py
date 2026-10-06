import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/clean_questions.json', encoding='utf-8') as f:
    existing_qs = json.load(f)

existing_keys = set(re.sub(r'[^\w]', '', q['question'])[:30] for q in existing_qs)

# Check middle exam
with open('data/שחזור מבחן אמצע הדרכה קלינית 06.txt', encoding='utf-8') as f:
    mid_lines = [l.strip() for l in f if l.strip()]

mid_unique = []
for i in range(1, len(mid_lines), 2):
    q_txt = re.sub(r'^\d+[\.\)]\s*', '', mid_lines[i])
    k = re.sub(r'[^\w]', '', q_txt)[:30]
    if k not in existing_keys and len(q_txt) > 8:
        ans = mid_lines[i+1] if i+1 < len(mid_lines) else ""
        mid_unique.append({'q': q_txt, 'ans': ans})

print(f"Middle exam unique questions: {len(mid_unique)}")
for m in mid_unique:
    print(" -", m['q'], "-->", m['ans'])
