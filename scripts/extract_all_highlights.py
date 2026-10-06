import fitz
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
doc = fitz.open("raw_materials/exams/שחזור ממשלתי הדרכה קלינית 2024.pdf")

# We want detailed text lines and spans with their bbox on each page
for page_num in range(len(doc)):
    page = doc[page_num]
    
    # 1. Get yellow rects
    yellow_rects = []
    for d in page.get_drawings():
        fill = d.get("fill")
        if fill:
            r, g, b = fill[:3]
            if r > 0.8 and g > 0.8 and b < 0.2:
                yellow_rects.append(fitz.Rect(d["rect"]))
    yellow_rects.sort(key=lambda r: r.y0)
    
    # 2. Extract page dictionary with text lines and spans
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
                        "spans": line["spans"]
                    })
    lines_info.sort(key=lambda l: l["bbox"].y0)
    
    print(f"\n=======================================================")
    print(f"PAGE {page_num + 1} (Total lines: {len(lines_info)}, Yellow highlights: {len(yellow_rects)})")
    print(f"=======================================================")
    
    # Let's check overlaps for each yellow rect
    for yr_idx, yr in enumerate(yellow_rects):
        matching_lines = []
        for line in lines_info:
            # Check vertical overlap
            lb = line["bbox"]
            v_overlap = max(0, min(yr.y1, lb.y1) - max(yr.y0, lb.y0))
            if v_overlap > (lb.height * 0.4):
                matching_lines.append(line["text"])
        print(f"Highlight #{yr_idx+1} [y: {yr.y0:.1f}-{yr.y1:.1f}, x: {yr.x0:.1f}-{yr.x1:.1f}]: {' | '.join(matching_lines)}")

