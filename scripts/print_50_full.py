import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

from cross_match_50_highlights import HIGHLIGHTS_MAP, dump_qs

print(f"Total mapped highlights: {len(HIGHLIGHTS_MAP)}")

for num, hl in sorted(HIGHLIGHTS_MAP.items()):
    dq = next((q for q in dump_qs if q['num'] == num), None)
    opts = " | ".join(f"{o['letter']}. {o['text']}" for o in dq['options']) if dq else ""
    print(f"\n--- Q{num:02d} ---")
    print(f"Prompt: {dq['question']}")
    print(f"Dump Options: {opts}")
    print(f"HIGHLIGHTED ANSWER: {hl['letter']}. {hl['text']}")
