import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

def fix_line(line):
    # Strip page header/footer
    if '~QE100M' in line or 'מתוך26' in line or 'סוף---' in line:
        return ''
    tokens = line.split()
    if not tokens:
        return ''
    hebrew_tokens = [t for t in tokens if re.search(r'[\u0590-\u05fe]', t)]
    if len(hebrew_tokens) >= len(tokens) / 2:
        return ' '.join(reversed(tokens))
    return line

with open('data/hadassah_2023_raw.txt', encoding='utf-8') as f:
    raw_text = f.read()

# Fix all lines
fixed_lines = []
for l in raw_text.splitlines():
    fl = fix_line(l.strip())
    if fl:
        fixed_lines.append(fl)

with open('data/hadassah_2023_fixed_lines.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(fixed_lines))

print(f"Total fixed lines: {len(fixed_lines)}")
