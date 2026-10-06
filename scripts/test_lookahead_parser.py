import re
import sys
from pypdf import PdfReader

sys.stdout.reconfigure(encoding='utf-8')

reader = PdfReader('raw_materials/exams/כל השחזורים עם תשובות.pdf')

# Let's extract lines from page 82 to 84
lines = []
for p_idx in [81, 82, 83]:
    page = reader.pages[p_idx]
    spans = []
    def visitor(text, cm, tm, fontDict, fontSize):
        if text:
            basefont = fontDict.get('/BaseFont', '') if fontDict else ''
            is_bold = 'Bold' in basefont
            spans.append((text, is_bold))
    page.extract_text(visitor_text=visitor)
    
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

formatted = []
for l in lines:
    t = "".join(s for s, _ in l).strip()
    t = re.sub(r'\s+', ' ', t).strip()
    if t:
        b = any(b for _, b in l if _ .strip())
        formatted.append({'text': t, 'is_bold': b})

# Improved parser:
# A line is a Question Header if:
# - It matches ^(\d{1,3})\s*[\.\?\)]\s*(.+)$
# - AND looking ahead in the next 1-6 lines, there is an option starting with 'א.'
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

parsed_qs = []
curr_q = None

for idx, item in enumerate(formatted):
    txt = item['text']
    b = item['is_bold']
    
    if is_question_header(idx, formatted):
        if curr_q:
            parsed_qs.append(curr_q)
        m = q_pattern.match(txt)
        curr_q = {
            'num': m.group(1),
            'question': m.group(2).strip(),
            'options': [],
            'correctIndex': None,
            'explanation_lines': [],
            'state': 'in_q' # 'in_q', 'in_opt', 'in_expl'
        }
        continue
        
    if curr_q:
        opt_match = opt_pattern.match(txt)
        if opt_match and curr_q['state'] in ['in_q', 'in_opt']:
            curr_q['state'] = 'in_opt'
            curr_q['options'].append(opt_match.group(2).strip())
            if b and curr_q['correctIndex'] is None:
                curr_q['correctIndex'] = len(curr_q['options']) - 1
            continue
            
        if curr_q['state'] == 'in_q':
            # multiline question
            curr_q['question'] += " " + txt
        elif curr_q['state'] in ['in_opt', 'in_expl']:
            # After options have started, if it's not a new option, it's either continuation of option or explanation
            if curr_q['state'] == 'in_opt' and len(curr_q['options']) < 4 and len(txt) < 80 and not any(w in txt for w in ["בספר", "עמוד", "פרק", "מדברים", "לפי"]):
                curr_q['options'][-1] += " " + txt
                if b and curr_q['correctIndex'] is None:
                    curr_q['correctIndex'] = len(curr_q['options']) - 1
            else:
                curr_q['state'] = 'in_expl'
                curr_q['explanation_lines'].append(txt)

if curr_q:
    parsed_qs.append(curr_q)

print(f"Parsed {len(parsed_qs)} questions around page 83.")
for q in parsed_qs:
    if 'חוזה עבודה קבוצתי' in ' '.join(q['options']):
        print("\n=== QUESTION 90 FOUND ===")
        print("Question:", q['question'])
        print("Options:", q['options'])
        print("Correct Option:", q['options'][q['correctIndex']] if q['correctIndex'] is not None else None)
        print("FULL EXPLANATION:")
        print(" ".join(q['explanation_lines']))
