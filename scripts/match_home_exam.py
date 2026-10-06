import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/clean_questions.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

with open('data/home_exam_parsed.json', 'r', encoding='utf-8') as f:
    home_qs = json.load(f)

def norm(text):
    t = re.sub(r'[^\w\s]', '', text)
    t = re.sub(r'\s+', ' ', t).strip()
    return t

matches = []
for hq in home_qs:
    h_prompt = norm(hq['prompt'])
    h_words = set(h_prompt.split())
    best_match = None
    best_score = 0.0
    for dq in db:
        d_prompt = norm(dq['question'])
        d_words = set(d_prompt.split())
        if not h_words or not d_words:
            continue
        jaccard = len(h_words & d_words) / len(h_words | d_words)
        if jaccard > best_score:
            best_score = jaccard
            best_match = dq
    if best_score > 0.40:
        matches.append((hq, best_match, best_score))

print(f"Total matches found (similarity > 0.40): {len(matches)} / 50")
for hq, dq, score in matches:
    print(f"\nScore {score:.2f} | Home Q{hq['num']}: {hq['prompt'][:65]}")
    print(f"   DB {dq['id']}: {dq['question'][:65]}")
    corr_idx = dq.get('correctIndex')
    ans = dq['options'][corr_idx] if corr_idx is not None and corr_idx < len(dq['options']) else 'None'
    print(f"   DB verified: {dq.get('verified')} | DB correct [{corr_idx}]: {ans}")
