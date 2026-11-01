#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
enrich_with_gemini.py

Safely enriches all 1,079 questions with:
1. shortExplanation (punchy 1-line takeaway)
2. detailedExplanation (5-15 lines with pedagogical rationale, distractor analysis, and literature grounding)

Zero external dependencies - uses standard library urllib.request.
Reads GEMINI_API_KEY from environment variables only (never saved to disk).

Usage in Windows PowerShell:
  $env:GEMINI_API_KEY = "your-key-here"
  python scripts/enrich_with_gemini.py
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error
from pathlib import Path

API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    print("\n" + "=" * 70)
    print("❌ שגיאה: לא הוגדר משתנה סביבה GEMINI_API_KEY!")
    print("=" * 70)
    print("כדי להריץ את הסקריפט באופן מאובטח שאינו חושף את המפתח שלך,")
    print("פתח את חלון ה-PowerShell שלך והרץ:\n")
    print('  $env:GEMINI_API_KEY = "המפתח_שלך_מ-Google_AI_Studio"')
    print("  python scripts/enrich_with_gemini.py\n")
    print("=" * 70 + "\n")
    sys.exit(1)

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = BASE_DIR / "data" / "clean_questions.json"
JS_FILE = BASE_DIR / "questions.js"

MODEL_NAME = "gemini-3.8-flash"
if "--model" in sys.argv:
    idx = sys.argv.index("--model")
    if idx + 1 < len(sys.argv):
        MODEL_NAME = sys.argv[idx + 1]

BATCH_SIZE = 5
DELAY_BETWEEN_BATCHES_SEC = 2.5

SYSTEM_PROMPT = """אתה מומחה פדגוגי וקליני בכיר להוראה והדרכה קלינית בסיעוד בישראל, הבקיא לעומק בסילבוס הממשלתי לקורס הדרכה קלינית בסיעוד ובספרות המקצוע (Encyclopedia of Nursing Education, ספרי הדרכה קלינית, חוזרי מינהל הסיעוד ומשרד הבריאות).

תפקידך להעשיר שאלות ממבחני גמר/על-בסיסי בהדרכה קלינית בשני סוגי משובים מאירי עיניים עבור כל שאלה:

1. "shortExplanation" (תמצית בשורה אחת):
   - בדיוק משפט אחד או שניים קצרים וממוקדים (שורה אחת).
   - עונה ישירות על השאלה: למה התשובה הנכונה היא הנכונה באופן חד-משמעי.
   - ללא מריחות – התמצית הפדגוגית המדויקת ביותר שהסטודנט צריך לזכור למבחן.

2. "detailedExplanation" (הסבר מעמיק של 5 עד 15 שורות):
   - הסבר עשיר, מנומק, מובנה וברור הכולל:
     * • הרציונל הפדגוגי/קליני: ניתוח עמוק של השאלה והמושג התיאורטי.
     * • ניתוח המסיחים השגויים: הסבר ממוקד מדוע שאר האפשרויות מטעות או שגויות.
     * • עיגון בספרות ובסילבוס: התייחסות ספציפית לתיאורטיקן או לנוהל הרלוונטי (בלום, קולב, נואלס ואנדרגוגיה, סוולר ועומס קוגניטיבי, פיטס ופוסנר, פנדלטון ומשוב, הטיות הערכה, התערבות עם סטודנט מתקשה, בטיחות המטופל וכו').

כללים קריטיים:
- עליך להחזיר תמיד אך ורק אובייקט JSON תקני במבנה המבוקש ללא טקסט מקדים וללא מרקדאון של קוד.
- התשובות חייבות להיות בעברית מקצועית, שוטפת, בהירה ומעודדת למידה."""


