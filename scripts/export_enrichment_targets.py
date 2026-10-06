import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/clean_questions.json', encoding='utf-8') as f:
    qs = json.load(f)

targets = []
for q in qs:
    e = q['explanation'].strip()
    is_default = e.startswith('התשובה הנכונה היא:')
    is_short = len(e) < 80 and any(w in e for w in ['עמוד', 'פרק', 'ספר'])
    if is_default or is_short:
        targets.append({
            'id': q['id'],
            'source': q['source'],
            'category': q['category'],
            'question': q['question'],
            'options': q['options'],
            'correct': q['options'][q['correctIndex']],
            'current_expl': q['explanation'],
            'type': 'no_expl' if is_default else 'short_ref'
        })

print(f"Total target questions needing rich AI explanations: {len(targets)}")
with open('data/targets_for_enrichment.json', 'w', encoding='utf-8') as f:
    json.dump(targets, f, ensure_ascii=False, indent=2)

print("First 8 targets preview:")
for t in targets[:8]:
    print(f"\n[{t['id']}] ({t['category']}) Q: {t['question']}")
    print(f"   Correct: {t['correct']}")
    print(f"   Current: {t['current_expl']}")
