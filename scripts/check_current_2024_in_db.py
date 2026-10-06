import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/clean_questions.json', encoding='utf-8') as f:
    db = json.load(f)

# Load the highlights mapping we discovered
# Let's inspect the questions in db with source 2024
db_2024 = [q for q in db if '2024' in q.get('source', '')]
print(f"Total questions currently in DB from 2024: {len(db_2024)}")

for q in db_2024:
    print(f"[{q['id']}] (verified: {q.get('verified')}, idx: {q.get('correctIndex')}): {q['question'][:60]}...")
