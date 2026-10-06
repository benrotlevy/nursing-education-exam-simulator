import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/home_exam_parsed.json', 'r', encoding='utf-8') as f:
    qs = json.load(f)

for q in qs:
    prompt = q['prompt'].strip()
    opts = q['options']
    for idx, opt in enumerate(opts):
        letters = ['א', 'ב', 'ג', 'ד']
        if '?' in opt:
            print(f"Q{q['num']} opt {letters[idx]} has ?: {opt}")
    if not (prompt.endswith('?') or prompt.endswith(':') or prompt.endswith('.')):
        print(f"Q{q['num']} prompt ends with: ...{prompt[-35:]}")
