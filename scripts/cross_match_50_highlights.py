import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/clean_questions.json', encoding='utf-8') as f:
    db = json.load(f)

# Load dump questions
with open('data/exam_2024_dump.txt', encoding='utf-8') as f:
    text = f.read()

lines = text.splitlines()
dump_qs = []
curr_q = None

for l in lines:
    ls = l.strip()
    m = re.match(r'^(\d+)\s*[\.\)]\s*(.*)', ls)
    if m:
        if curr_q:
            dump_qs.append(curr_q)
        curr_q = {
            'num': int(m.group(1)),
            'question': m.group(2).strip(),
            'options': []
        }
    elif curr_q:
        m_opt = re.match(r'^([א-דa-d])[\.\)]\s*(.*)', ls)
        if m_opt:
            curr_q['options'].append({
                'letter': m_opt.group(1),
                'text': m_opt.group(2).strip()
            })
        elif len(curr_q['options']) == 0:
            if not ls.isdigit() and 'שחזור מבחן' not in ls:
                curr_q['question'] += ' ' + ls
        elif len(curr_q['options']) > 0:
            if not ls.isdigit() and 'שחזור מבחן' not in ls:
                curr_q['options'][-1]['text'] += ' ' + ls

if curr_q:
    dump_qs.append(curr_q)

# Mapping of the 50 highlights by question number in dump
# Let's verify our mapping from dump.txt and PDF
HIGHLIGHTS_MAP = {
    1: {"letter": "ג", "text": "לבצע הערכה"},
    2: {"letter": "ד", "text": "Case study"},
    3: {"letter": "ב", "text": "ירידה בביטחון העצמי"},
    4: {"letter": "ד", "text": "beginner-Advanced"},
    5: {"letter": "א", "text": "התקדמות"},
    6: {"letter": "ד", "text": "עובדת ולומדת"},
    7: {"letter": "ג", "text": "לעצור את הדיון הקליני ולשאול מה קרה"},
    8: {"letter": "ג", "text": "השאלה של המדריכה גרמה לי לפתח רגישות"},
    9: {"letter": "א", "text": "שיכרות"},
    10: {"letter": "ג", "text": "להוציא את הסטודנטים להפסקה בזמן"},
    11: {"letter": "א", "text": "עקה מוסרית"}, # in dump, option א was implicit or on first line
    12: {"letter": "א", "text": "לשוחח עימה ולהפנות אותה למקורות מוסמכים"},
    13: {"letter": "ב", "text": "Transformational leadership"},
    14: {"letter": "ד", "text": "להתאים לו תכנית"},
    15: {"letter": "א", "text": "לדבר איתו ולראות מה יכול להתאים"},
    16: {"letter": "ב", "text": "תמיכה רגשית"},
    17: {"letter": "ב", "text": "פסיכומוטורי"},
    18: {"letter": "ב", "text": "שהסטודנטים ידבר בגלוי לב על החששות שלו"},
    19: {"letter": "א", "text": "תוכל לשתף בתחושות שהיו לך בטיפול במטופל"},
    20: {"letter": "ב", "text": "מהנה ואטרקטיבית"},
    21: {"letter": "א", "text": "מוטיבציה פנימית"},
    22: {"letter": "ג", "text": "ממוקד במשימה"},
    23: {"letter": "א", "text": "טעות בזיהוי מטופל"},
    24: {"letter": "ב", "text": "להפסיק אותה שזו התנהגות לא מקובלת"},
    25: {"letter": "ב", "text": "Dehumanized"},
    26: {"letter": "ד", "text": "לדבר איתו לפני הטיפול וכך תוכל לראות אותו כבן אדם"},
    28: {"letter": "א", "text": "סימולציה"},
    29: {"letter": "א", "text": "בטיחות"},
    30: {"letter": "ג", "text": "שותפות"},
    32: {"letter": "ב", "text": "כולנו טועים, אך צריך לדווח"},
    33: {"letter": "ב", "text": "לתת דוגמה בהקשר לכל הישג בהערכה"},
    34: {"letter": "ג", "text": "תמיכה ואווירה חיובית"},
    35: {"letter": "ד", "text": "התמקדות בציון ולא בלמידה"},
    36: {"letter": "א", "text": "בתחילת ההתנסות"},
    40: {"letter": "ג", "text": "רפלקציה"},
    41: {"letter": "א", "text": "מניעת נזק למטופל"},
    42: {"letter": "ג", "text": "להגיד לו שאני זמין לכל שאלה"},
    43: {"letter": "א", "text": "מושך את היד למטופל בהכרה כדי לבצע זיהוי מטופל"},
    44: {"letter": "ב", "text": "סטודנט מכניס סימנים חיוניים למטופל, שלא מדד סימנים"},
    47: {"letter": "א", "text": "חרדה"},
    49: {"letter": "א", "text": "כשירות תרבותית"},
    50: {"letter": "ב", "text": "הדגמה"},
    51: {"letter": "א", "text": "אשמה"},
    54: {"letter": "ב", "text": "לשאול אותו מה גרם לו להרגיש כך"},
    56: {"letter": "א", "text": "evidence based learning"},
    58: {"letter": "ג", "text": "מבחן עיוני"},
    60: {"letter": "ג", "text": "אמון וכבוד"},
    61: {"letter": "א", "text": "יישום ידע תיאורטי בפרקטיה בשטח"},
    62: {"letter": "א", "text": "מסדר ויזואלי קשרים בין תוכן"},
    70: {"letter": "ב", "text": "ביצוע פעולה באופן אוטומטי"}
}

print(f"Total highlights mapped: {len(HIGHLIGHTS_MAP)}")

# Check overlap of each highlighted question with existing clean_questions.json
found_in_db = []
missing_from_db = []

for q_num, hl in HIGHLIGHTS_MAP.items():
    dq = next((q for q in dump_qs if q['num'] == q_num), None)
    if not dq:
        continue
    
    q_words = [w for w in re.findall(r'\w+', dq['question']) if len(w) > 3]
    best_match = None
    best_overlap = 0
    
    for eq in db:
        eq_words = set(re.findall(r'\w+', eq['question']))
        common = sum(1 for w in q_words if w in eq_words)
        if common > best_overlap:
            best_overlap = common
            best_match = eq
            
    if best_overlap >= 3:
        found_in_db.append({
            "num": q_num,
            "highlight": hl,
            "dump_q": dq,
            "db_q": best_match,
            "overlap": best_overlap
        })
    else:
        missing_from_db.append({
            "num": q_num,
            "highlight": hl,
            "dump_q": dq
        })

print(f"Already in DB: {len(found_in_db)}")
print(f"Missing from DB: {len(missing_from_db)}")

print("\n--- Missing from DB list: ---")
for m in missing_from_db:
    opts = " | ".join(f"{o['letter']}. {o['text']}" for o in m['dump_q']['options'])
    print(f"Q{m['num']:02d}: {m['dump_q']['question'][:50]}... -> Highlight: {m['highlight']['letter']}. {m['highlight']['text']} [{opts}]")
