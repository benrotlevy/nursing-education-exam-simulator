import re
import json
import sys

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

def refine_category(q_text, options, explanation):
    combined = f"{q_text} {' '.join(options)} {explanation}".lower()
    scores = {}
    for cat_name, kw_list in CATEGORIES:
        score = sum(1 for kw in kw_list if kw.lower() in combined)
        if score > 0:
            scores[cat_name] = score
    if scores:
        # return highest scored category
        return max(scores.items(), key=lambda x: x[1])[0]
    return "תפקיד המדריך ויחסי מדריך-סטודנט"

def clean_text(t):
    if not t:
        return ""
    # remove leading numbers or letters like א. ב. 1.
    t = re.sub(r'^[א-דa-d0-9]+[\.\)\-]\s*', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def build_database():
    with open('data/all_pdf_questions.json', encoding='utf-8') as f:
        raw_qs = json.load(f)
        
    clean_qs = []
    seen = set()
    
    for item in raw_qs:
        q_raw = item['question']
        options_raw = item['options']
        corr_idx = item['correctIndex']
        expl = item.get('explanation', '').strip()
        source = item.get('source', 'מבחן ממשלתי משוחזר')
        
        # Only take questions with 3 or 4 options
        if len(options_raw) not in [3, 4]:
            continue
            
        if corr_idx is None or corr_idx < 0 or corr_idx >= len(options_raw):
            continue
            
        clean_q = clean_text(q_raw)
        if len(clean_q) < 10:
            continue
            
        # Deduplication key
        norm_key = re.sub(r'[^\w]', '', clean_q)[:50]
        if norm_key in seen:
            continue
        seen.add(norm_key)
        
        cleaned_options = [clean_text(opt) for opt in options_raw]
        # Check that options are not empty and not duplicates
        if any(len(opt) == 0 for opt in cleaned_options):
            continue
        if len(set(cleaned_options)) != len(cleaned_options):
            continue
            
        category = refine_category(clean_q, cleaned_options, expl)
        
        if not expl:
            expl = f"התשובה הנכונה היא: '{cleaned_options[corr_idx]}'."
        else:
            expl = clean_text(expl)
            
        clean_qs.append({
            'id': f"q_{len(clean_qs)+1:03d}",
            'source': source,
            'category': category,
            'question': clean_q,
            'options': cleaned_options,
            'correctIndex': corr_idx,
            'explanation': expl,
            'verified': True
        })
        
    print(f"Total curated clean questions: {len(clean_qs)}")
    
    # Category summary
    cat_dist = {}
    for q in clean_qs:
        cat_dist[q['category']] = cat_dist.get(q['category'], 0) + 1
        
    print("\nCategory distribution:")
    for k, v in sorted(cat_dist.items(), key=lambda x: x[1], reverse=True):
        print(f"  - {k}: {v} ({v*100//len(clean_qs)}%)")
        
    # Write to questions.js
    js_content = "/**\n * מאגר שאלות למבחן על-בסיסי בהדרכה קלינית\n"
    js_content += f" * סך הכל שאלות מאומתות: {len(clean_qs)}\n"
    js_content += " */\n\n"
    js_content += "window.EXAM_QUESTIONS = " + json.dumps(clean_qs, ensure_ascii=False, indent=2) + ";\n"
    
    with open('questions.js', 'w', encoding='utf-8') as f:
        f.write(js_content)
    print("Successfully wrote questions.js!")
    
    with open('data/clean_questions.json', 'w', encoding='utf-8') as f:
        json.dump(clean_qs, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    build_database()
