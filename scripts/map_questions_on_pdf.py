import fitz
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
doc = fitz.open("raw_materials/exams/שחזור ממשלתי הדרכה קלינית 2024.pdf")

# We want to associate each question with its text, options, and check if one of its options is highlighted
all_parsed_questions = []

for page_num in range(len(doc)):
    page = doc[page_num]
    
    # 1. Yellow rects
    yellow_rects = []
    for d in page.get_drawings():
        fill = d.get("fill")
        if fill:
            r, g, b = fill[:3]
            if r > 0.8 and g > 0.8 and b < 0.2:
                yellow_rects.append(fitz.Rect(d["rect"]))
    yellow_rects.sort(key=lambda r: r.y0)
    
    # 2. Text lines
    page_dict = page.get_text("dict")
    lines_info = []
    for block in page_dict["blocks"]:
        if "lines" in block:
            for line in block["lines"]:
                line_bbox = fitz.Rect(line["bbox"])
                line_text = "".join(span["text"] for span in line["spans"]).strip()
                if line_text:
                    lines_info.append({
                        "bbox": line_bbox,
                        "text": line_text,
                    })
    lines_info.sort(key=lambda l: (l["bbox"].y0, -l["bbox"].x1))
    
    # 3. Identify question starts: line matching r'^\s*(\d+)\s*[\.\)]'
    # Note: Sometimes number is separate line or combined
    # Let's see all lines on this page
    print(f"\n==========================================")
    print(f"ANALYZING PAGE {page_num + 1}")
    print(f"==========================================")
    
    # Let's inspect question boundaries
    q_lines = []
    for idx, l in enumerate(lines_info):
        t = l["text"]
        # Look for question number
        m = re.match(r'^(\d+)\s*[\.\)]', t)
        if m and int(m.group(1)) not in [2024]: # exclude year
            q_lines.append((idx, int(m.group(1)), l))
            
    print(f"Detected {len(q_lines)} question starts: {[q[1] for q in q_lines]}")
    for idx, q_num, l in q_lines:
        print(f"  Q{q_num} at y0={l['bbox'].y0:.1f}: {l['text'][:50]}")

