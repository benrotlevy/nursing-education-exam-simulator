import re
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/exam_2024_dump.txt', encoding='utf-8') as f:
    text = f.read()

# Load extracted highlights
with open('scripts/extract_all_50_highlights.py', 'r') as f:
    pass

# We have the 50 highlights list
# Let's parse all 72 questions from dump.txt
lines = text.splitlines()

# Parse dump questions
questions = []
curr_q = None

for l in lines:
    ls = l.strip()
    m = re.match(r'^(\d+)\s*[\.\)]\s*(.*)', ls)
    if m:
        if curr_q:
            questions.append(curr_q)
        curr_q = {
            'num': int(m.group(1)),
            'question': m.group(2).strip(),
            'options': []
        }
    elif curr_q:
        m_opt = re.match(r'^([א-דa-d])[\.\)]\s*(.*)', ls)
        if m_opt:
            curr_q['options'].append({
                'letter': m_opt.group(1),
                'text': m_opt.group(2).strip()
            })
        elif len(curr_q['options']) == 0:
            if not ls.isdigit() and 'שחזור מבחן' not in ls:
                curr_q['question'] += ' ' + ls
        elif len(curr_q['options']) > 0:
            if not ls.isdigit() and 'שחזור מבחן' not in ls:
                curr_q['options'][-1]['text'] += ' ' + ls

if curr_q:
    questions.append(curr_q)

print(f"Total parsed questions: {len(questions)}")

# Now let's check which page each question is on based on dump lines
# In dump lines:
# Page 1: Q1 to Q9 (9 questions)
# Page 2: Q10 to Q18 (9 questions)
# Page 3: Q19 to Q28 (10 questions)
# Page 4: Q29 to Q38 (10 questions)
# Page 5: Q39 to Q48 (10 questions)
# Page 6: Q49 to Q61 (13 questions)
# Page 7: Q62 to Q72 (11 questions)

# Let's inspect Page 3, 4, 5, 6, 7 in detail!
for q in questions:
    num = q['num']
    if num <= 9:
        q['page'] = 1
    elif num <= 18:
        q['page'] = 2
    elif num <= 28:
        q['page'] = 3
    elif num <= 38:
        q['page'] = 4
    elif num <= 48:
        q['page'] = 5
    elif num <= 61:
        q['page'] = 6
    else:
        q['page'] = 7

# Let's see questions for Page 3
for p in range(1, 8):
    p_qs = [q for q in questions if q['page'] == p]
    print(f"\n================ Page {p} ({len(p_qs)} questions) ================")
    for q in p_qs:
        opts_summary = " | ".join([f"{o['letter']}. {o['text']}" for o in q['options']])
        print(f"Q{q['num']:02d}: {q['question'][:50]}... [{opts_summary}]")
