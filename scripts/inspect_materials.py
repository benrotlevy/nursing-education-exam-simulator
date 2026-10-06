import os
import sys
from pypdf import PdfReader
from docx import Document

def inspect_pdf(pdf_path, max_pages=3):
    print(f"\n==========================================")
    print(f"Inspecting PDF: {os.path.basename(pdf_path)}")
    print(f"==========================================")
    try:
        reader = PdfReader(pdf_path)
        print(f"Total pages: {len(reader.pages)}")
        for i in range(min(max_pages, len(reader.pages))):
            page_text = reader.pages[i].extract_text() or ""
            print(f"--- Page {i+1} (length: {len(page_text)} chars) ---")
            lines = [l.strip() for l in page_text.splitlines() if l.strip()]
            preview = "\n".join(lines[:15])
            print(preview if preview else "[NO EXTRACTABLE TEXT ON THIS PAGE - MAY BE SCANNED IMAGE]")
    except Exception as e:
        print(f"Error inspecting {pdf_path}: {e}")

if __name__ == "__main__":
    # 1. Inspect central solved exam PDF
    inspect_pdf("raw_materials/exams/כל השחזורים עם תשובות.pdf", max_pages=4)
    # 2. Inspect course summary PDF
    inspect_pdf("raw_materials/summaries/סיכום חומר למבחן מסכם הדרכה קלינית.pdf", max_pages=3)
