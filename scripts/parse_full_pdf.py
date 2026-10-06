import re
import json
import sys
from pypdf import PdfReader

sys.stdout.reconfigure(encoding='utf-8')

CATEGORIES = [
    ("תיאוריות למידה ולמידת מבוגרים", [
        "בלום", "bloom", "קולב", "kolb", "נואלס", "knowles", "אנדרגוגיה", "עומס קוגניטיבי", 
        "סוולר", "sweller", "בנדורה", "bandura", "גשטאלט", "סגנון למידה", "סגנונות למידה",
        "אנליזה", "סינתזה", "טקסונומיה", "problem centered", "subject centered", "קוגניטיב",
        "פירמידת", "זכירה", "הבנה", "יישום", "היררכיית", "למידת מבוגרים"
    ]),
    ("מיומנויות פסיכומוטוריות וסימולציה", [
        "פסיכומוטור", "סימולציה", "simulation", "פיטס", "פוסנר", "fitts", "posner", 
        "דבריפינג", "דה בריפינג", "debriefing", "הזרקה", "מזרק", "מיומנות", "תרגול", 
        "הדגמה", "אינסולין", "מיומנויות קליניות", "שריר", "אסוציאטיבי", "אוטונומי",
        "עירוי", "פעולה קלינית", "חבישה", "פרוצדורה"
    ]),
    ("משוב, הערכה ורפלקציה", [
        "משוב", "feedback", "פנדלטון", "pendleton", "רפלקצי", "הערכה מעצבת", "הערכה מסכמת", 
        "הטיות", "הטיה", "halo", "leniency", "שאלות צרות", "שאלות ממוקדות", "ציון", "פורמטיב",
        "סומטיב", "מבחן", "משוב בונה", "שיחת משוב", "רפלקציה"
    ]),
    ("הסטודנט המתקשה ותוכניות התערבות", [
        "בסיכון", "כישלון", "הכשלה", "להכשיל", "מתקשה", "קשיים", "remediation", "השלמה לימודית",
        "אירוע חריג", "אירועים חריגים", "שפת אם", "התערבות", "זיוף", "חסר ביטחון", "נכשל"
    ]),
    ("אתיקה, חוק ובטיחות המטופל", [
        "בטיחות המטופל", "בטיחות", "safety", "אתיקה", "חוק", "זכויות החולה", "סירוב", "הפטיטיס", 
        "רשלנות", "חיסיון", "סודיות", "מוות", "סוף חיים", "הסכמה מדעת", "דיווח", "עבירה"
    ]),
    ("תפקיד המדריך ויחסי מדריך-סטודנט", [
        "מדריך", "מדריכה", "חונכות", "מנטורינג", "mentoring", "חונך", "מודל לחיקוי", 
        "role model", "יחסי", "תקשורת", "קונפליקט", "חרדה", "העלבת", "גידוף", "שותפות",
        "deu", "academic partnership", "רופא", "צוות מחלקה", "אמפתיה", "קליטה", "יום ראשון"
    ])
]

def classify_question(text):
    text_lower = text.lower()
    scores = {}
    for cat_name, keywords in CATEGORIES:
        score = sum(1 for kw in keywords if kw.lower() in text_lower)
        if score > 0:
            scores[cat_name] = score
    if scores:
        return max(scores.items(), key=lambda x: x[1])[0]
    return "תפקיד המדריך ויחסי מדריך-סטודנט"

