import json
import re
import sys
import fitz

sys.stdout.reconfigure(encoding='utf-8')

# 1. Load exam_2024_dump.txt
with open('data/exam_2024_dump.txt', encoding='utf-8') as f:
    text = f.read()

# Let's see how pages are divided in the dump.
# Look for page markers like "1", "2", "3", etc. or split by lines
lines = text.splitlines()

questions = []
curr_q = None

for line_idx, l in enumerate(lines):
    l_strip = l.strip()
    m_q = re.match(r'^(\d+)\s*[\.\)]\s*(.*)', l_strip)
    if m_q and int(m_q.group(1)) > 0:
        # Check if it's really a question (not a page number)
        q_num = int(m_q.group(1))
        # Usually questions are in order 1..N
        if curr_q:
            questions.append(curr_q)
        curr_q = {
            'num': q_num,
            'question': m_q.group(2).strip(),
            'options': [],
            'line_idx': line_idx
        }
    elif curr_q:
        m_opt = re.match(r'^([א-דa-d])[\.\)]\s*(.*)', l_strip)
        if m_opt:
            curr_q['options'].append({
                'letter': m_opt.group(1),
                'text': m_opt.group(2).strip(),
                'line_idx': line_idx
            })
        elif len(curr_q['options']) == 0:
            if not l_strip.isdigit() and not 'שחזור מבחן' in l_strip:
                curr_q['question'] += ' ' + l_strip
        elif len(curr_q['options']) > 0:
            if not l_strip.isdigit() and not 'שחזור מבחן' in l_strip:
                curr_q['options'][-1]['text'] += ' ' + l_strip

if curr_q:
    questions.append(curr_q)

print(f"Total parsed questions in dump: {len(questions)}")
print(f"Question numbers range: {questions[0]['num']} to {questions[-1]['num']}")

# Now let's open the PDF and inspect yellow rects page by page
doc = fitz.open("raw_materials/exams/שחזור ממשלתי הדרכה קלינית 2024.pdf")
print(f"Total PDF pages: {len(doc)}")

for page_idx in range(len(doc)):
    page = doc[page_idx]
    drawings = page.get_drawings()
    yellow_rects = []
    for d in drawings:
        fill = d.get("fill")
        if fill:
            r, g, b = fill[:3]
            if r > 0.8 and g > 0.8 and b < 0.2:
                yellow_rects.append(d["rect"])
    
    # Sort yellow rects by y0 (top to bottom)
    yellow_rects.sort(key=lambda r: r.y0)
    print(f"Page {page_idx + 1}: {len(yellow_rects)} yellow highlights")
    for r_idx, yr in enumerate(yellow_rects):
        print(f"  Highlight {r_idx+1}: y0={yr.y0:.1f}, y1={yr.y1:.1f}, x0={yr.x0:.1f}, x1={yr.x1:.1f}")
