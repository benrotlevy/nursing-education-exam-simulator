import re
import json
import sys
from pypdf import PdfReader

sys.stdout.reconfigure(encoding='utf-8')

CATEGORIES = [
    ("תיאוריות למידה ולמידת מבוגרים", [
        "בלום", "bloom", "קולב", "kolb", "נואלס", "knowles", "אנדרגוגיה", "עומס קוגניטיבי", 
        "סוולר", "sweller", "בנדורה", "bandura", "גשטאלט", "סגנון למידה", "סגנונות למידה",
        "אנליזה", "סינתזה", "טקסונומיה", "problem centered", "subject centered", "קוגניטיב"
    ]),
    ("מיומנויות פסיכומוטוריות וסימולציה", [
        "פסיכומוטור", "סימולציה", "simulation", "פיטס", "פוסנר", "fitts", "posner", 
        "דבריפינג", "דה בריפינג", "debriefing", "הזרקה", "מזרק", "מיומנות", "תרגול", 
        "הדגמה", "אינסולין", "מיומנויות קליניות", "שריר", "אסוציאטיבי", "אוטונומי"
    ]),
    ("משוב, הערכה ורפלקציה", [
        "משוב", "feedback", "פנדלטון", "pendleton", "רפלקצי", "הערכה מעצבת", "הערכה מסכמת", 
        "הטיות", "הטיה", "halo", "leniency", "שאלות צרות", "שאלות ממוקדות", "הערכה", "מבחן"
    ]),
    ("הסטודנט המתקשה ותוכניות התערבות", [
        "בסיכון", "כישלון", "הכשלה", "להכשיל", "מתקשה", "קשיים", "remediation", "השלמה לימודית",
        "אירוע חריג", "אירועים חריגים", "שפת אם", "התערבות", "זיוף"
    ]),
    ("אתיקה, חוק ובטיחות המטופל", [
        "בטיחות המטופל", "בטיחות", "safety", "אתיקה", "חוק", "זכויות החולה", "סירוב", "הפטיטיס", 
        "רשלנות", "חיסיון", "סודיות"
    ]),
    ("תפקיד המדריך ויחסי מדריך-סטודנט", [
        "מדריך", "מדריכה", "חונכות", "מנטורינג", "mentoring", "חונך", "מודל לחיקוי", 
        "role model", "יחסי", "תקשורת", "קונפליקט", "חרדה", "העלבת", "גידוף", "שותפות"
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

def parse_pdf_all(pdf_path, max_pages=None):
    reader = PdfReader(pdf_path)
    total_pages = len(reader.pages) if max_pages is None else min(max_pages, len(reader.pages))
    print(f"Processing {total_pages} pages from {pdf_path}...")
    
    all_lines = []
    current_source = "שחזור מבחן ממשלתי"
    
    for page_idx in range(total_pages):
        page = reader.pages[page_idx]
        spans = []
        def visitor(text, cm, tm, fontDict, fontSize):
            if text:
                basefont = fontDict.get('/BaseFont', '') if fontDict else ''
                is_bold = 'Bold' in basefont
                spans.append((text, is_bold))
        page.extract_text(visitor_text=visitor)
        
        # reconstruct lines
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
            # clean weird spaces
            t = re.sub(r'\s+', ' ', t).strip()
            if not t:
                continue
            is_bold = any(b for s, b in l_spans if s.strip())
            all_lines.append({'text': t, 'is_bold': is_bold, 'page': page_idx + 1})

    print(f"Total extracted lines: {len(all_lines)}")
    return all_lines

def extract_questions_from_lines(lines):
    questions = []
    current_source = "מבחן ממשלתי משוחזר"
    
    q_pattern = re.compile(r'^(\d{1,3})\s*[\.\?\)]\s*(.+)$')
    opt_pattern = re.compile(r'^([א-דa-d])\s*[\.\)]\s*(.+)$')
    source_pattern = re.compile(r'(שחזור\s+מבחן|מבחן\s+ממשלתי|מועד\s+[א-ג]|שחזור\s+\d{4})')
    
    current_q = None
    
    for line_info in lines:
        text = line_info['text']
        is_bold = line_info['is_bold']
        
        # Check if line is source header
        if source_pattern.search(text) and len(text) < 60 and not q_pattern.match(text) and not opt_pattern.match(text):
            current_source = text
            continue
            
        # Check if new question
        q_match = q_pattern.match(text)
        if q_match and len(text) > 8:
            if current_q and len(current_q['options']) >= 2:
                questions.append(current_q)
            current_q = {
                'id': f"q_{len(questions)+1:03d}",
                'source': current_source,
                'question': q_match.group(2).strip(),
                'options': [],
                'correctIndex': None,
                'explanation': "",
                'verified': True,
                'category': ""
            }
            continue
            
        # Check if option
        opt_match = opt_pattern.match(text)
        if opt_match and current_q:
            opt_letter = opt_match.group(1)
            opt_text = opt_match.group(2).strip()
            opt_idx = len(current_q['options'])
            current_q['options'].append(opt_text)
            if is_bold and current_q['correctIndex'] is None:
                current_q['correctIndex'] = opt_idx
            continue
            
        # If we have current question and options, it might be continuation of option or explanation
        if current_q:
            if current_q['options']:
                # If it looks like an explanation / book reference
                if any(ref_word in text for ref_word in ["פרק", "עמוד", "ספר", "אבירם", "הסבר", "לפי", "נמצא"]):
                    if current_q['explanation']:
                        current_q['explanation'] += " " + text
                    else:
                        current_q['explanation'] = text
                elif len(current_q['options']) < 4 and len(text) < 120 and not text.startswith("Page"):
                    # Might be multiline option or option without letter
                    # If current_q has last option, append
                    current_q['options'][-1] += " " + text
                    if is_bold and current_q['correctIndex'] is None:
                        current_q['correctIndex'] = len(current_q['options']) - 1
            else:
                # Continuation of question text
                current_q['question'] += " " + text

    if current_q and len(current_q['options']) >= 2:
        questions.append(current_q)

    # Post processing: categories and default explanations
    valid_questions = []
    for q in questions:
        # Must have at least 2 options and a detected correctIndex
        if q['correctIndex'] is not None and 0 <= q['correctIndex'] < len(q['options']):
            full_context = q['question'] + " " + " ".join(q['options']) + " " + q['explanation']
            q['category'] = classify_question(full_context)
            if not q['explanation']:
                correct_opt_text = q['options'][q['correctIndex']]
                q['explanation'] = f"התשובה הנכונה היא: '{correct_opt_text}'."
            valid_questions.append(q)
            
    print(f"Total raw questions found: {len(questions)}")
    print(f"Total verified questions with bold answers: {len(valid_questions)}")
    return valid_questions

if __name__ == "__main__":
    # Test on first 30 pages
    lines = parse_pdf_all('raw_materials/exams/כל השחזורים עם תשובות.pdf', max_pages=30)
    qs = extract_questions_from_lines(lines)
    
    with open('data/test_extracted_qs.json', 'w', encoding='utf-8') as f:
        json.dump(qs, f, ensure_ascii=False, indent=2)
    print("Sample output written to data/test_extracted_qs.json")
