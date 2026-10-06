import fitz
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

doc = fitz.open("raw_materials/exams/אוסף שחזורים.pdf")
print("Total pages in אוסף שחזורים:", len(doc))

full_text = ""
for p_idx in range(len(doc)):
    txt = doc[p_idx].get_text()
    full_text += f"\n--- PAGE {p_idx+1} ---\n" + txt

with open("data/collection_dump.txt", "w", encoding="utf-8") as f:
    f.write(full_text)

print("Saved collection dump to data/collection_dump.txt")
print("Total characters:", len(full_text))

# Let's see some section headings or structure in collection_dump.txt
for line in full_text.splitlines()[:50]:
    if line.strip():
        print(line.strip())
