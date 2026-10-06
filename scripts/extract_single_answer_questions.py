import json
import re
import sys
import pypdf

sys.stdout.reconfigure(encoding='utf-8')

single_answer_qs = []
counter = 1

# 1. From שחזור מבחן מאי הדרכה קלינית.txt
with open('data/שחזור מבחן מאי הדרכה קלינית.txt', encoding='utf-8') as f:
    may_lines = [l.strip() for l in f if l.strip()]

for line in may_lines:
    if '-' in line and not line.startswith('שחזור'):
        parts = line.split('-', 1)
        q_text = parts[0].strip()
        ans_text = parts[1].strip()
        if len(q_text) > 5 and len(ans_text) > 2:
            single_answer_qs.append({
                "id": f"single_may_{counter:03d}",
                "sourceFile": "raw_materials/exams/שחזור מבחן מאי הדרכה קלינית.docx",
                "sourceLocation": "קובץ שחזור מאי (רשימת היגדים)",
                "question": q_text,
                "knownAnswer": ans_text,
                "category": "שונות / הדרכה קלינית",
                "notes": "היגד שחזור של סטודנטים הכולל שאלה ותשובה נכונה בלבד ללא מסיחים"
            })
            counter += 1

# 2. From שחזור מבחן אמצע הדרכה קלינית 06.txt
with open('data/שחזור מבחן אמצע הדרכה קלינית 06.txt', encoding='utf-8') as f:
    mid_lines = [l.strip() for l in f if l.strip()]

for i in range(len(mid_lines) - 1):
    curr = mid_lines[i]
    nxt = mid_lines[i+1]
    # If curr has question mark or question number and nxt doesn't start with number
    if re.match(r'^\d+[\.\)]', curr) and not re.match(r'^\d+[\.\)]', nxt):
        single_answer_qs.append({
            "id": f"single_mid_{counter:03d}",
            "sourceFile": "raw_materials/exams/שחזור מבחן אמצע הדרכה קלינית 06.docx",
            "sourceLocation": f"שאלה {curr[:15]}",
            "question": curr,
            "knownAnswer": nxt,
            "category": "שחזור מבחן אמצע",
            "notes": "שאלת שחזור עם תשובה קצרה"
        })
        counter += 1

# 3. From שחזור ממשלתי 2024 (exam_2024_dump.txt)
with open('data/exam_2024_dump.txt', encoding='utf-8') as f:
    dump_2024 = f.read()

lines_2024 = dump_2024.splitlines()
for i, l in enumerate(lines_2024):
    m = re.match(r'^(\d+)\s*[\.\)]\s*(.*)', l.strip())
    if m:
        num = int(m.group(1))
        content = m.group(2).strip()
        # Check if the line itself contains an answer after a dash or question mark
        if '?' in content and len(content.split('?')) > 1 and len(content.split('?')[1].strip()) > 2:
            parts = content.split('?')
            single_answer_qs.append({
                "id": f"single_2024_{counter:03d}",
                "sourceFile": "raw_materials/exams/שחזור ממשלתי הדרכה קלינית 2024.pdf",
                "sourceLocation": f"שאלה {num}",
                "question": parts[0].strip() + '?',
                "knownAnswer": parts[1].strip(),
                "category": "מבחן ממשלתי 2024",
                "notes": "שאלת זיכרון עם תשובה בודדת רשומה בשורת השאלה"
            })
            counter += 1
        elif num in [49, 56, 57, 61, 62, 64, 67, 68, 69, 72]:
            # Inspect next 1-2 lines
            opts = []
            for j in range(1, 4):
                if i + j < len(lines_2024):
                    nxt_l = lines_2024[i+j].strip()
                    if re.match(r'^\d+\s*[\.\)]', nxt_l):
                        break
                    if nxt_l:
                        opts.append(nxt_l)
            if len(opts) <= 1:
                ans = opts[0] if opts else "תשובת זיכרון משוחזרת"
                single_answer_qs.append({
                    "id": f"single_2024_{counter:03d}",
                    "sourceFile": "raw_materials/exams/שחזור ממשלתי הדרכה קלינית 2024.pdf",
                    "sourceLocation": f"שאלה {num}",
                    "question": content,
                    "knownAnswer": ans,
                    "category": "מבחן ממשלתי 2024",
                    "notes": "שאלה עם מסיח/תשובה בודדת שנזכרה בלבד"
                })
                counter += 1

