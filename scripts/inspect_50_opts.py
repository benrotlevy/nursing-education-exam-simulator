import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

from cross_match_50_highlights import HIGHLIGHTS_MAP, dump_qs

print(f"Total mapped highlights: {len(HIGHLIGHTS_MAP)}")

opt_counts = {1: 0, 2: 0, 3: 0, 4: 0}
for num, hl in sorted(HIGHLIGHTS_MAP.items()):
    dq = next((q for q in dump_qs if q['num'] == num), None)
    if not dq:
        continue
    c = len(dq['options'])
    opt_counts[c] = opt_counts.get(c, 0) + 1
    # Check if highlighted option letter is in options
    letters = [o['letter'] for o in dq['options']]
    print(f"Q{num:02d} ({c} opts, letters: {letters}): Highlight: {hl['letter']}. {hl['text']}")

print("\nOption count distribution across 50 highlighted questions:")
print(opt_counts)
