import json
import sys
from clean_hebrew_utils import clean_hebrew

sys.stdout.reconfigure(encoding='utf-8')

with open('data/home_exam_parsed.json', 'r', encoding='utf-8') as f:
    qs = json.load(f)

lines = []
for q in qs:
    prompt = clean_hebrew(q['prompt'])
    opts = [clean_hebrew(o) for o in q['options']]
    lines.append(f"=== Q{q['num']} ===")
    lines.append(f"שאלה: {prompt}")
    for idx, opt in enumerate(opts):
        letters = ['א', 'ב', 'ג', 'ד']
        lines.append(f"{letters[idx]}. {opt}")
    lines.append("")

with open('data/home_exam_50_readable.txt', 'w', encoding='utf-8') as f:
    f.write("\n".join(lines))

print(f"Written {len(qs)} questions to data/home_exam_50_readable.txt")
