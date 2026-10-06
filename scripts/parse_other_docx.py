import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Middle exam docx: 14 QA pairs
with open('data/שחזור מבחן אמצע הדרכה קלינית 06.txt', encoding='utf-8') as f:
    mid_lines = [l.strip() for l in f if l.strip()]

mid_qs = []
i = 1
while i < len(mid_lines):
    line = mid_lines[i]
    m = re.match(r'^\d+[\.\)]\s*(.+)$', line)
    if m:
        q_text = m.group(1).strip()
        ans_text = ""
        if i + 1 < len(mid_lines) and not re.match(r'^\d+[\.\)]', mid_lines[i+1]):
            ans_text = mid_lines[i+1].strip()
            i += 2
        else:
            i += 1
        if ans_text:
            mid_qs.append({
                'source': 'שחזור מבחן אמצע 06.05.2025',
                'question': q_text,
                'correct': ans_text
            })
            continue
    i += 1

print(f"Extracted {len(mid_qs)} questions from Middle Exam docx.")

# May exam docx:
with open('data/שחזור מבחן מאי הדרכה קלינית.txt', encoding='utf-8') as f:
    may_lines = [l.strip() for l in f if l.strip()]

may_qs = []
idx = 1
while idx < len(may_lines):
    line = may_lines[idx]
    if " - " in line:
        parts = line.split(" - ", 1)
        may_qs.append({
            'source': 'שחזור מבחן מאי',
            'question': parts[0].strip(),
            'correct': parts[1].strip()
        })
        idx += 1
    elif idx + 4 < len(may_lines) and not " - " in may_lines[idx+1] and not " - " in may_lines[idx+2]:
        # check if it has 4 options
        q_text = line
        opts = [may_lines[idx+1], may_lines[idx+2], may_lines[idx+3], may_lines[idx+4]]
        # check if they look like options
        if all(len(o) < 30 for o in opts):
            may_qs.append({
                'source': 'שחזור מבחן מאי',
                'question': q_text,
                'options': opts
            })
            idx += 5
            continue
        idx += 1
    else:
        idx += 1

print(f"Extracted {len(may_qs)} questions from May Exam docx.")
