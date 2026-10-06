import json
import re
from docx import Document

def extract_docx_middle(path):
    doc = Document(path)
    questions = []
    lines = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    
    i = 0
    while i < len(lines):
        line = lines[i]
        # match question like 1) or 1.
        m = re.match(r'^(\d+)[\.\)]\s*(.+)$', line)
        if m:
            q_text = m.group(2).strip()
            # next line is likely the answer
            if i + 1 < len(lines):
                ans_text = lines[i+1].strip()
                if not re.match(r'^\d+[\.\)]', ans_text):
                    questions.append({
                        'source': 'שחזור מבחן אמצע 06.05.2025',
                        'question': q_text,
                        'answer': ans_text
                    })
                    i += 2
                    continue
        i += 1
    return questions

middle_qs = extract_docx_middle('raw_materials/exams/שחזור מבחן אמצע הדרכה קלינית 06.docx')
print(f"Extracted {len(middle_qs)} QA pairs from middle docx:")
for q in middle_qs[:3]:
    print("Q:", q['question'])
    print("A:", q['answer'])
