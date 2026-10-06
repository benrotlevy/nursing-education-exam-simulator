import fitz
import pypdf

reader = pypdf.PdfReader("raw_materials/exams/שחזור ממשלתי הדרכה קלינית 2024.pdf")
print("PyPDF Page 1 text snippet:")
page1_text = reader.pages[0].extract_text()
print(page1_text[:500])

doc = fitz.open("raw_materials/exams/שחזור ממשלתי הדרכה קלינית 2024.pdf")
page1 = doc[0]
print("\nPyMuPDF Page 1 raw text snippet:")
print(page1.get_text()[:500])
