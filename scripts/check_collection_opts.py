import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open("data/collection_dump.txt", "r", encoding="utf-8") as f:
    text = f.read()

lines = text.splitlines()

# Let's count how many questions have 3-4 options vs single option
q_blocks = []
curr_q = None

for l in lines:
    ls = l.strip()
    m_q = re.match(r'^(\d+)\s*[\?\)\.]\s*(.*)', ls)
    if m_q and int(m_q.group(1)) > 0:
        if curr_q:
            q_blocks.append(curr_q)
        curr_q = {
            'num': int(m_q.group(1)),
            'prompt': m_q.group(2),
            'options': []
        }
    elif curr_q:
        m_opt = re.match(r'^[\.\)]?\s*([א-דa-d])[\.\)]\s*(.*)', ls)
        if m_opt:
            curr_q['options'].append((m_opt.group(1), m_opt.group(2).strip()))

if curr_q:
    q_blocks.append(curr_q)

print(f"Total question blocks parsed in collection: {len(q_blocks)}")
single_opt = sum(1 for q in q_blocks if len(q['options']) == 1)
multi_opt = sum(1 for q in q_blocks if len(q['options']) > 1)
print(f"Questions with 1 option: {single_opt}")
print(f"Questions with >1 option: {multi_opt}")
if multi_opt > 0:
    for q in q_blocks:
        if len(q['options']) > 1:
            print(f"Multi-opt Q{q['num']}: {q['prompt'][:40]} -> {len(q['options'])} opts: {[o[0] for o in q['options']]}")
