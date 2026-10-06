import fitz
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

doc = fitz.open("raw_materials/exams/מבחן בית קורס הדרכה קלינית.pdf")
print("Total pages in מבחן בית:", len(doc))

full_text = ""
for p_idx, page in enumerate(doc):
    txt = page.get_text()
    print(f"\n--- Page {p_idx + 1} (chars: {len(txt)}) ---")
    print(txt[:300].strip())
    full_text += f"\n--- PAGE {p_idx+1} ---\n" + txt

with open("data/home_exam_dump.txt", "w", encoding="utf-8") as f:
    f.write(full_text)

print("\nSaved full text to data/home_exam_dump.txt")
