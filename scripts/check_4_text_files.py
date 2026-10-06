import fitz
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

text_files = [
    "מבחן בית קורס הדרכה קלינית.pdf",
    "מקור לא ברור - מבחן לתרגול.pdf",
    "תרגילים להכנה למבחן ממשלתי (1).pdf",
    "אוסף שחזורים.pdf"
]

for fname in text_files:
    fpath = os.path.join("raw_materials/exams", fname)
    doc = fitz.open(fpath)
    print(f"\n==================================================")
    print(f"ANALYZING: {fname} (Pages: {len(doc)})")
    print(f"==================================================")
    
    # Check for bold fonts
    bold_spans = 0
    total_spans = 0
    yellow_fills = 0
    
    for p in doc:
        for d in p.get_drawings():
            f = d.get("fill")
            if f and f[0] > 0.8 and f[1] > 0.8 and f[2] < 0.2:
                yellow_fills += 1
                
        p_dict = p.get_text("dict")
        for b in p_dict["blocks"]:
            if "lines" in b:
                for l in b["lines"]:
                    for s in l["spans"]:
                        total_spans += 1
                        flags = s.get("flags", 0)
                        font = s.get("font", "").lower()
                        if (flags & 2 != 0) or ("bold" in font) or ("black" in font) or ("heavy" in font):
                            bold_spans += 1
                            
    print(f"Total text spans: {total_spans}, Bold spans: {bold_spans}")
    print(f"Yellow highlight drawings: {yellow_fills}")
    
    # Check if there is an answer key or answers at the end of the document
    last_page_text = doc[-1].get_text().strip()
    print(f"Last page snippet (first 200 chars):\n{last_page_text[:200]}\n")
