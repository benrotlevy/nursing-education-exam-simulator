import fitz
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

all_files = os.listdir("raw_materials/exams")

ALREADY_PROCESSED = [
    "כל השחזורים עם תשובות.pdf",
    "שחזור הדרכה קלינית 23-12-25.docx",
    "שחזור מבחן אמצע הדרכה קלינית 06.docx",
    "שחזור מבחן מאי הדרכה קלינית.docx",
    "שחזור ממשלתי הדרכה קלינית 2024.pdf",
    "שחזור ממשלתי הדרכה קלינית 2024_240115_091008.pdf",
    "שחזור ממשלתי הדרכה קלינית 2024_241213_064107.pdf",
    "שחזור הדרכה  שלינית 2024 - ערעור.pdf",
    "מבחן מסכם בהדרכה קלינית 2023_0.pdf",
    "מבחן.pdf"
]

remaining = []
for f in all_files:
    if f not in ALREADY_PROCESSED:
        remaining.append(f)

print(f"Remaining unprocessed / unindexed files count: {len(remaining)}")

for fname in remaining:
    fpath = os.path.join("raw_materials/exams", fname)
    fsize = os.path.getsize(fpath)
    print(f"\n==================================================")
    print(f"FILE: {fname} (Size: {fsize:,} bytes)")
    print(f"==================================================")
    
    try:
        doc = fitz.open(fpath)
        print(f"Total Pages: {len(doc)}")
        
        total_text_len = 0
        has_images = 0
        drawings_count = 0
        
        for p_idx in range(len(doc)):
            p = doc[p_idx]
            txt = p.get_text()
            total_text_len += len(txt.strip())
            imgs = p.get_images()
            if imgs:
                has_images += len(imgs)
            dwgs = p.get_drawings()
            drawings_count += len(dwgs)
            
        print(f"Total text characters: {total_text_len:,}")
        print(f"Total embedded images: {has_images}")
        print(f"Total vector drawings: {drawings_count}")
        
        p0_text = doc[0].get_text()[:300].strip()
        print(f"Page 1 sample:\n{p0_text}\n")
        
    except Exception as e:
        print(f"ERROR reading file: {e}")
