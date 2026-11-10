# 07 — Data Schema & Question Bank Standard

## 1. Canonical Source vs. Deployed Artifact

| File | Role | Tracked in Git | Deployed to Pages |
|---|---|---|---|
| `data-pipeline/source/clean_questions.json` | Canonical master dataset containing full historical metadata (`originalExplanation`, etc.). | Yes | **No** |
| `app/data/questions.json` | Slimmed, schema-validated runtime dataset compiled by `tools/build-questions.js`. | Yes | **Yes** |

### Why We Slim `app/data/questions.json`
In v1, `questions.js` was 4.41 MB because every question carried both `aiExplanation` (784 KB total) and `detailedExplanation` (784 KB total) with 100% identical content, plus unused legacy fields (`explanation`).
In v2, `tools/build-questions.js` strips redundant duplicate fields and emits pure JSON (`app/data/questions.json`), cutting payload size by ~1 MB while retaining 100% of user-facing information.

---

## 2. Runtime JSON Schema (`app/data/questions.json`)

The compiled file is a JSON object with a versioned header and `questions` array:

```json
{
  "schemaVersion": 2,
  "totalQuestions": 1079,
  "questions": [
    {
      "id": "q_001",
      "source": "שחזור מבחן ממשלתי 4.6.18",
      "category": "תפקיד המדריך ויחסי מדריך-סטודנט",
      "question": "במהלך ההתנסות הסטודנט חוזר שוב על אותה שאלה...",
      "options": [
        "לענות שוב עם ניסוח חדש של התשובה כי זה חלק מתהליך הלמידה",
        "לנזוף בסטודנט כי אינו קשוב ושיעשה מאמץ להבין מהי התשובה הנכונה",
        "להתעלם משאלתו של הסטודנט כדי שיבין שהדבר אינו מקובל",
        "להסביר לסטודנט כי כבר נענה על כך ושישלים את החומר מספר"
      ],
      "correctIndex": 0,
      "verified": true,
      "shortExplanation": "חזרה על שאלה מעידה לרוב על אי-הבנה של ההסבר הקודם...",
      "detailedExplanation": "• הרציונל הפדגוגי/קליני: ...\n• ניתוח המסיחים השגויים:\n- ..."
    }
  ]
}
```

---

## 3. Field Invariants (Enforced by `tests/data/questions.schema.test.js`)

1. **`id`**: Unique string matching `/^q_\d{3,4}$/`. Zero duplicates across the bank.
2. **`source`**: Non-empty trimmed Hebrew string identifying the exam origin.
3. **`category`**: Must belong to the exact 6 official Ministry of Health syllabus categories:
   - `"תיאוריות למידה ולמידת מבוגרים"`
   - `"מיומנויות פסיכומוטוריות וסימולציה"`
   - `"משוב, הערכה ורפלקציה"`
   - `"תפקיד המדריך ויחסי מדריך-סטודנט"`
   - `"הסטודנט המתקשה ותוכניות התערבות"`
   - `"אתיקה, חוק ובטיחות המטופל"`
4. **`question`**: Non-empty string (`>= 10` characters), free of leading numbering artifacts.
5. **`options`**: Array of `3` or `4` non-empty, distinct strings.
6. **`correctIndex`**: Integer satisfying `0 <= correctIndex < options.length`.
7. **`verified`**: Boolean (`true` for official answer key / highlight verified; `false` for pedagogical reconstruction).
8. **`shortExplanation`**: Non-empty 1-2 sentence summary shown in the primary "בשורה אחת" callout.
9. **`detailedExplanation`**: Structured bulleted string containing `• הרציונל הפדגוגי/קליני:` and `• ניתוח המסיחים השגויים:`. (Note: any trailing `• מקור בספרות:` line in the source is stripped at build time and by `explanation-parser.js` so it never leaks to the UI).
