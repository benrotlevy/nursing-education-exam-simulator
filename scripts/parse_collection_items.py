import fitz
import re
import sys
import json
from clean_hebrew_utils import clean_hebrew

sys.stdout.reconfigure(encoding='utf-8')

doc = fitz.open('raw_materials/exams/אוסף שחזורים.pdf')

total_items = []

for p_idx, page in enumerate(doc):
    text = page.get_text()
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if not lines:
        continue
    sec = lines[0]
    if len(lines) > 1 and not re.match(r'^\d', lines[1]) and len(lines[1]) < 35:
        sec += ' - ' + lines[1]
    
    p_text = '\n'.join(lines)
    parts = re.split(r'\n(?=\d+\s*[\?\)\:])', p_text)
    for part in parts:
        part = part.strip()
        m_q = re.match(r'^(\d+)\s*[\?\)\:]\s*(.+)', part, re.DOTALL)
        if m_q:
            q_num = m_q.group(1)
            rest = m_q.group(2).strip()
            # find answer: line starting with letter א-ד
            m_a = re.search(r'\n\s*([א-דa-d][\.\)])\s*(.+)', rest, re.DOTALL)
            if m_a:
                q_text = rest[:m_a.start()].strip()
                a_text = m_a.group(1) + ' ' + m_a.group(2).strip()
                # count options inside a_text
                opts = re.findall(r'[א-דa-d][\.\)]', a_text)
                
                # clean up q_text and a_text
                q_clean = clean_hebrew(q_text)
                a_clean = clean_hebrew(a_text)
                
                if len(q_clean) > 8 and len(a_clean) > 3:
                    total_items.append({
                        'page': p_idx + 1,
                        'section': sec,
                        'num': q_num,
                        'question': q_clean,
                        'answer': a_clean,
                        'opt_count': len(opts)
                    })

print(f"Total parsed items: {len(total_items)}")
single_ans = [it for it in total_items if it['opt_count'] <= 1]
multi_ans = [it for it in total_items if it['opt_count'] > 1]
print(f"Items with <= 1 option (single answer recall): {len(single_ans)}")
print(f"Items with > 1 options: {len(multi_ans)}")

with open('data/collection_parsed_items.json', 'w', encoding='utf-8') as f:
    json.dump(total_items, f, ensure_ascii=False, indent=2)

print("\nSaved to data/collection_parsed_items.json")
