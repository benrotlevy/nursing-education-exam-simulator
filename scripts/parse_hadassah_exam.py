import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/hadassah_2023_fixed_lines.txt', encoding='utf-8') as f:
    lines = [l.strip() for l in f if l.strip()]

def clean_opt(line):
    # Pattern 1: Dot before letter, e.g. ".א טירוןNovice"
    m_dot_before = re.match(r'^\.([א-דa-d])\s*(.*)', line)
    if m_dot_before:
        return m_dot_before.group(1), m_dot_before.group(2).strip()

    # Pattern 2: Letter without dot, e.g. "א המטופל הולך למות..."
    m_no_dot = re.match(r'^([א-דa-d])\s+[\"\']*(.*)', line)
    if m_no_dot and not line.startswith('אוריינטציה') and not line.startswith('אימון'):
        return m_no_dot.group(1), m_no_dot.group(2).strip()

    # Pattern 3: Word ending with .letter, e.g. "ביטחון.א ובטיחות המטופל"
    m_word_dot = re.match(r'^(.+?)\.([א-דa-d])\s*(.*)', line)
    if m_word_dot:
        letter = m_word_dot.group(2)
        txt = f"{m_word_dot.group(1)} {m_word_dot.group(3)}".strip()
        return letter, txt

    # Pattern 4: Standard "א. משהו" or "א) משהו"
    m_std = re.match(r'^([א-דa-d])[\.\)]\s*(.*)', line)
    if m_std:
        return m_std.group(1), m_std.group(2).strip()

    return None, line

questions = []
curr_q = None

for l in lines:
    if l.startswith('עמוד') or l.startswith('מבחן') or l.startswith('===') or l.startswith('~QE100M'):
        continue
    m_q = re.match(r'^(?:שאלה\s+מספר\s+(\d+)|מספר\s+שאלה\s+(\d+))', l)
    if m_q:
        if curr_q:
            questions.append(curr_q)
        q_num = int(m_q.group(1) or m_q.group(2))
        curr_q = {
            'num': q_num,
            'q_lines': [],
            'options': [],
            'raw_options': []
        }
    elif curr_q:
        letter, opt_txt = clean_opt(l)
        if letter:
            curr_q['options'].append(opt_txt)
            curr_q['raw_options'].append(f"{letter}. {opt_txt}")
        elif len(curr_q['options']) == 0:
            curr_q['q_lines'].append(l)
        else:
            if curr_q['options']:
                curr_q['options'][-1] += ' ' + l
                curr_q['raw_options'][-1] += ' ' + l

if curr_q:
    questions.append(curr_q)

print(f"Total questions parsed: {len(questions)}")

opt_len_counts = {}
irregular = []
for q in questions:
    q['question'] = ' '.join(q['q_lines']).replace('?', '').strip() + '?'
    c = len(q['options'])
    opt_len_counts[c] = opt_len_counts.get(c, 0) + 1
    if c != 4:
        irregular.append(q)

print("Option count distribution:", opt_len_counts)
if irregular:
    print(f"Irregular questions ({len(irregular)}):")
    for q in irregular:
        print(f"Q{q['num']} (count {len(q['options'])}): {q['raw_options']}")
else:
    print("ALL 100 QUESTIONS PARSED WITH EXACTLY 4 OPTIONS!")

with open('data/hadassah_2023_parsed.json', 'w', encoding='utf-8') as f:
    json.dump(questions, f, ensure_ascii=False, indent=2)

print("Saved to data/hadassah_2023_parsed.json")
