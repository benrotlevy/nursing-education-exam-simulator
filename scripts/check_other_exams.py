import sys
from pypdf import PdfReader

sys.stdout.reconfigure(encoding='utf-8')

for pdf in [
    'raw_materials/exams/שחזור ממשלתי הדרכה קלינית 2024.pdf',
    'raw_materials/exams/שחזור מבחן ממשלתי הדרכה קלינית 2021.pdf',
    'raw_materials/exams/שחזור ממשלתי הדרכה קלינית 2024_240115_091008.pdf'
]:
    try:
        reader = PdfReader(pdf)
        print(f"\n{pdf}: {len(reader.pages)} pages")
        p1 = reader.pages[0].extract_text() or ""
        print("Page 1 length:", len(p1))
        lines = [l.strip() for l in p1.splitlines() if l.strip()]
        for l in lines[:5]:
            print("  ", l)
    except Exception as e:
        print(f"Error {pdf}: {e}")
