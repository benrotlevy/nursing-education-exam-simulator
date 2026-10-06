import fitz
import re
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
doc = fitz.open("raw_materials/exams/שחזור ממשלתי הדרכה קלינית 2024.pdf")

all_questions = []

for page_num in range(len(doc)):
    page = doc[page_num]
    
    # 1. Yellow rects on this page
    yellow_rects = []
    for d in page.get_drawings():
        fill = d.get("fill")
        if fill:
            r, g, b = fill[:3]
            if r > 0.8 and g > 0.8 and b < 0.2:
                yellow_rects.append(fitz.Rect(d["rect"]))
    yellow_rects.sort(key=lambda r: r.y0)
    
    # 2. Page blocks
    page_dict = page.get_text("dict")
    
    # We want to reconstruct logical items: question header or option
    # Look at blocks
    current_q = None
    
    for b in page_dict["blocks"]:
        if "lines" not in b:
            continue
        
        # Collect full text of block
        lines_text = []
        for l in b["lines"]:
            lt = "".join(s["text"] for s in l["spans"]).strip()
            if lt:
                lines_text.append(lt)
        block_text = " ".join(lines_text).strip()
        if not block_text:
            continue
            
        b_bbox = fitz.Rect(b["bbox"])
        
        # Check if block starts a new question: e.g. "1 .", "10 .", etc.
        m_q = re.match(r'^(\d+)\s*[\.\)]\s*(.*)', block_text)
        if not m_q:
            # Maybe the block has "1", next line has ".", or number is on its own line
            m_first_num = re.match(r'^(\d+)\s*$', lines_text[0]) if lines_text else None
            if m_first_num and int(m_first_num.group(1)) not in [2024, page_num + 1]:
                # It's a question number!
                rest_text = " ".join(lines_text[1:]).lstrip('.').strip()
                m_q = (int(m_first_num.group(1)), rest_text)
        else:
            m_q = (int(m_q.group(1)), m_q.group(2).strip())
            
        if m_q and m_q[0] not in [2024, page_num + 1]:
            q_num, q_prompt = m_q
            # Save previous question if exists
            if current_q:
                all_questions.append(current_q)
            current_q = {
                "num": q_num,
                "page": page_num + 1,
                "prompt": q_prompt,
                "options": [],
                "highlighted_index": None,
                "highlighted_letter": None,
                "highlighted_text": None,
                "bbox": b_bbox
            }
            continue
            
        # If we have a current question, check if this block is an option or continuation
        if current_q:
            # Check if block is an option: e.g. "א.", ".א", "ב.", "ג.", "ד."
            m_opt = re.match(r'^(?:[\.\)])?\s*([א-דa-d])\s*(?:[\.\)])?\s*(.*)', block_text)
            # Or ".אProficient"
            m_opt_rev = re.match(r'^\.([א-דa-d])(.*)', block_text)
            
            is_option = False
            opt_letter = None
            opt_content = ""
            
            if m_opt and m_opt.group(1) in ['א', 'ב', 'ג', 'ד', 'a', 'b', 'c', 'd']:
                is_option = True
                opt_letter = m_opt.group(1)
                opt_content = m_opt.group(2).strip()
            elif m_opt_rev and m_opt_rev.group(1) in ['א', 'ב', 'ג', 'ד', 'a', 'b', 'c', 'd']:
                is_option = True
                opt_letter = m_opt_rev.group(1)
                opt_content = m_opt_rev.group(2).strip()
                
            if is_option:
                # Check if this option overlaps any yellow rect
                is_highlighted = False
                for yr in yellow_rects:
                    v_overlap = max(0, min(yr.y1, b_bbox.y1) - max(yr.y0, b_bbox.y0))
                    if v_overlap > (b_bbox.height * 0.3) or (b_bbox.y0 <= yr.y0 <= b_bbox.y1) or (b_bbox.y0 <= yr.y1 <= b_bbox.y1):
                        is_highlighted = True
                        break
                        
                opt_idx = len(current_q["options"])
                current_q["options"].append({
                    "letter": opt_letter,
                    "text": opt_content,
                    "bbox": [b_bbox.x0, b_bbox.y0, b_bbox.x1, b_bbox.y1],
                    "is_highlighted": is_highlighted
                })
                if is_highlighted:
                    current_q["highlighted_index"] = opt_idx
                    current_q["highlighted_letter"] = opt_letter
                    current_q["highlighted_text"] = opt_content
            else:
                # Continuation of prompt or previous option
                if len(current_q["options"]) == 0:
                    current_q["prompt"] += " " + block_text
                else:
                    current_q["options"][-1]["text"] += " " + block_text
                    
if current_q:
    all_questions.append(current_q)

print(f"Total extracted questions: {len(all_questions)}")

# Print summary
highlighted_count = sum(1 for q in all_questions if q["highlighted_index"] is not None)
print(f"Questions with yellow highlight: {highlighted_count} / {len(all_questions)}")

for q in all_questions:
    status = f"Option {q['highlighted_letter']} (idx {q['highlighted_index']}): {q['highlighted_text']}" if q['highlighted_index'] is not None else "NO HIGHLIGHT"
    print(f"Q{q['num']:02d} (Page {q['page']}): {status} | Options: {len(q['options'])}")
