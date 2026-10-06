import fitz
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Let's inspect the questions in data/exam_2024_dump.txt and see what page each question appears on
with open('data/exam_2024_dump.txt', encoding='utf-8') as f:
    text = f.read()

# Let's split by the page numbers: "1", "2", "3", "4", "5", "6", "7"
# In dump.txt, page numbers appear as lines with just "1", "2", etc.
lines = text.splitlines()
pages_text = {}
current_page = 1
for l in lines:
    l_strip = l.strip()
    if l_strip.isdigit() and int(l_strip) in range(1, 10):
        # Could be page number
        # check if it matches consecutive page
        val = int(l_strip)
        if val == current_page + 1:
            current_page = val
    if current_page not in pages_text:
        pages_text[current_page] = []
    pages_text[current_page].append(l)

print("Page distribution in dump:")
for p, p_lines in pages_text.items():
    # count questions on this page
    q_matches = [l for l in p_lines if re.match(r'^\d+\s*[\.\)]', l.strip())]
    print(f"Page {p}: {len(p_lines)} lines, {len(q_matches)} questions: {[re.match(r'^(\d+)', l.strip()).group(1) for l in q_matches]}")

doc = fitz.open("raw_materials/exams/שחזור ממשלתי הדרכה קלינית 2024.pdf")
for page_num in range(len(doc)):
    page = doc[page_num]
    drawings = page.get_drawings()
    print(f"\nPDF Page {page_num+1} drawings breakdown:")
    fills = []
    strokes = []
    for d in drawings:
        fill = d.get("fill")
        stroke = d.get("color")
        if fill:
            fills.append(fill)
        if stroke:
            strokes.append(stroke)
    print(f"  Fills: {len(fills)}, Strokes: {len(strokes)}")
    # Distinct fill colors:
    distinct_fills = set(tuple(round(c, 2) for c in f[:3]) for f in fills)
    print(f"  Distinct fill colors: {distinct_fills}")
