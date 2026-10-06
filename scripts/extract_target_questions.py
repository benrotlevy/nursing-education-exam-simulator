import fitz
import sys
import re
import json

sys.stdout.reconfigure(encoding='utf-8')

def extract_questions_from_pdf(fpath, source_name):
    doc = fitz.open(fpath)
    extracted = []
    
    current_q = None
    
    for p_idx in range(len(doc)):
        page = doc[p_idx]
        p_num = p_idx + 1
        
        # Yellow rects
        yellow_rects = []
        for d in page.get_drawings():
            f = d.get("fill")
            if f and f[0] > 0.8 and f[1] > 0.8 and f[2] < 0.2:
                yellow_rects.append(fitz.Rect(d["rect"]))
        yellow_rects.sort(key=lambda r: r.y0)
        
        # Blocks
        page_dict = page.get_text("dict")
        blocks = page_dict["blocks"]
        
        for b in blocks:
            if "lines" not in b:
                continue
            
            b_text = " ".join("".join(s["text"] for s in l["spans"]).strip() for l in b["lines"]).strip()
            if not b_text:
                continue
            b_bbox = fitz.Rect(b["bbox"])
            
            # Check if block starts a new question: e.g. "1.", "1 .", "2.", "38."
            # Note: in Hebrew, sometimes it's "1 ." or "1\n."
            m_q = re.match(r'^(\d+)\s*[\.\)]\s*(.*)', b_text)
            if not m_q:
                # Check first line
                first_line = "".join(s["text"] for s in b["lines"][0]["spans"]).strip()
                m_num = re.match(r'^(\d+)\s*$', first_line)
                if m_num and int(m_num.group(1)) < 150:
                    rest = " ".join("".join(s["text"] for s in l["spans"]).strip() for l in b["lines"][1:]).lstrip('.').strip()
                    m_q = (int(m_num.group(1)), rest)
            else:
                m_q = (int(m_q.group(1)), m_q.group(2).strip())
                
            if m_q and m_q[0] < 150:
                q_num, q_prompt = m_q
                if current_q:
                    extracted.append(current_q)
                current_q = {
                    "source": source_name,
                    "num": q_num,
                    "page": p_num,
                    "question": q_prompt,
                    "options": [],
                    "highlighted_index": None,
                    "highlighted_text": None,
                    "bbox": b_bbox
                }
                continue
                
            # If current_q exists, check if block is an option
            if current_q:
                # Option patterns: "א.", "ב.", "ג.", "ד." or "א )"
                m_opt = re.match(r'^(?:[\.\)])?\s*([א-דa-d])\s*(?:[\.\)])\s*(.*)', b_text)
                if not m_opt:
                    m_opt = re.match(r'^\.([א-דa-d])\s*(.*)', b_text)
                    
                is_opt = False
                opt_letter = None
                opt_text = ""
                
                if m_opt and m_opt.group(1) in ['א', 'ב', 'ג', 'ד']:
                    is_opt = True
                    opt_letter = m_opt.group(1)
                    opt_text = m_opt.group(2).strip()
                elif b_text.startswith(('א.', 'ב.', 'ג.', 'ד.')):
                    is_opt = True
                    opt_letter = b_text[0]
                    opt_text = b_text[2:].strip()
                    
                if is_opt:
                    # Check if this block or its lines overlap with any yellow rect
                    is_hl = False
                    for yr in yellow_rects:
                        v_overlap = max(0, min(yr.y1, b_bbox.y1) - max(yr.y0, b_bbox.y0))
                        if v_overlap > (b_bbox.height * 0.3) or (b_bbox.y0 <= yr.y0 <= b_bbox.y1) or (b_bbox.y0 <= yr.y1 <= b_bbox.y1):
                            is_hl = True
                            break
                            
                    opt_idx = len(current_q["options"])
                    current_q["options"].append({
                        "letter": opt_letter,
                        "text": opt_text,
                        "is_highlighted": is_hl
                    })
                    if is_hl:
                        current_q["highlighted_index"] = opt_idx
                        current_q["highlighted_text"] = opt_text
                else:
                    # Continuation
                    if len(current_q["options"]) == 0:
                        current_q["question"] += " " + b_text
                    else:
                        current_q["options"][-1]["text"] += " " + b_text
                        # check if continuation line was highlighted
                        for yr in yellow_rects:
                            v_overlap = max(0, min(yr.y1, b_bbox.y1) - max(yr.y0, b_bbox.y0))
                            if v_overlap > (b_bbox.height * 0.3):
                                current_q["options"][-1]["is_highlighted"] = True
                                current_q["highlighted_index"] = len(current_q["options"]) - 1
                                current_q["highlighted_text"] = current_q["options"][-1]["text"]
                                break
                                
    if current_q:
        extracted.append(current_q)
        
    return extracted

f1_qs = extract_questions_from_pdf("raw_materials/exams/תרגילים להכנה למבחן ממשלתי (1).pdf", "תרגילים להכנה למבחן ממשלתי")
f2_qs = extract_questions_from_pdf("raw_materials/exams/מקור לא ברור - מבחן לתרגול.pdf", "מבחן לתרגול")

print(f"File 1 (תרגילים): Extracted {len(f1_qs)} questions.")
print(f"File 1 highlighted count: {sum(1 for q in f1_qs if q['highlighted_index'] is not None)}")

print(f"File 2 (מקור לתרגול): Extracted {len(f2_qs)} questions.")
print(f"File 2 highlighted count: {sum(1 for q in f2_qs if q['highlighted_index'] is not None)}")

# Show summary of first 5 from each
print("\n--- File 1 Sample ---")
for q in f1_qs[:5]:
    hl_str = f"Opt {q['options'][q['highlighted_index']]['letter']}: {q['highlighted_text']}" if q['highlighted_index'] is not None else "NONE"
    print(f"Q{q['num']:02d} ({len(q['options'])} opts): {q['question'][:50]}... | Highlight: {hl_str}")

print("\n--- File 2 Sample ---")
for q in f2_qs[:5]:
    hl_str = f"Opt {q['options'][q['highlighted_index']]['letter']}: {q['highlighted_text']}" if q['highlighted_index'] is not None else "NONE"
    print(f"Q{q['num']:02d} ({len(q['options'])} opts): {q['question'][:50]}... | Highlight: {hl_str}")
