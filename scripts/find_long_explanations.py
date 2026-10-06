import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('questions.js', encoding='utf-8') as f:
    text = f.read()

start = text.find('window.EXAM_QUESTIONS = ') + len('window.EXAM_QUESTIONS = ')
end = text.rfind(';')
qs = json.loads(text[start:end])

long_qs = [q for q in qs if len(q['explanation']) > 1500]
print(f"Questions with explanation > 1500 chars: {len(long_qs)}")
for q in long_qs:
    qid = q['id']
    qlen = len(q['explanation'])
    qtext = q['question'][:60]
    print(f"[{qid}] Length: {qlen} | Question: {qtext}...")
    print(f"   Snippet: {q['explanation'][:180]}...")
    print(f"   End snippet: ...{q['explanation'][-180:]}\n")
