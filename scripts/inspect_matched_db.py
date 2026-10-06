import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

from cross_match_50_highlights import found_in_db

print(f"Total matched to DB: {len(found_in_db)}")

for m in found_in_db:
    dq = m['dump_q']
    hl = m['highlight']
    dbq = m['db_q']
    c_idx = dbq.get('correctIndex')
    db_correct = dbq['options'][c_idx] if c_idx is not None and c_idx < len(dbq['options']) else 'None'
    print(f"\nQ{m['num']:02d} [DB ID {dbq['id']}]:")
    print(f"  Dump: {dq['question'][:60]}")
    print(f"  Highlight in PDF: {hl['letter']}. {hl['text']}")
    print(f"  In DB (verified={dbq.get('verified')}): {db_correct[:60]}")
