import re
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

with open('data/home_exam_clean_text.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

questions = []
curr_q = None

for line_raw in lines:
    line = line_raw.strip()
    if not line or line.startswith('=== PAGE') or 'מבחן בית – קורס' in line:
        continue
    if '10.24' in line and len(line) < 15:
        continue
    
    # Check if question start: . \d+ or \d+ . or . \d+ .
    m_q = re.match(r'^\s*(?:\.\s*)?(\d{1,2})\s*(?:\.\s*)?(.*)', line)
    if m_q:
        val = int(m_q.group(1))
        rest_of_line = m_q.group(2).strip()
        # Ensure it's not the date '27 .10.24'
        if 1 <= val <= 50 and not rest_of_line.startswith('.10.24') and not rest_of_line.startswith('10.24'):
            if curr_q:
                questions.append(curr_q)
            curr_q = {
                'num': val,
                'prompt_parts': [rest_of_line] if rest_of_line else [],
                'options': {'א': [], 'ב': [], 'ג': [], 'ד': []},
                'current_key': None
            }
            continue
    
    # Check if option start: א . or . א or א
    m_opt = re.match(r'^\s*(?:\.\s*)?([א-ד])\s*(?:\.\s*)?(.*)', line)
    if m_opt and curr_q:
        curr_opt = m_opt.group(1)
        curr_q['current_key'] = curr_opt
        rest = m_opt.group(2).strip()
        if rest:
            curr_q['options'][curr_opt].append(rest)
        continue
    
    if curr_q:
        if curr_q['current_key']:
            curr_q['options'][curr_q['current_key']].append(line)
        else:
            curr_q['prompt_parts'].append(line)

if curr_q:
    questions.append(curr_q)

print(f"Parsed {len(questions)} questions.")

parsed_clean = []
for q in questions:
    prompt = " ".join(q['prompt_parts']).strip()
    opts = [" ".join(q['options'][k]).strip() for k in ['א', 'ב', 'ג', 'ד']]
    missing = [k for k in ['א', 'ב', 'ג', 'ד'] if not q['options'][k]]
    if missing:
        print(f"WARNING Q{q['num']}: missing options {missing}")
    parsed_clean.append({
        'num': q['num'],
        'prompt': prompt,
        'options': opts,
        'missing': missing
    })
    print(f"Q{q['num']}: {prompt[:50]}... | opts: {[len(o) for o in opts]}")

with open('data/home_exam_parsed.json', 'w', encoding='utf-8') as f:
    json.dump(parsed_clean, f, ensure_ascii=False, indent=2)

print("\nSaved to data/home_exam_parsed.json")