def clean_text(t):
    if not t:
        return ""
    t = re.sub(r'^[א-דa-d0-9]+[\.\)\-]\s*', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def parse_full_pdf(pdf_path):
    reader = PdfReader(pdf_path)
    total_pages = len(reader.pages)
    print(f"Reading all {total_pages} pages from {pdf_path}...")
    
    all_lines = []
    current_source = "שחזור מבחן ממשלתי"
    source_pattern = re.compile(r'(שחזור\s+מבחן|מבחן\s+ממשלתי|מועד\s+[א-ג]|שחזור\s+\d{4})')
    
    for page_idx in range(total_pages):
        page = reader.pages[page_idx]
        spans = []
        def visitor(text, cm, tm, fontDict, fontSize):
            if text:
                basefont = fontDict.get('/BaseFont', '') if fontDict else ''
                is_bold = 'Bold' in basefont
                spans.append((text, is_bold))
        page.extract_text(visitor_text=visitor)
        
        lines = []
        cur_line = []
        for text, is_bold in spans:
            parts = text.split('\n')
            for i, p in enumerate(parts):
                if i > 0:
                    if cur_line:
                        lines.append(cur_line)
                        cur_line = []
                if p:
                    cur_line.append((p, is_bold))
        if cur_line:
            lines.append(cur_line)
            
        for l_spans in lines:
            t = "".join(s for s, _ in l_spans).strip()
            t = re.sub(r'\s+', ' ', t).strip()
            if not t:
                continue
            is_bold = any(b for s, b in l_spans if s.strip())
            all_lines.append({'text': t, 'is_bold': is_bold, 'page': page_idx + 1})

    print(f"Extracted {len(all_lines)} lines across all pages.")

    q_pattern = re.compile(r'^(\d{1,3})\s*[\.\?\)]\s*(.+)$')
    opt_pattern = re.compile(r'^([א-דa-d])\s*[\.\)]\s*(.+)$')

    def is_question_header(idx, flist):
        m = q_pattern.match(flist[idx]['text'])
        if not m:
            return False
        # look ahead up to 5 lines for 'א.' or 'א '
        for offset in range(1, 6):
            if idx + offset < len(flist):
                if opt_pattern.match(flist[idx + offset]['text']):
                    return True
        return False

    questions = []
    current_q = None
    curr_source = "שחזור מבחן ממשלתי"

    for idx, line_info in enumerate(all_lines):
        text = line_info['text']
        is_bold = line_info['is_bold']

        if source_pattern.search(text) and len(text) < 60 and not q_pattern.match(text) and not opt_pattern.match(text):
            curr_source = text
            continue

        if is_question_header(idx, all_lines):
            if current_q and len(current_q['options']) >= 2:
                questions.append(current_q)
            m = q_pattern.match(text)
            current_q = {
                'id': f"q_{len(questions)+1:04d}",
                'source': curr_source,
                'question': m.group(2).strip(),
                'options': [],
                'correctIndex': None,
                'explanation_lines': [],
                'verified': True,
                'category': "",
                'state': 'in_q'
            }
            continue

        if current_q:
            opt_match = opt_pattern.match(text)
            if opt_match and current_q['state'] in ['in_q', 'in_opt']:
                current_q['state'] = 'in_opt'
                current_q['options'].append(opt_match.group(2).strip())
                if is_bold and current_q['correctIndex'] is None:
                    current_q['correctIndex'] = len(current_q['options']) - 1
                continue

            if current_q['state'] == 'in_q':
                current_q['question'] += " " + text
            elif current_q['state'] in ['in_opt', 'in_expl']:
                # If we're after the options, everything until the next real question is part of the explanation!
                if current_q['state'] == 'in_opt' and len(current_q['options']) < 4 and len(text) < 70 and not any(w in text for w in ["בספר", "עמוד", "פרק", "מדברים", "לפי", "הסבר"]):
                    current_q['options'][-1] += " " + text
                    if is_bold and current_q['correctIndex'] is None:
                        current_q['correctIndex'] = len(current_q['options']) - 1
                else:
                    curr_len = sum(len(x) for x in current_q['explanation_lines'])
                    # Stop if explanation hits another numbered flashcard/question or is too long
                    if curr_len < 1000 and not re.match(r'^\d{1,3}\s*[\.\?\)]\s*.+\?', text):
                        current_q['state'] = 'in_expl'
                        current_q['explanation_lines'].append(text)

    if current_q and len(current_q['options']) >= 2:
        questions.append(current_q)

    # Process explanations and clean questions
    valid_questions = []
    seen = set()

    for q in questions:
        if q['correctIndex'] is None or not (0 <= q['correctIndex'] < len(q['options'])):
            continue
        if len(q['options']) not in [3, 4]:
            continue

        clean_q = clean_text(q['question'])
        if len(clean_q) < 10:
            continue

        norm_key = re.sub(r'[^\w]', '', clean_q)[:50]
        if norm_key in seen:
            continue
        seen.add(norm_key)

        cleaned_options = [clean_text(opt) for opt in q['options']]
        if any(len(opt) == 0 for opt in cleaned_options):
            continue
        if len(set(cleaned_options)) != len(cleaned_options):
            continue

        # Combine all explanation lines
        expl_text = " ".join(q['explanation_lines']).strip()
        expl_text = re.sub(r'\s+', ' ', expl_text).strip()

        # If no explanation was found in the PDF
        if not expl_text:
            expl_text = f"התשובה הנכונה היא: '{cleaned_options[q['correctIndex']]}'."
        else:
            expl_text = clean_text(expl_text)

        full_context = clean_q + " " + " ".join(cleaned_options) + " " + expl_text
        category = classify_question(full_context)

        valid_questions.append({
            'id': f"q_{len(valid_questions)+1:03d}",
            'source': q['source'],
            'category': category,
            'question': clean_q,
            'options': cleaned_options,
            'correctIndex': q['correctIndex'],
            'explanation': expl_text,
            'verified': True
        })

    print(f"Total curated clean questions: {len(valid_questions)}")
    has_full_expl = sum(1 for q in valid_questions if not q['explanation'].startswith('התשובה הנכונה היא:'))
    print(f"Questions with FULL explanations: {has_full_expl}")
    print(f"Questions with fallback (no explanation in PDF): {len(valid_questions) - has_full_expl}")

    return valid_questions

if __name__ == "__main__":
    valid_qs = parse_full_pdf('raw_materials/exams/כל השחזורים עם תשובות.pdf')
    
    js_content = "/**\n * מאגר שאלות למבחן על-בסיסי בהדרכה קלינית\n"
    js_content += f" * סך הכל שאלות מאומתות: {len(valid_qs)}\n"
    js_content += " */\n\n"
    js_content += "window.EXAM_QUESTIONS = " + json.dumps(valid_qs, ensure_ascii=False, indent=2) + ";\n"
    
    with open('questions.js', 'w', encoding='utf-8') as f:
        f.write(js_content)
        
    with open('data/clean_questions.json', 'w', encoding='utf-8') as f:
        json.dump(valid_qs, f, ensure_ascii=False, indent=2)

    print("Updated questions.js successfully!")
