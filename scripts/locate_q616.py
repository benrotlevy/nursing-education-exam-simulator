import json
import sys
from pypdf import PdfReader

sys.stdout.reconfigure(encoding='utf-8')

reader = PdfReader('raw_materials/exams/כל השחזורים עם תשובות.pdf')

for idx, p in enumerate(reader.pages):
    t = p.extract_text()
    if 'לפיגישה מוטיבציונית, התנגדות הינה?' in t or 'מה מאפיין הקשבה משקפת בהתנגדות' in t:
        print(f"Found on page {idx+1}")
        print(t[:400])
        print("="*40)
