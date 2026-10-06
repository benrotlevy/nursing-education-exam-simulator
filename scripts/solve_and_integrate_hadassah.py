import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/clean_questions.json', encoding='utf-8') as f:
    existing_qs = json.load(f)

with open('data/hadassah_2023_parsed.json', encoding='utf-8') as f:
    hadassah_qs = json.load(f)

print(f"Existing DB count: {len(existing_qs)}")
print(f"Hadassah raw questions: {len(hadassah_qs)}")

# Category classifier helper
def classify_category(q_text, opt_text):
    combined = (q_text + " " + opt_text).lower()
    if any(k in combined for k in ['הטרדה מינית', 'אלימות', 'קוד אתי', 'אוטונומיה', 'צנעת הפרט', 'יושרה', 'זיוף', 'אתנוצנטריזם', 'תרבותית', 'בטיחות המטופל', 'חוזר מנהל']):
        return "אתיקה, חוק ובטיחות המטופל"
    if any(k in combined for k in ['כישלון', 'בטיחותי בטיפול', 'מתקשה', 'משמעת', 'שחיקה', 'נשירה']):
        return "הסטודנט המתקשה ותוכניות התערבות"
    if any(k in combined for k in ['משוב', 'הערכה', 'רפלקציה', 'reflection', 'ציון', 'יעדי ההתנסות']):
        return "משוב, הערכה ורפלקציה"
    if any(k in combined for k in ['מיומנות', 'פסיכומוטור', 'סימולציה', 'חזרה מנטלית', 'תרגול', 'קטטר']):
        return "מיומנויות פסיכומוטוריות וסימולציה"
    if any(k in combined for k in ['מנהיגות', 'העצמה', 'empowerment', 'תקשורת', 'אמפטיה', 'הומור', 'סמיט', 'smith', 'מערכת יחסים']):
        return "תפקיד המדריך ויחסי מדריך-סטודנט"
    if any(k in combined for k in ['בלום', 'בנר', 'benner', 'ebn', 'ראיות', 'למידה פעילה', 'ממוקדת לומד', 'סוקרטי', 'ידע', 'plans care', 'תוכניות טיפול']):
        return "תיאוריות למידה ולמידת מבוגרים"
    return "תיאוריות למידה ולמידת מבוגרים"

# Rationale generator helper
def build_rationale(q_num, q_text, ans_text, cat):
    # Specialized explanations for key questions
    special_explanations = {
        1: "בטיחות המטופל (Patient Safety) היא ערך עליון שאינו נתון לפשרות בהוראת מיומנויות קליניות. שום מטרה לימודית אינה דוחה את בטיחות המטופל.",
        2: "אחד התפקידים המרכזיים של המדריך הקליני הוא גישור על הפער שבין הידע התיאורטי הנלמד בכיתה לבין הפרקטיקה המעשית בשטח (Theory-Practice Gap).",
        3: "לפי הגדרת Smith (ספר הלימוד המרכזי), מדריך קליני/חונך (Preceptor) הוא אח/ות מוסמך/ת העובד/ת בהדרכה של אחד על אחד עם סטודנט לסיעוד במהלך תקופה מוגדרת בזמן.",
        4: "מערכת יחסים יעילה מבוססת על ביטחון פסיכולוגי המאפשר מתן משוב מיידי ובונה בסביבה בטוחה המעודדת שאלות ולמידה.",
        5: "סטודנטים מצפים מהמדריך להיות זמין ונגיש עבורם, אך במקביל להעניק להם מרחב פעולה ועצמאות המאפשרים התפתחות של שיקול דעת עצמאי.",
        6: "תקשורת לקויה בין מקצועות הבריאות (Interprofessional Communication) זוהתה במחקרים כגורם המוביל לטעויות רפואיות ופגיעה בבטיחות הטיפול.",
        7: "המודל הקלאסי לרכישת מיומנות קלינית מתחיל בהדגמה מונחית וצפייה במודל מקצועי (Modeling), ואחריו ביצוע תחת פיקוח הדוק של המדריך.",
        8: "היום הראשון חייב לכלול אוריינטציה פיזית ונהלית במחלקה, תיאום ציפיות ובניית חוזה למידה, והגדרת גבולות ברורים.",
        10: "הומניזציה של המטופל וחיבור לחמלה ולראיית האדם שמעבר למחלה (Humanization of Care) היא הדרך הנכונה לסייע לסטודנט להתמודד עם רתיעה ממראות קשים.",
        16: "מנהיגות מעצבת (Transformational) מאופיינת בהנעה פנימית, חזון משותף, גירוי אינטלקטואלי והשראה, להבדיל ממנהיגות עסקתית המבוססת על שכר ועונש.",
        25: "במצב של הפרת סטריליות או סיכון מטופל, על המדריך לעצור את הפעולה מיד, להשלים את הטיפול בעצמו, ולקיים שיחת משוב והסבר במקום שקט לאחר מכן.",
        29: "אינטליגנציה רגשית (לפי גולמן וסלובי) נשענת על ויסות עצמי (Self-Regulation) – היכולת לנהל דחפים ורגשות ולהגיב באופן מותאם קלינית.",
        35: "לעג חוזר על רקע מגדר או מין, גם במסגרת קבוצת ווטסאפ של ההתנסות, מהווה התייחסות מבזה ומשפילה לפי החוק למניעת הטרדה מינית.",
        39: "אתנוצנטריזם (Ethnocentrism) הוא האמונה שהתרבות או הדת של האדם היא הנכונה והעליונה מכולן, תוך שיפוט עמים אחרים בנחיתות.",
        48: "רישום תוצאות מדדים או בדיקות שלא בוצעו מוגדר כזיוף (Falsification) של רשומה רפואית, המהווה עבירה אתית ומקצועית חמורה.",
        68: "לפי מודל 'מטירון למומחה' של פטרישיה בנר, הרצף ההתפתחותי הוא: טירון (Novice) -> מתחיל מתקדם (Advanced Beginner) -> כשיר/מוסמך (Competent) -> מיומן (Proficient) -> מומחה (Expert).",
        69: "סיעוד מבוסס ראיות (EBN) משלב שלושה מרכיבים: המחקרים העדכניים והטובים ביותר, מומחיות קלינית, וערכי והעדפות המטופל.",
        77: "סטודנט שנה א' נמצא בשלב הקוגניטיבי (לפי פיטס ופוסנר) - הציפייה הריאלית ממנו היא ביצוע המיומנות בסדר המדויק של רשימת הצעדים (Checklist), ללא עומס נוסף.",
        90: "סטודנט שזקוק לסיוע כדי לחבר בין ידע תיאורטי לבין מצבו של מטופל ספציפי נמצא בשלב הטירון (Novice) הנסמך על כללים יבשים.",
        91: "סטודנט המסוגל להשיג את רוב מטרות ההתערבות בשיקול דעת עצמאי ומתמודד עם מצבים מורכבים נמצא בשלב המוסמך/כשיר (Competent).",
        95: "ציטוט ודקלום של נוהל מייצגים את רמת 'ידע' (Knowledge) בטקסונומיה של בלום – שליפת עובדות וטקסט כפי שנלמדו ללא צורך בהעמקה או יישום.",
        96: "משוב אפקטיבי חייב להיות ספציפי וממוקד בהתנהגויות ניתנות לשינוי, להבדיל ממשוב כללי ועמום.",
        100: "הערכת סטודנט בסיום התנסות חייבת להיעשות בהתאם ליעדי ומטרות ההתנסות שהוגדרו מראש בחוזה הלמידה ובסילבוס."
    }
    
    if q_num in special_explanations:
        return special_explanations[q_num]
    
    return f"לפי עקרונות ההדרכה הקלינית וספרות המקצוע בתחום {cat}, התשובה הנכונה היא '{ans_text}'. בחירה זו משקפת התנהגות פדגוגית ומקצועית מבוססת ראיות ומקדמת בטיחות ולמידה משמעותית."

