import re
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/שחזור הדרכה קלינית 23-12-25.txt', encoding='utf-8') as f:
    lines = [l.strip() for l in f if l.strip()]

questions = []
curr_q = None

opt_pattern = re.compile(r'^([א-דa-d])[\.\)]\s*(.+)$')

for l in lines[4:]:
    m = opt_pattern.match(l)
    if m:
        if curr_q:
            curr_q['options'].append(m.group(2).strip())
    else:
        if curr_q and len(curr_q['options']) >= 2:
            questions.append(curr_q)
        curr_q = {
            'question': l,
            'options': []
        }

if curr_q and len(curr_q['options']) >= 2:
    questions.append(curr_q)

with open('data/docx_2025_raw_qs.json', 'w', encoding='utf-8') as f:
    json.dump(questions, f, ensure_ascii=False, indent=2)

print(f"Dumped {len(questions)} questions to data/docx_2025_raw_qs.json")
