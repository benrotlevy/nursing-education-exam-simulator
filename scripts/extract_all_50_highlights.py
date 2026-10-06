import fitz
import re
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

# 1. Parse all 72 questions from data/exam_2024_dump.txt
with open('data/exam_2024_dump.txt', encoding='utf-8') as f:
    text = f.read()

lines = text.splitlines()

# Split dump into pages
# Notice in dump.txt: lines with just "1", "2", "3", "4", "5", "6", "7" indicate page numbers
pages_raw = {}
curr_page = 1
for l in lines:
    ls = l.strip()
    if ls in ['1', '2', '3', '4', '5', '6', '7'] and int(ls) == curr_page + 1:
        curr_page = int(ls)
    if curr_page not in pages_raw:
        pages_raw[curr_page] = []
    pages_raw[curr_page].append(l)

doc = fitz.open("raw_materials/exams/שחזור ממשלתי הדרכה קלינית 2024.pdf")

# For each page, let's find the yellow highlights and match to text
all_highlight_matches = []

for page_idx in range(len(doc)):
    page_num = page_idx + 1
    page = doc[page_idx]
    
    # 1. Yellow rects
    yellow_rects = []
    for d in page.get_drawings():
        fill = d.get("fill")
        if fill:
            r, g, b = fill[:3]
            if r > 0.8 and g > 0.8 and b < 0.2:
                yellow_rects.append(fitz.Rect(d["rect"]))
    yellow_rects.sort(key=lambda r: r.y0)
    
    # 2. Extract lines with bboxes from dict
    page_dict = page.get_text("dict")
    text_lines = []
    for b in page_dict["blocks"]:
        if "lines" in b:
            for l in b["lines"]:
                line_text = "".join(s["text"] for s in l["spans"]).strip()
                if line_text:
                    text_lines.append({
                        "bbox": fitz.Rect(l["bbox"]),
                        "text": line_text
                    })
    text_lines.sort(key=lambda l: (l["bbox"].y0, -l["bbox"].x1))
    
    # For each yellow rect, find the line(s) that overlap vertically
    for yr_idx, yr in enumerate(yellow_rects):
        matching_spans = []
        for tl in text_lines:
            lb = tl["bbox"]
            v_overlap = max(0, min(yr.y1, lb.y1) - max(yr.y0, lb.y0))
            if v_overlap > (lb.height * 0.35) or (yr.y0 <= lb.y0 and lb.y1 <= yr.y1):
                matching_spans.append(tl["text"])
        
        full_match_text = " ".join(matching_spans)
        all_highlight_matches.append({
            "page": page_num,
            "highlight_index": yr_idx + 1,
            "rect": [yr.x0, yr.y0, yr.x1, yr.y1],
            "text": full_match_text
        })

print(f"Total extracted highlights across all 7 pages: {len(all_highlight_matches)}")
for hm in all_highlight_matches:
    print(f"Page {hm['page']} #{hm['highlight_index']:02d}: {hm['text']}")
