import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/docx_2025_raw_qs.json', encoding='utf-8') as f:
    qs = json.load(f)

for i, q in enumerate(qs):
    print(f"[{i+1}] {q['question']}")
    for o_idx, opt in enumerate(q['options']):
        print(f"    {chr(1488+o_idx)}. {opt}")
