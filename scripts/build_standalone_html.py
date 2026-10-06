import os

def build_standalone():
    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    with open('questions.js', 'r', encoding='utf-8') as f:
        js = f.read()

    target = '<script src="questions.js"></script>'
    if target in html:
        # Replace external script with embedded script
        standalone = html.replace(target, f'<script>\n{js}\n</script>')
        out_path = 'simulator_all_in_one.html'
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(standalone)
        print(f"SUCCESS: Created {out_path} ({len(standalone)} bytes)")
    else:
        print("ERROR: Target <script src=\"questions.js\"></script> not found in index.html")

if __name__ == '__main__':
    build_standalone()