def call_gemini(batch_questions, retries=3):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent?key={API_KEY}"
    
    formatted_qs = [
        {
            "id": q["id"],
            "category": q.get("category", ""),
            "question": q["question"],
            "options": q["options"],
            "correctOption": q["options"][q["correctIndex"]],
            "currentExplanation": q.get("aiExplanation") or q.get("explanation") or q.get("originalExplanation") or ""
        }
        for q in batch_questions
    ]

    prompt = (
        f"{SYSTEM_PROMPT}\n\nלהלן {len(batch_questions)} שאלות להעשרה. החזר JSON במבנה הבא בלבד:\n"
        "[\n"
        '  {\n'
        '    "id": "q_XXX",\n'
        '    "shortExplanation": "שורה אחת ממוקדת המסבירה למה התשובה נכונה",\n'
        '    "detailedExplanation": "• הרציונל הפדגוגי/קליני: ...\\n• ניתוח המסיחים השגויים: ...\\n• מקור בספרות / סילבוס: ..."\n'
        '  }\n'
        "]\n\n"
        f"השאלות:\n{json.dumps(formatted_qs, ensure_ascii=False, indent=2)}"
    )

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json"
        }
    }

    req_data = json.dumps(payload).encode("utf-8")
    
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(
                url,
                data=req_data,
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                res_body = resp.read().decode("utf-8")
                res_json = json.loads(res_body)
                raw_text = res_json.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                
                cleaned = raw_text.strip()
                if cleaned.startswith("```json"):
                    cleaned = cleaned[7:]
                if cleaned.startswith("```"):
                    cleaned = cleaned[3:]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
                cleaned = cleaned.strip()

                parsed = json.loads(cleaned)
                if isinstance(parsed, list):
                    return parsed
                if isinstance(parsed, dict) and "results" in parsed and isinstance(parsed["results"], list):
                    return parsed["results"]
                raise ValueError("Payload is not a valid JSON array")

        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait_sec = attempt * 15
                print(f"\n⚠️ Rate limit (429). ממתין {wait_sec} שניות...")
                time.sleep(wait_sec)
                continue
            err_msg = e.read().decode("utf-8", errors="ignore")
            print(f"\n[ניסיון {attempt}/{retries}] HTTP {e.code}: {err_msg}")
            if attempt == retries:
                raise
            time.sleep(4)
        except Exception as e:
            print(f"\n[ניסיון {attempt}/{retries}] שגיאה: {e}")
            if attempt == retries:
                raise
            time.sleep(4)


def save_database(questions):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)

    js_code = (
        "/**\n"
        " * מאגר שאלות מאומת ומסווג למבחן על-בסיסי בהדרכה קלינית בסיעוד\n"
        f" * סך הכל שאלות פעילות ומאומתות: {len(questions)}\n"
        " * נוצר באופן אוטומטי מתוך clean_questions.json\n"
        " */\n\n"
        f"window.EXAM_QUESTIONS = {json.dumps(questions, ensure_ascii=False, indent=2)};\n"
    )
    with open(JS_FILE, "w", encoding="utf-8") as f:
        f.write(js_code)


def main():
    print("\n" + "=" * 65)
    print("🚀 התחלת תהליך העשרת משובים פדגוגיים מבוססי ספרות (Python + Gemini)")
    print(f"🤖 מודל בשימוש: {MODEL_NAME}")
    print("=" * 65 + "\n")

    if not DATA_FILE.exists():
        print(f"קובץ הנתונים לא נמצא: {DATA_FILE}")
        sys.exit(1)

    with open(DATA_FILE, "r", encoding="utf-8") as f:
        all_questions = json.load(f)

    total = len(all_questions)
    pending_indices = [
        i for i, q in enumerate(all_questions)
        if not q.get("shortExplanation") or not q.get("detailedExplanation") or len(q.get("shortExplanation", "")) < 10
    ]

    already_done = total - len(pending_indices)
    print(f"📊 סך הכל שאלות במאגר: {total}")
    print(f"✅ שאלות שכבר הועשרו: {already_done}")
    print(f"⏳ שאלות הממתינות להעשרה: {len(pending_indices)}\n")

    if not pending_indices:
        print("🎉 כל השאלות במאגר כבר מועשרות! אין צורך בפעולה.")
        return

    start_time = time.time()
    processed = 0

    for i in range(0, len(pending_indices), BATCH_SIZE):
        chunk_indices = pending_indices[i:i + BATCH_SIZE]
        chunk_qs = [all_questions[idx] for idx in chunk_indices]
        q_start = chunk_qs[0]["id"]
        q_end = chunk_qs[-1]["id"]
        pct = ((already_done + processed) / total) * 100

        sys.stdout.write(f"[{pct:.1f}%] מעבד אצווה ({q_start} - {q_end}, {len(chunk_qs)} שאלות)... ")
        sys.stdout.flush()

        try:
            results = call_gemini(chunk_qs)
            res_map = {item["id"]: item for item in results if "id" in item}

            match_count = 0
            for idx in chunk_indices:
                q = all_questions[idx]
                if q["id"] in res_map:
                    item = res_map[q["id"]]
                    if item.get("shortExplanation") and item.get("detailedExplanation"):
                        q["shortExplanation"] = item["shortExplanation"].strip()
                        q["detailedExplanation"] = item["detailedExplanation"].strip()
                        q["aiExplanation"] = item["detailedExplanation"].strip()
                        match_count += 1

            processed += len(chunk_qs)
            save_database(all_questions)
            print(f"✅ הושלם בהצלחה ({match_count}/{len(chunk_qs)} עודכנו ונשמרו)")

            elapsed = time.time() - start_time
            rate = processed / elapsed if elapsed > 0 else 0
            rem_sec = round((len(pending_indices) - processed) / rate) if rate > 0 else 0
            mins = rem_sec // 60
            secs = rem_sec % 60
            print(f"   ⏱️ זמן שחלף: {round(elapsed)}s | קצב: {rate * 60:.1f} שאלות/דקה | משוער לסיום: {mins} דקות ו-{secs} שניות")

            if i + BATCH_SIZE < len(pending_indices):
                time.sleep(DELAY_BETWEEN_BATCHES_SEC)

        except Exception as e:
            print(f"\n❌ שגיאה באצווה ({q_start} - {q_end}): {e}")
            print("💾 הנתונים שנצברו עד כה נשמרו בבטחה. ממתין 10 שניות...")
            time.sleep(10)

    print("\n" + "=" * 65)
    print(f"🎉 כל {total} השאלות הועשרו בהצלחה בהסברים פדגוגיים מבוססי ספרות!")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    main()
