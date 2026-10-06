import fitz
import sys

sys.stdout.reconfigure(encoding='utf-8')
doc = fitz.open("raw_materials/exams/שחזור ממשלתי הדרכה קלינית 2024.pdf")
p = doc[0]

for b_idx, b in enumerate(p.get_text("dict")["blocks"]):
    if "lines" in b:
        print(f"--- Block {b_idx} (y0={b['bbox'][1]:.1f}) ---")
        for l in b["lines"]:
            text = "".join(s["text"] for s in l["spans"]).strip()
            print(f"  Line y0={l['bbox'][1]:.1f}, y1={l['bbox'][3]:.1f}: {repr(text)}")
