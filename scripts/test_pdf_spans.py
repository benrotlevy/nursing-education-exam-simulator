import re
import sys
from pypdf import PdfReader

sys.stdout.reconfigure(encoding='utf-8')

def parse_page_spans(page):
    spans = []
    def visitor(text, cm, tm, fontDict, fontSize):
        if text:
            basefont = fontDict.get('/BaseFont', '') if fontDict else ''
            is_bold = 'Bold' in basefont
            spans.append((text, is_bold))
    page.extract_text(visitor_text=visitor)
    return spans

def spans_to_lines(spans):
    lines = []
    cur_line = []
    for text, is_bold in spans:
        # split by newlines if any
        parts = text.split('\n')
        for idx, part in enumerate(parts):
            if idx > 0:
                if cur_line:
                    lines.append(cur_line)
                    cur_line = []
            if part:
                cur_line.append((part, is_bold))
    if cur_line:
        lines.append(cur_line)
        
    formatted_lines = []
    for line_spans in lines:
        line_text = "".join(t for t, _ in line_spans).strip()
        has_bold = any(b for t, b in line_spans if t.strip())
        if line_text:
            formatted_lines.append({
                'text': line_text,
                'is_bold': has_bold
            })
    return formatted_lines

reader = PdfReader('raw_materials/exams/כל השחזורים עם תשובות.pdf')
print(f'Total pages in PDF: {len(reader.pages)}')

# Test on first 5 pages
for page_num in range(5):
    lines = spans_to_lines(parse_page_spans(reader.pages[page_num]))
    print(f"\n--- Page {page_num+1} ({len(lines)} lines) ---")
    for l in lines[:10]:
        bold_flag = "[BOLD]" if l['is_bold'] else "      "
        print(f"{bold_flag} {l['text']}")