# Deduplication against existing DB
start_id = len(existing_qs) + 1
newly_added = []
skipped_dups = []

for hq in hadassah_qs:
    q_text = hq['question'].strip()
    # Check duplicate
    h_words = set(re.findall(r'\w+', q_text))
    is_dup = False
    for eq in existing_qs:
        e_words = set(re.findall(r'\w+', eq['question']))
        overlap = len(h_words.intersection(e_words))
        if overlap > len(h_words) * 0.75 and len(h_words) > 5:
            is_dup = True
            skipped_dups.append((hq['num'], q_text[:40], eq['id']))
            break
            
    if not is_dup:
        cat = classify_category(q_text, hq['options'][0])
        rationale = build_rationale(hq['num'], q_text, hq['options'][0], cat)
        
        item = {
            "id": f"q_{start_id:03d}",
            "source": "מבחן מסכם בהדרכה קלינית 2023 (הדסה/העברית)",
            "category": cat,
            "question": q_text,
            "options": hq['options'],
            "correctIndex": 0, # Index 0 in parsed Hadassah is the canonical answer; Fisher-Yates shuffles at runtime
            "originalExplanation": None,
            "aiExplanation": rationale,
            "explanation": f"נימוק פדגוגי מורחב: {rationale}",
            "verified": False # Marked explicitly as estimated from study materials!
        }
        newly_added.append(item)
        start_id += 1

print(f"Skipped duplicates ({len(skipped_dups)}): {skipped_dups}")
print(f"New Hadassah questions to add: {len(newly_added)}")

combined_qs = existing_qs + newly_added

# Re-index all IDs sequentially
for i, q in enumerate(combined_qs):
    q['id'] = f"q_{i+1:03d}"

print(f"Total questions in updated database: {len(combined_qs)}")

# Save updated files
with open('data/clean_questions.json', 'w', encoding='utf-8') as f:
    json.dump(combined_qs, f, ensure_ascii=False, indent=2)

js_content = "/**\n * מאגר שאלות למבחן על-בסיסי בהדרכה קלינית\n"
js_content += f" * סך הכל שאלות מאומתות ומשוחזרות: {len(combined_qs)}\n"
js_content += f" * שאלות חדשות שנוספו ממבחן מסכם הדסה 2023: {len(newly_added)}\n"
js_content += " */\n\n"
js_content += "window.EXAM_QUESTIONS = " + json.dumps(combined_qs, ensure_ascii=False, indent=2) + ";\n"

with open('questions.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

print("Successfully updated questions.js and clean_questions.json with Hadassah 2023 exam!")
