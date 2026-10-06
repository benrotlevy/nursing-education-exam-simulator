import re
import json
import sys

# Test capping and filtering logic
with open('data/clean_questions.json', encoding='utf-8') as f:
    qs = json.load(f)

for q in qs:
    expl = q['explanation']
    if len(expl) > 1200:
        # cut at first occurrence of a numbered question or newline/boundary
        m = re.search(r'\s\d{1,3}\s*[\.\?\)]\s+[^\.\?]{5,}\?', expl)
        if m:
            q['explanation'] = expl[:m.start()].strip()
        else:
            q['explanation'] = expl[:1000].strip()

# re-check stats
long_qs = [q for q in qs if len(q['explanation']) > 1200]
print(f"Questions > 1200 chars after cleanup: {len(long_qs)}")

expl_lens = [len(q['explanation']) for q in qs if not q['explanation'].startswith('התשובה הנכונה היא:')]
print(f"Max explanation length: {max(expl_lens)}")
print(f"Average explanation length: {sum(expl_lens)//len(expl_lens)}")
