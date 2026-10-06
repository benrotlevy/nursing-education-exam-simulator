import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/targets_for_enrichment.json', encoding='utf-8') as f:
    targets = json.load(f)

bloom_qs = [t for t in targets if 'בלום' in t['question'] or 'תיאוריות' in t['category']]
print(f"Total learning theory targets: {len(bloom_qs)}")
for q in bloom_qs[:10]:
    print(f"\n[{q['id']}] Q: {q['question']}")
    print(f"   Correct: {q['correct']}")
    print(f"   Options: {q['options']}")
