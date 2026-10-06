import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

from cross_match_targets import f1_unique, f2_unique

overlap_pairs = []
for i1, q1 in enumerate(f1_unique):
    q1_words = [w for w in re.findall(r'\w+', q1['question']) if len(w) > 3]
    for i2, q2 in enumerate(f2_unique):
        q2_words = set(re.findall(r'\w+', q2['question']))
        if sum(1 for w in q1_words if w in q2_words) >= 4:
            overlap_pairs.append((i1, q1, i2, q2))

print(f"Overlap pairs count: {len(overlap_pairs)}")
for i1, q1, i2, q2 in overlap_pairs:
    print(f"F1_{i1+1} (Q{q1['num']}): {q1['question'][:50]} <---> F2_{i2+1} (Q{q2['num']}): {q2['question'][:50]}")
