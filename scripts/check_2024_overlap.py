import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/clean_questions.json', encoding='utf-8') as f:
    existing_qs = json.load(f)

with open('data/exam_2024_dump.txt', encoding='utf-8') as f:
    text = f.read()

# Parse questions from 2024 dump
lines = text.splitlines()
parsed_2024 = []
curr_q = None

for l in lines:
    l_strip = l.strip()
    m = re.match(r'^(\d+)\s*[\.\)]\s*(.*)', l_strip)
    if m:
        if curr_q:
            parsed_2024.append(curr_q)
        curr_q = {
            'num': int(m.group(1)),
            'q': m.group(2).strip(),
            'options': []
        }
    elif curr_q:
        m_opt = re.match(r'^[א-דa-d][\.\)]\s*(.*)', l_strip)
        if m_opt:
            curr_q['options'].append(m_opt.group(1).strip())
        elif not l_strip.isdigit() and len(curr_q['options']) == 0:
            curr_q['q'] += ' ' + l_strip
        elif not l_strip.isdigit() and len(curr_q['options']) > 0:
            curr_q['options'][-1] += ' ' + l_strip

if curr_q:
    parsed_2024.append(curr_q)

print(f"Parsed 2024 questions: {len(parsed_2024)}")

# Check match with existing_qs
matches = 0
unmatched = []
for q24 in parsed_2024:
    q_text = q24['q']
    words = [w for w in re.findall(r'\w+', q_text) if len(w) > 3]
    best_overlap = 0
    best_match = None
    for eq in existing_qs:
        eq_words = set(re.findall(r'\w+', eq['question']))
        common = sum(1 for w in words if w in eq_words)
        if common > best_overlap:
            best_overlap = common
            best_match = eq
            
    if best_overlap >= 4:
        matches += 1
    else:
        unmatched.append(q24)

print(f"Matches with existing DB: {matches}")
print(f"Unmatched (potential new): {len(unmatched)}")
print("\nUnmatched questions list:")
for u in unmatched:
    print(f"Q{u['num']}: {u['q']} (opts: {len(u['options'])})")
    for opt in u['options']:
        print(f"   - {opt}")
