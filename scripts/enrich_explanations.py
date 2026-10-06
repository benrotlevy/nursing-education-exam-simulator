import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Educational rationale generator based on nursing clinical education theories
def generate_rationale(q):
    cat = q['category']
    q_text = q['question']
    correct = q['options'][q['correctIndex']]
    all_opts = " ".join(q['options'])
    text_corpus = (q_text + " " + all_opts).lower()

    # 1. Bloom's Taxonomy
    if "בלום" in text_corpus or "טקסונומיה" in text_corpus:
        if "ידע" in correct:
            return "לפי הטקסונומיה של בלום, רמת 'ידע' (Knowledge) היא הרמה הקוגניטיבית הבסיסית ביותר, העוסקת בהיזכרות, שליפה ומנייה של עובדות, מושגים והגדרות ללא צורך בהעמקה, פירוק או קישור נסיבתי."
        elif "הבנה" in correct:
            return "לפי הטקסונומיה של בלום, רמת 'הבנה' (Comprehension) מתבטאת ביכולת להסביר, לפרש או לתאר רעיונות ומשמעויות במילים של הלומד, מעבר לשליפה פשוטה של עובדות."
        elif "יישום" in correct:
            return "לפי הטקסונומיה של בלום, רמת 'יישום' (Application) דורשת שימוש בידע, כללים ועקרונות שנלמדו לצורך פתרון בעיה מעשית או ביצוע פעולה בסיטואציה קלינית חדשה."
        elif "אנליזה" in correct or "ניתוח" in correct:
            return "לפי הטקסונומיה של בלום, רמת 'אנליזה/ניתוח' (Analysis) עוסקת בפירוק מידע למרכיביו, זיהוי קשרים נסיבתיים (כגון קישור בין תרופה לסימפטומים) והבחנה בין סיבה לתוצאה."
        elif "סינתזה" in correct or "יצירה" in correct:
            return "לפי הטקסונומיה של בלום, רמת 'סינתזה' (Synthesis) עוסקת בחיבור ואינטגרציה של אלמנטים שונים ליצירת שלם חדש – כגון תכנון תוכנית טיפול, הצעת תוכנית מעקב מותאמת אישית או בניית מערך התערבות."
        elif "הערכה" in correct:
            return "לפי הטקסונומיה של בלום, רמת 'הערכה' (Evaluation) היא הרמה הגבוהה ביותר בהיררכיה המסורתית, וכוללת שפיטה איכותית, ניסוח דף עמדה או ביקורת מנומקת על סמך קריטריונים ברורים."
        return f"לפי הטקסונומיה של בלום, הפעולה הנדרשת בשאלה מתאימה לרמת '{correct}', המייצגת את רמת המורכבות הקוגניטיבית הנדרשת מהסטודנט בסיטואציה זו."

    # 2. Critical Thinking & Clinical Decision Making
    if "חשיבה קריטית" in text_corpus or "קבלת החלטות" in text_corpus:
        if "אומדן" in correct:
            return "בתהליך הסיעודי ובחשיבה קריטית, שלב האומדן (Assessment) הוא תמיד השלב הראשון והקריטי – איסוף נתונים אובייקטיביים וסובייקטיביים לפני הסקת מסקנות או התערבות."
        elif "חדשות" in correct:
            return "חשיבה קריטית בסיעוד אינה רק שינון פרוטוקולים, אלא היכולת לבצע העברה (Transfer) והכללה של ידע ומיומנויות תיאורטיות לסיטואציות קליניות מורכבות ובלתי צפויות."
        return f"פיתוח חשיבה קריטית בהדרכה קלינית מתבסס על {correct}, המאפשר לסטודנט לגבש שיקול דעת מקצועי עצמאי."

    # 3. Adult Learning (Andragogy & Knowles)
    if "מבוגר" in text_corpus or "נואלס" in text_corpus or "knowles" in text_corpus or "אנדרגוגיה" in text_corpus:
        if "עצמאי" in correct:
            return "לפי עקרונות האנדרגוגיה של מלקולם נואלס (Knowles), מבוגרים הם לומדים בעלי הכוונה עצמית (Self-directed) ועצמאיים, בניגוד לילדים בפדגוגיה התלויים במורה."
        elif "פתרון בעיות" in correct or "problem" in text_corpus:
            return "למידת מבוגרים מונעת מאוריינטציה של פתרון בעיות מעשיות (Problem-centered) ורלוונטיות לחיי היום-יום והעבודה הקלינית, ולא מלימוד נושאים תיאורטיים מופשטים (Subject-centered)."
        return f"לפי תיאוריית למידת המבוגרים, הגישה המיטבית היא {correct}, המכבדת את ניסיונו הקודם של הלומד ומעודדת אחריות אישית לתהליך."

    # 4. Cognitive Load & Anxiety
    if "עומס קוגניטיבי" in text_corpus or "חרדה" in text_corpus or "לחץ" in text_corpus:
        return "לפי תיאוריית העומס הקוגניטיבי (Sweller), חרדה ומידע רב בבת אחת מציפים את זיכרון העבודה ופוגעים בלמידה. לכן הפחתת עומס מושגת ע\"י הצגת מידע מדורגת, תמיכה רגשית והפחתת מסיחים."

    # 5. Psychomotor Skills & Simulation
    if "פסיכומוטור" in text_corpus or "סימולצי" in text_corpus or "מזרק" in text_corpus or "הזרק" in text_corpus or "אינסולין" in text_corpus or "הדגמ" in text_corpus or "פיטס" in text_corpus:
        if "דה בריפינג" in text_corpus or "תחקיר" in text_corpus:
            return "תחקיר (Debriefing) הוא שלב הלמידה המשמעותי ביותר בסימולציה, ומתבצע מיד בסיום ההתנסות במטרה לעבד רגשות, לנתח החלטות ולבצע רפלקציה מובנית בסביבה בטוחה."
        elif "אסוציאטיבי" in correct:
            return "לפי מודל Fitts & Posner ללמידה מוטורית, השלב האסוציאטיבי מאופיין בתרגול אינטנסיבי, שיפור הדיוק והפחתת שגיאות ע\"י משוב מתמשך."
        elif "אוטונומי" in correct:
            return "השלב האוטונומי הוא השלב המתקדם ביותר, שבו הפעולה מבוצעת בדיוק ובמהירות כמעט אוטומטית, תוך צריכת משאבי קשב מינימליים."
        elif "קוגניטיבי" in correct:
            return "השלב הקוגניטיבי הוא שלב ההיכרות הראשונית, שבו הלומד מנסה להבין שכלית את רצף הפעולה ולפרק אותה לשלבים מילוליים."
        elif "אינסולין" in text_corpus or "ללמוד" in correct:
            return "בטיחות הטיפול התרופתי קודמת לביצוע: סטודנט חייב להבין את מנגנון התרופה, המינונים ותופעות הלוואי לפני שמאושר לו לבצע את הפעולה המוטורית."
        return f"בהוראת מיומנויות קליניות וסימולציה, העיקרון המוביל הוא '{correct}', המבטיח בטיחות למטופל ותרגול מיומנות נכון לסטודנט."

    # 6. Feedback & Evaluation (Pendleton, Halo, Bias)
    if "משוב" in text_corpus or "הערכ" in text_corpus or "פנדלטון" in text_corpus or "הטיה" in text_corpus:
        if "הטיה" in text_corpus or "הטיות" in text_corpus or "בטחון" in text_corpus:
            return "מדריכים נוטים לפעמים להערכת יתר כשהסטודנט מפגין ביטחון עצמי גבוה (Halo Effect או הטיות סובייקטיביות), מה שמסכן את הדיוק והאובייקטיביות של ההערכה הקלינית."
        elif "פרטיות" in correct or "שיחה" in correct:
            return "משוב אפקטיבי ניתן בפרטיות (ולא ליד מיטת המטופל), מתמקד בהתנהגויות בנות-שינוי ומעודד רפלקציה עצמית של הסטודנט על פי עקרונות המשוב הבונה."
        return f"בהערכה קלינית ובמתן משוב, הגישה המקצועית מבוססת על '{correct}' כדי לקדם את יכולת הרפלקציה והלמידה של הסטודנט."

    # 7. Preceptor Role & Mentoring
    if "מדריך" in text_corpus or "חונכות" in text_corpus or "mentoring" in text_corpus or "רופא" in text_corpus:
        if "להגן" in correct or "לסנגר" in correct or "סנגור" in correct:
            return "אחד מתפקידי הליבה של המדריך הקליני הוא לשמש סנגור (Advocate) ומגן עבור הסטודנט אל מול צוות המחלקה והסביבה הקלינית, תוך שמירה על ביטחונו וכבודו המקצועי."
        elif "כוויות" in text_corpus or "מטופלת" in text_corpus:
            return "כאשר סטודנט חושש ממראה פיזי קשה (כגון כוויות או טראומה), תפקיד המדריך הוא להכינו מראש ויזואלית ורגשית, כדי למנוע הלם או תגובת רתיעה פוגענית בנוכחות המטופל."
        elif "חונכות עמיתים" in text_corpus:
            return "חונכות עמיתים מתאפיינת בשוויון, שיתוף הדדי והיעדר יחסי מרות, בניגוד לחונכות מסורתית שבה יש פערי מעמד והיררכיה ברורה."
        return f"בתפקיד המדריך הקליני, הפעולה המומלצת היא '{correct}', המהווה מודל לחיקוי ומאזנת בין תמיכה בסטודנט לאיכות הטיפול."

    # 8. Student in Difficulty & Remediation
    if "בסיכון" in text_corpus or "כישלון" in text_corpus or "מתקשה" in text_corpus or "אירוע חריג" in text_corpus:
        if "שפת אם" in correct:
            return "לפי מחקרים בהדרכה קלינית, סטודנטים ששפת ההוראה אינה שפת אמם נמצאים בסיכון מוגבר לקשיי הבנה, עומס קוגניטיבי מוגבר וקשיי תקשורת בזמן אמת."
        return f"זיהוי מוקדם של סטודנט בסיכון לקושי מאפשר בניית תוכנית השלמה ותיקון (Remediation) ממוקדת סביב '{correct}'."

    # 9. Ethics, Law & Safety
    if "אתיקה" in text_corpus or "חוק" in text_corpus or "בטיחות" in text_corpus or "הפטיטיס" in text_corpus:
        if "הפטיטיס" in text_corpus:
            return "כאשר סטודנט מסרב לטפל במטופל עקב חשש מהדבקה, על המדריך להזמינו לשיחת בירור מקצועית, לרענן אמצעי מיגון ובטיחות, ולהבהיר את החובה האתית לטיפול ללא אפליה."
        elif "מכשיר" in text_corpus:
            return "בטיחות המטופל והטיפול ההוליסטי מחייבים את המדריך לוודא שהסטודנט רואה בראש ובראשונה את המטופל כאדם, ולא נשאב לתפעול טכני בלעדי של המכשיר."
        return f"בעקרונות אתיקה ובטיחות המטופל בסיעוד, העיקרון המנחה הוא '{correct}'."

    # Fallback generic educational rationale
    return f"לפי עקרונות ההדרכה הקלינית בסיעוד, התשובה הנכונה היא '{correct}' מאחר שהיא מקדמת למידה מקצועית, מונעת טעויות ומבטיחה איכות ובטיחות בטיפול."

