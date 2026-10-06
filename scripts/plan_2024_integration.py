import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/clean_questions.json', encoding='utf-8') as f:
    db = json.load(f)

from cross_match_50_highlights import HIGHLIGHTS_MAP, dump_qs

print(f"Total clean_questions: {len(db)}")

# Let's inspect all questions in db that came from 2024
# and map each of the 50 highlights to an existing or new question
mapped_records = []

for num, hl in sorted(HIGHLIGHTS_MAP.items()):
    dq = next((q for q in dump_qs if q['num'] == num), None)
    if not dq:
        continue
    
    # Search in DB
    words = [w for w in re.findall(r'\w+', dq['question']) if len(w) > 3]
    best_db = None
    best_overlap = 0
    
    for eq in db:
        eq_words = set(re.findall(r'\w+', eq['question']))
        common = sum(1 for w in words if w in eq_words)
        if common > best_overlap:
            best_overlap = common
            best_db = eq
            
    is_in_db = best_overlap >= 3
    mapped_records.append({
        "num": num,
        "dump_q": dq,
        "highlight": hl,
        "in_db": is_in_db,
        "db_item": best_db if is_in_db else None,
        "overlap": best_overlap
    })

print(f"Total mapped: {len(mapped_records)}")
print(f"Already in DB: {sum(1 for r in mapped_records if r['in_db'])}")
print(f"To add to DB: {sum(1 for r in mapped_records if not r['in_db'])}")

for r in mapped_records:
    if not r['in_db']:
        print(f"TO ADD: Q{r['num']:02d} -> {r['dump_q']['question'][:50]} | Correct: {r['highlight']['letter']}. {r['highlight']['text']}")
    else:
        print(f"EXISTS: Q{r['num']:02d} -> [{r['db_item']['id']}] {r['db_item']['question'][:50]}")
