import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

VALID_CATEGORIES = [
    "תיאוריות למידה ולמידת מבוגרים",
    "מיומנויות פסיכומוטוריות וסימולציה",
    "משוב, הערכה ורפלקציה",
    "תפקיד המדריך ויחסי מדריך-סטודנט",
    "הסטודנט המתקשה ותוכניות התערבות",
    "אתיקה, חוק ובטיחות המטופל"
]

def clean_hebrew(text):
    if not text:
        return ""
    # Clean up punctuation and spacing artifacts common in PDF text extraction
    t = text
    t = re.sub(r'\s+', ' ', t)
    t = t.replace(' ?', '?').replace(' ,', ',').replace(' .', '.')
    t = t.replace('( ', '(').replace(' )', ')')
    t = t.replace('תחכים', 'תחקיר')
    t = t.replace('נ ותנים', 'נותנים')
    t = t.replace('פקידו', 'תפקידו')
    t = t.replace('מא פ?יין', 'מאפיין')
    t = t.replace('פ?נית', 'פנית')
    t = t.replace('ה ה" דרכה', 'ההדרכה')
    t = t.replace('ה ה דרכה', 'ההדרכה')
    t = t.replace('PBL :', 'PBL:')
    t = t.replace('טוקסונומיה', 'טקסונומיה')
    t = t.replace('י פת חת', 'פיתוח')
    t = t.replace('ה תלמיד', 'התלמיד')
    t = t.replace('ו נדרש', 'ונדרש')
    t = t.replace('ה תפקיד', 'התפקיד')
    t = t.replace('ה יחסים', 'היחסים')
    t = t.replace('ה שימוש', 'השימוש')
    t = t.replace('ה שותפות', 'השותפות')
    t = t.replace('ה הצלחה', 'ההצלחה')
    t = t.replace('ה עבודה', 'העבודה')
    t = t.replace('ה אחות', 'האחות')
    t = t.replace('ה אמצעים', 'האמצעים')
    t = t.replace('ה חוויה', 'החוויה')
    t = t.replace('ה חוויות', 'החוויות')
    t = t.replace('ה פעולות', 'הפעולות')
    t = t.replace('ה רפלקציה', 'הרפלקציה')
    t = t.replace('ה גישה', 'הגישה')
    t = t.replace('ה שדה', 'השדה')
    t = t.replace('ה חרדה', 'החרדה')
    t = t.replace('ה מודרך', 'המודרך')
    t = t.replace('ה מדריך', 'המדריך')
    t = t.replace('ה חולים', 'החולים')
    t = t.replace('ה מטופל', 'המטופל')
    t = t.replace('ה חשיבה', 'החשיבה')
    t = t.replace('ה למידה', 'הלמידה')
    t = t.replace('ה נהלים', 'הנהלים')
    t = t.replace('ה סוגיות', 'הסוגיות')
    t = t.replace('ה עקרונות', 'העקרונות')
    t = t.replace('ה תוכנית', 'התוכנית')
    t = t.replace('ה מבחן', 'המבחן')
    t = t.replace('ה ביצוע', 'הביצוע')
    t = t.replace('ה כללים', 'הכללים')
    t = t.replace('ה תובנות', 'התובנות')
    t = t.replace('ה מיומנויות', 'המיומנויות')
    t = t.replace('ה דרישות', 'הדרישות')
    t = t.replace('ה מחלקה', 'המחלקה')
    t = t.replace('ה קבוצה', 'הקבוצה')
    t = t.replace('ה צוות', 'הצוות')
    t = t.replace('bulling', 'bullying')
    return t.strip()

print("Hebrew cleaner ready.")
