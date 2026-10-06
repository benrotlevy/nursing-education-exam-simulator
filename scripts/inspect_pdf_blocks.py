import fitz
import sys

sys.stdout.reconfigure(encoding='utf-8')
doc = fitz.open("raw_materials/exams/שחזור ממשלתי הדרכה קלינית 2024.pdf")

for page_idx in range(2):
    page = doc[page_idx]
    blocks = page.get_text("blocks")
    print(f"\n--- Page {page_idx + 1} Blocks ---")
    for b in blocks:
        # b: (x0, y0, x1, y1, text, block_no, block_type)
        print(f"Block y0={b[1]:.1f}, y1={b[3]:.1f}, x0={b[0]:.1f}, x1={b[2]:.1f}: {repr(b[4][:40])}")
