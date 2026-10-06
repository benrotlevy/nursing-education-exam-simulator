import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/clean_questions.json', encoding='utf-8') as f:
    existing_qs = json.load(f)

with open('data/docx_2025_raw_qs.json', encoding='utf-8') as f:
    new_qs = json.load(f)

existing_keys = set()
for q in existing_qs:
    k = re.sub(r'[^\w]', '', q['question'])[:35]
    existing_keys.add(k)

overlap = []
unique_new = []

for q in new_qs:
    k = re.sub(r'[^\w]', '', q['question'])[:35]
    if k in existing_keys:
        overlap.append(q)
    else:
        unique_new.append(q)

print(f"Total in 2025 docx: {len(new_qs)}")
print(f"Overlapping with existing DB: {len(overlap)}")
print(f"Unique brand new questions: {len(unique_new)}")

print("\n--- Samples of unique brand new questions from 2025 ---")
for q in unique_new[:6]:
    print("Q:", q['question'])
    print("Opts:", q['options'])
    print("-" * 30)
