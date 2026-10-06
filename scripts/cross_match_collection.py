import json
import re
import sys
from clean_hebrew_utils import clean_hebrew

sys.stdout.reconfigure(encoding='utf-8')

with open('data/clean_questions.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

with open('data/single_answer_raw_questions.json', 'r', encoding='utf-8') as f:
    single_db = json.load(f)

with open('data/collection_parsed_items.json', 'r', encoding='utf-8') as f:
    collection_items = json.load(f)

def norm(text):
    t = re.sub(r'[^\w\s]', '', text)
    t = re.sub(r'\s+', ' ', t).strip()
    return t

db_prompts = [norm(q['question']) for q in db]
single_prompts = [norm(q['question']) for q in single_db]

already_in_db = 0
already_in_single = 0
unique_items = []

for item in collection_items:
    q_norm = norm(item['question'])
    if len(q_norm) < 8:
        continue
    
    # Check match against db
    matched_db = False
    for db_p in db_prompts:
        if len(db_p) > 15 and len(q_norm) > 15:
            # check substring or high word overlap
            q_words = set(q_norm.split())
            d_words = set(db_p.split())
            jaccard = len(q_words & d_words) / len(q_words | d_words) if (q_words | d_words) else 0
            if jaccard > 0.55 or q_norm[:30] in db_p or db_p[:30] in q_norm:
                matched_db = True
                break
    if matched_db:
        already_in_db += 1
        continue
    
    # Check match against single_db
    matched_single = False
    for s_p in single_prompts:
        if len(s_p) > 15 and len(q_norm) > 15:
            q_words = set(q_norm.split())
            s_words = set(s_p.split())
            jaccard = len(q_words & s_words) / len(q_words | s_words) if (q_words | s_words) else 0
            if jaccard > 0.55 or q_norm[:25] in s_p or s_p[:25] in q_norm:
                matched_single = True
                break
    if matched_single:
        already_in_single += 1
        continue
    
    unique_items.append(item)

print(f"Total collection items: {len(collection_items)}")
print(f"Matched in clean_questions.json (already full multiple-choice): {already_in_db}")
print(f"Matched in single_answer_raw_questions.json: {already_in_single}")
print(f"Brand new unique items: {len(unique_items)}")

# Further inspect how many of unique_items are single-answer
unique_single = [it for it in unique_items if it['opt_count'] <= 1]
unique_multi = [it for it in unique_items if it['opt_count'] > 1]
print(f"Unique single-answer recall items: {len(unique_single)}")
print(f"Unique multi-option items: {len(unique_multi)}")

with open('data/collection_unique_items.json', 'w', encoding='utf-8') as f:
    json.dump(unique_items, f, ensure_ascii=False, indent=2)

print("Saved to data/collection_unique_items.json")
