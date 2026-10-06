import re
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/שחזור הדרכה קלינית 23-12-25.txt', encoding='utf-8') as f:
    lines = [l.strip() for l in f if l.strip()]

questions = []
curr_q = None

opt_pattern = re.compile(r'^([א-דa-d])[\.\)]\s*(.+)$')

for l in lines[4:]: # skip title
    m = opt_pattern.match(l)
    if m:
        if curr_q:
            curr_q['options'].append(m.group(2).strip())
    else:
        # It's a question header
        if curr_q and len(curr_q['options']) >= 2:
            questions.append(curr_q)
        curr_q = {
            'question': l,
            'options': []
        }

if curr_q and len(curr_q['options']) >= 2:
    questions.append(curr_q)

print(f"Total multiple-choice questions parsed from 23-12-25.docx: {len(questions)}")
for i, q in enumerate(questions[:8]):
    print(f"\nQ{i+1}: {q['question']}")
    for o_idx, opt in enumerate(q['options']):
        letters = ['א', 'ב', 'ג', 'ד']
        print(f"   {letters[o_idx] if o_idx < 4 else o_idx}. {opt}")
