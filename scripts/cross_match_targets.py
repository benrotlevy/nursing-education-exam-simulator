import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/clean_questions.json', encoding='utf-8') as f:
    db = json.load(f)

from extract_target_questions import f1_qs, f2_qs

print(f"Current DB questions: {len(db)}")
print(f"File 1 questions: {len(f1_qs)}")
print(f"File 2 questions: {len(f2_qs)}")

# Check F1 overlap with DB
f1_in_db = 0
f1_unique = []
for q in f1_qs:
    q_words = [w for w in re.findall(r'\w+', q['question']) if len(w) > 3]
    best_overlap = 0
    best_match = None
    for eq in db:
        eq_words = set(re.findall(r'\w+', eq['question']))
        common = sum(1 for w in q_words if w in eq_words)
        if common > best_overlap:
            best_overlap = common
            best_match = eq
    if best_overlap >= 4:
        f1_in_db += 1
    else:
        f1_unique.append(q)

print(f"File 1 (תרגילים): {f1_in_db} already in DB, {len(f1_unique)} UNIQUE NEW questions!")

# Check F2 overlap with DB
f2_in_db = 0
f2_unique = []
for q in f2_qs:
    q_words = [w for w in re.findall(r'\w+', q['question']) if len(w) > 3]
    best_overlap = 0
    best_match = None
    for eq in db:
        eq_words = set(re.findall(r'\w+', eq['question']))
        common = sum(1 for w in q_words if w in eq_words)
        if common > best_overlap:
            best_overlap = common
            best_match = eq
    if best_overlap >= 4:
        f2_in_db += 1
    else:
        f2_unique.append(q)

print(f"File 2 (מבחן לתרגול): {f2_in_db} already in DB, {len(f2_unique)} UNIQUE NEW questions!")

# Check overlap between F1 and F2
f1_f2_overlap = 0
for q1 in f1_unique:
    q1_words = [w for w in re.findall(r'\w+', q1['question']) if len(w) > 3]
    for q2 in f2_unique:
        q2_words = set(re.findall(r'\w+', q2['question']))
        if sum(1 for w in q1_words if w in q2_words) >= 4:
            f1_f2_overlap += 1
            break
print(f"Overlap between F1 and F2 unique sets: {f1_f2_overlap}")