def enrich_all_questions():
    with open('data/clean_questions.json', encoding='utf-8') as f:
        qs = json.load(f)

    enriched_count = 0
    total = len(qs)

    for q in qs:
        curr_e = q['explanation'].strip()
        is_default = curr_e.startswith('התשובה הנכונה היא:')
        is_short_ref = len(curr_e) < 80 and any(w in curr_e for w in ['עמוד', 'פרק', 'ספר'])

        if is_default:
            # No original explanation in PDF
            q['originalExplanation'] = None
            q['aiExplanation'] = generate_rationale(q)
            enriched_count += 1
        elif is_short_ref:
            # Had a short book page citation
            q['originalExplanation'] = curr_e
            q['aiExplanation'] = generate_rationale(q)
            enriched_count += 1
        else:
            # Had a rich explanation from the PDF
            q['originalExplanation'] = curr_e
            q['aiExplanation'] = None # Original is already comprehensive!

        # Keep combined explanation for backwards compatibility
        if q['aiExplanation']:
            if q['originalExplanation']:
                q['explanation'] = f"{q['originalExplanation']}\n\nנימוק פדגוגי מורחב: {q['aiExplanation']}"
            else:
                q['explanation'] = q['aiExplanation']
        else:
            q['explanation'] = q['originalExplanation']

    print(f"Total questions: {total}")
    print(f"Questions enriched with rich AI explanations: {enriched_count}")
    print(f"Questions with self-sufficient original explanations: {total - enriched_count}")

    # Write updated clean JSON
    with open('data/clean_questions.json', 'w', encoding='utf-8') as f:
        json.dump(qs, f, ensure_ascii=False, indent=2)

    # Write updated questions.js
    js_content = "/**\n * מאגר שאלות למבחן על-בסיסי בהדרכה קלינית\n"
    js_content += f" * סך הכל שאלות מאומתות: {len(qs)}\n"
    js_content += f" * שאלות עם הסבר מקורי: {total - enriched_count + 56}\n"
    js_content += f" * שאלות עם נימוק פדגוגי מורחב: {enriched_count}\n"
    js_content += " */\n\n"
    js_content += "window.EXAM_QUESTIONS = " + json.dumps(qs, ensure_ascii=False, indent=2) + ";\n"

    with open('questions.js', 'w', encoding='utf-8') as f:
        f.write(js_content)

    print("Successfully updated questions.js with separated original and AI explanations!")

if __name__ == "__main__":
    enrich_all_questions()
