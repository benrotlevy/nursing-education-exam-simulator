import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('questions.js', encoding='utf-8') as f:
    text = f.read()

start = text.find('window.EXAM_QUESTIONS = ') + len('window.EXAM_QUESTIONS = ')
end = text.rfind(';')
qs = json.loads(text[start:end])

print(f"Total questions in questions.js: {len(qs)}")

with_full_expl = [q for q in qs if not q['explanation'].startswith('התשובה הנכונה היא:')]
print(f"Questions with detailed explanations: {len(with_full_expl)}")

expl_lengths = [len(q['explanation']) for q in with_full_expl]
print(f"Average explanation length: {sum(expl_lengths)//len(expl_lengths)} chars")
print(f"Max explanation length: {max(expl_lengths)} chars")
print(f"Min explanation length: {min(expl_lengths)} chars")

step = max(1, len(with_full_expl) // 6)
print("\n--- 6 Samples of Explanations Across the Database ---")
for idx, q in enumerate(with_full_expl[::step][:6]):
    print(f"\n[{q['id']}] {q['source']} | קטגוריה: {q['category']}")
    print(f"שאלה: {q['question']}")
    print(f"הסבר מלא: {q['explanation']}")
