import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

from cross_match_targets import f1_unique, f2_unique

print("--- F1 Unique without highlights ---")
for q in f1_unique:
    if q['highlighted_index'] is None:
        opts = " | ".join(f"{o['letter']}. {o['text']}" for o in q['options'])
        print(f"Q{q['num']}: {q['question']} [{opts}]")

print("\n--- F2 Unique without highlights ---")
for q in f2_unique:
    if q['highlighted_index'] is None:
        opts = " | ".join(f"{o['letter']}. {o['text']}" for o in q['options'])
        print(f"Q{q['num']}: {q['question']} [{opts}]")