# 4. From כל השחזורים עם תשובות.pdf (pages 228-270 sample of single-option items)
pdf_path = 'raw_materials/exams/כל השחזורים עם תשובות.pdf'
reader = pypdf.PdfReader(pdf_path)
for p_idx in range(227, min(275, len(reader.pages))):
    text = reader.pages[p_idx].extract_text() or ''
    p_lines = [l.strip() for l in text.splitlines() if l.strip()]
    for idx_l, pl in enumerate(p_lines):
        # Look for pattern: <number>. <question> followed immediately by only "א. <answer>"
        m_q = re.match(r'^(\d+)\.\s*(.+)', pl)
        if m_q and '?' in pl or (m_q and len(m_q.group(2)) > 10):
            # check next lines
            if idx_l + 1 < len(p_lines) and p_lines[idx_l+1].startswith('א.'):
                if idx_l + 2 >= len(p_lines) or not p_lines[idx_l+2].startswith('ב.'):
                    single_answer_qs.append({
                        "id": f"single_pdf_{counter:03d}",
                        "sourceFile": "raw_materials/exams/כל השחזורים עם תשובות.pdf",
                        "sourceLocation": f"עמוד {p_idx+1}, פריט {m_q.group(1)}",
                        "question": m_q.group(2).strip(),
                        "knownAnswer": p_lines[idx_l+1].replace('א.', '').strip(),
                        "category": "כרטיסיות שחזור",
                        "notes": "שאלת תרגול עם מסיח א' בלבד ללא מסיחים נוספים"
                    })
                    counter += 1

print(f"Total single-answer / recall questions extracted: {len(single_answer_qs)}")

# Save to data/single_answer_raw_questions.json
with open('data/single_answer_raw_questions.json', 'w', encoding='utf-8') as f:
    json.dump(single_answer_qs, f, ensure_ascii=False, indent=2)

print("Saved data/single_answer_raw_questions.json")

# Generate docs/single_answer_questions.md
md = "# 📋 מאגר שאלות עם תשובה בודדת (ללא מסיחים) להרחבה עתידית\n\n"
md += "מסמך זה מרכז את כל שאלות השחזור מתוך קובצי המקור שנמצאו עם **תשובה נכונה בודדת בלבד** (או כרטיסיית זיכרון) ללא 4 מסיחים אמריקאיים.\n"
md += "שאלות אלו **אינן נכללות כרגע במאגר הפעיל באתר** כדי לשמור על תקינות סימולטור המבחן, אך הן מהוות מאגר יקר-ערך של תוכן לבניית מסיחים עתידיים.\n\n"
md += f"**סך הכל שאלות שחולצו ותועדו:** **{len(single_answer_qs)} שאלות**\n\n"
md += "---\n\n"

# Group by sourceFile
by_source = {}
for q in single_answer_qs:
    sf = q['sourceFile']
    by_source.setdefault(sf, []).append(q)

for src, q_list in by_source.items():
    md += f"## 📁 מקור: `{src}` ({len(q_list)} שאלות)\n\n"
    for item in q_list:
        md += f"### 🔹 {item['id']} ({item['sourceLocation']})\n"
        md += f"* **השאלה/ההיגד:** {item['question']}\n"
        md += f"* **התשובה הידועה מהמקור:** **{item['knownAnswer']}**\n"
        md += f"* **הערה:** {item['notes']}\n\n"

with open('docs/single_answer_questions.md', 'w', encoding='utf-8') as f:
    f.write(md)

print("Saved docs/single_answer_questions.md")
