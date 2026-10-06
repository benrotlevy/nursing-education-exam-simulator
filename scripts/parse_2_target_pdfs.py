import fitz
import sys
import re
import json

sys.stdout.reconfigure(encoding='utf-8')

def parse_pdf_exam(fpath):
    doc = fitz.open(fpath)
    questions = []
    
    for p_idx in range(len(doc)):
        page = doc[p_idx]
        p_num = p_idx + 1
        
        # Yellow rects
        yellow_rects = []
        for d in page.get_drawings():
            f = d.get("fill")
            if f and f[0] > 0.8 and f[1] > 0.8 and f[2] < 0.2:
                yellow_rects.append(fitz.Rect(d["rect"]))
        yellow_rects.sort(key=lambda r: r.y0)
        
        # Extract blocks
        page_dict = page.get_text("dict")
        lines = []
        for b in page_dict["blocks"]:
            if "lines" in b:
                for l in b["lines"]:
                    lt = "".join(s["text"] for s in l["spans"]).strip()
                    if lt:
                        lines.append({
                            "bbox": fitz.Rect(l["bbox"]),
                            "text": lt,
                            "page": p_num
                        })
        lines.sort(key=lambda l: (l["bbox"].y0, -l["bbox"].x1))
        
        # Let's inspect text lines on this page
        # Questions start with number + period: "1 .", "2 .", "1.", etc.
        # Options start with letter + period: "א.", "ב.", "ג.", "ד."
        # Store for full processing
        questions.append({
            "page": p_num,
            "lines": lines,
            "yellow_rects": yellow_rects
        })
        
    return questions

p1 = parse_pdf_exam("raw_materials/exams/תרגילים להכנה למבחן ממשלתי (1).pdf")
p2 = parse_pdf_exam("raw_materials/exams/מקור לא ברור - מבחן לתרגול.pdf")

print(f"File 1 (תרגילים) parsed {len(p1)} pages.")
print(f"File 2 (מקור לתרגול) parsed {len(p2)} pages.")
