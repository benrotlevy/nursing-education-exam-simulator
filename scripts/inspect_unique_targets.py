import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

from cross_match_targets import f1_unique, f2_unique

print(f"=== F1 (תרגילים להכנה למבחן ממשלתי) UNIQUE: {len(f1_unique)} ===")
for i, q in enumerate(f1_unique):
    hl = f"Opt {q['options'][q['highlighted_index']]['letter']}: {q['highlighted_text']}" if q['highlighted_index'] is not None else "NO HL"
    print(f"F1_{i+1:02d} (Q{q['num']:02d}): {q['question'][:60]}... | {hl}")

print(f"\n=== F2 (מבחן לתרגול) UNIQUE: {len(f2_unique)} ===")
for i, q in enumerate(f2_unique):
    hl = f"Opt {q['options'][q['highlighted_index']]['letter']}: {q['highlighted_text']}" if q['highlighted_index'] is not None else "NO HL"
    print(f"F2_{i+1:02d} (Q{q['num']:02d}): {q['question'][:60]}... | {hl}")
