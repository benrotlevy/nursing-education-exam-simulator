import pypdf
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

pdf_path = 'raw_materials/exams/שחזור ממשלתי הדרכה קלינית 2024.pdf'
r = pypdf.PdfReader(pdf_path)

print(f"Total pages in 2024 PDF: {len(r.pages)}")

# Let's inspect page by page where '1 1 0 rg' or yellow color appears
for p_idx, page in enumerate(r.pages):
    stream = page['/Contents'].get_object().get_data().decode('latin1', errors='ignore')
    yellow_count = stream.count('1 1 0 rg')
    print(f"Page {p_idx+1}: {yellow_count} yellow highlight blocks")
