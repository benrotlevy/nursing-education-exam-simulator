import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open("data/collection_dump.txt", "r", encoding="utf-8") as f:
    text = f.read()

pages = text.split("--- PAGE ")
print(f"Total pages: {len(pages)-1}")

for i, p in enumerate(pages[1:], 1):
    first_lines = [l.strip() for l in p.splitlines() if l.strip()][:3]
    q_count = len(re.findall(r'\n\s*\d+\s*[\?\)\.]', p))
    print(f"Page {i:02d} ({q_count} qs): {' | '.join(first_lines)}")
