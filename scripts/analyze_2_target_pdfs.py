import fitz
import sys
import re
import os

sys.stdout.reconfigure(encoding='utf-8')

fpaths = [
    "raw_materials/exams/מקור לא ברור - מבחן לתרגול.pdf",
    "raw_materials/exams/תרגילים להכנה למבחן ממשלתי (1).pdf"
]

for fpath in fpaths:
    fname = os.path.basename(fpath)
    doc = fitz.open(fpath)
    print(f"\n=======================================================")
    print(f"FILE: {fname} (Pages: {len(doc)})")
    print(f"=======================================================")
    
    for p_idx in range(len(doc)):
        page = doc[p_idx]
        
        # Yellow rects
        yellow_rects = []
        for d in page.get_drawings():
            f = d.get("fill")
            if f and f[0] > 0.8 and f[1] > 0.8 and f[2] < 0.2:
                yellow_rects.append(fitz.Rect(d["rect"]))
        yellow_rects.sort(key=lambda r: r.y0)
        
        # Text blocks
        page_dict = page.get_text("dict")
        lines_info = []
        for b in page_dict["blocks"]:
            if "lines" in b:
                for l in b["lines"]:
                    line_text = "".join(s["text"] for s in l["spans"]).strip()
                    is_bold = any(
                        (s.get("flags", 0) & 2 != 0) or ("bold" in s.get("font", "").lower())
                        for s in l["spans"]
                    )
                    if line_text:
                        lines_info.append({
                            "bbox": fitz.Rect(l["bbox"]),
                            "text": line_text,
                            "bold": is_bold
                        })
        lines_info.sort(key=lambda l: l["bbox"].y0)
        
        print(f"\n--- Page {p_idx + 1} (Lines: {len(lines_info)}, Yellow Rects: {len(yellow_rects)}) ---")
        
        # Print lines that overlap yellow rects
        for yr_idx, yr in enumerate(yellow_rects):
            matched = [li["text"] for li in lines_info if max(0, min(yr.y1, li["bbox"].y1) - max(yr.y0, li["bbox"].y0)) > (li["bbox"].height * 0.4)]
            print(f"  Highlight #{yr_idx+1}: {' | '.join(matched)}")
            
        # Print bold lines
        bold_lines = [li["text"] for li in lines_info if li["bold"]]
        if bold_lines:
            print(f"  Bold lines count: {len(bold_lines)}: {bold_lines[:3]}...")
