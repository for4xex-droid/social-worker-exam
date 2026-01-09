"""
Scrape official SSSC past exam data from PDFs.
Downloads PDFs from the official Social Welfare Promotion and National Examination Center website
and extracts questions, options, and answers.
"""

import requests
import json
import re
import os
import time

# Try to import PDF libraries
try:
    import pdfplumber

    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False
    print("pdfplumber not installed. Run: pip install pdfplumber")

BASE_URL = "https://www.sssc.or.jp/shakai/past_exam/pdf"

# PDF structure for each exam year
EXAMS = {
    "第37回": {
        "year": "令和6年度",
        "exam_number": 37,
        "folder": "no37",
        "am_subjects": [
            ("sp_am_01_37.pdf", "医学概論"),
            ("sp_am_02_37.pdf", "心理学と心理的支援"),
            ("sp_am_03_37.pdf", "社会学と社会システム"),
            ("sp_am_04_37.pdf", "社会福祉の原理と政策"),
            ("sp_am_05_37.pdf", "社会保障"),
            ("sp_am_06_37.pdf", "権利擁護を支える法制度"),
            ("sp_am_07_37.pdf", "地域福祉と包括的支援体制"),
            ("sp_am_08_37.pdf", "障害者福祉"),
            ("sp_am_09_37.pdf", "刑事司法と福祉"),
            ("sp_am_10_37.pdf", "ソーシャルワークの基盤と専門職"),
            ("sp_am_11_37.pdf", "ソーシャルワークの理論と方法"),
            ("sp_am_12_37.pdf", "社会福祉調査の基礎"),
        ],
        "pm_subjects": [
            ("ss_pm_01_37.pdf", "高齢者福祉"),
            ("ss_pm_02_37.pdf", "児童・家庭福祉"),
            ("ss_pm_03_37.pdf", "貧困に対する支援"),
            ("ss_pm_04_37.pdf", "保健医療と福祉"),
            ("ss_pm_05_37.pdf", "ソーシャルワークの基盤と専門職（専門）"),
            ("ss_pm_06_37.pdf", "ソーシャルワークの理論と方法（専門）"),
            ("ss_pm_07_37.pdf", "福祉サービスの組織と経営"),
        ],
        "answer_pdf": "s_kijun_seitou.pdf",
    },
    "第36回": {
        "year": "令和5年度",
        "exam_number": 36,
        "folder": "no36",
        "answer_pdf": "s_kijun_seitou.pdf",
    },
    "第35回": {
        "year": "令和4年度",
        "exam_number": 35,
        "folder": "no35",
        "answer_pdf": "s_kijun_seitou.pdf",
    },
}

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
OUTPUT_DIR = (
    "c:/Users/user/.gemini/social-worker-exam/welfare-master/data_pipeline/sssc_pdfs"
)


def download_pdf(url, local_path):
    """Download a PDF file from URL to local path."""
    if os.path.exists(local_path):
        print(f"  Already exists: {local_path}")
        return True

    try:
        print(f"  Downloading: {url}")
        r = requests.get(url, headers=HEADERS, timeout=30)
        r.raise_for_status()

        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with open(local_path, "wb") as f:
            f.write(r.content)

        print(f"  Saved: {local_path}")
        time.sleep(0.5)  # Be polite
        return True
    except Exception as e:
        print(f"  Error downloading {url}: {e}")
        return False


def extract_text_from_pdf(pdf_path):
    """Extract text from a PDF file using pdfplumber."""
    if not HAS_PDFPLUMBER:
        return None

    try:
        text = ""
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text
    except Exception as e:
        print(f"  Error extracting text from {pdf_path}: {e}")
        return None


def parse_questions_from_text(text):
    """Parse questions and options from extracted PDF text."""
    questions = []

    # Pattern to match question numbers like "問題 1" or "問1"
    # and option patterns like "1 選択肢テキスト" or "１　選択肢テキスト"

    # Split by question markers
    question_pattern = re.compile(r"問題?\s*(\d+)\s*")
    option_pattern = re.compile(r"^[\s]*([1-5１２３４５])\s+(.+?)$", re.MULTILINE)

    # Find all question blocks
    parts = question_pattern.split(text)

    if len(parts) > 1:
        # parts[0] is before first question, parts[1] is q_num, parts[2] is content, etc.
        for i in range(1, len(parts) - 1, 2):
            q_num = parts[i]
            q_content = parts[i + 1] if i + 1 < len(parts) else ""

            # Extract options
            options = []
            option_matches = option_pattern.findall(q_content)
            for opt_num, opt_text in option_matches:
                options.append(opt_text.strip())

            # Get question text (before options)
            first_option_match = option_pattern.search(q_content)
            if first_option_match:
                q_text = q_content[: first_option_match.start()].strip()
            else:
                q_text = q_content.strip()

            if q_text:
                questions.append(
                    {
                        "question_number": int(q_num),
                        "question_text": q_text,
                        "options": options,
                    }
                )

    return questions


def download_all_pdfs():
    """Download all exam PDFs from SSSC."""
    print("Downloading PDFs from SSSC...")

    for exam_name, exam_info in EXAMS.items():
        folder = exam_info["folder"]
        print(f"\n{exam_name} ({exam_info['year']}):")

        # Download answer PDF
        answer_url = f"{BASE_URL}/{folder}/{exam_info['answer_pdf']}"
        answer_path = f"{OUTPUT_DIR}/{folder}/{exam_info['answer_pdf']}"
        download_pdf(answer_url, answer_path)


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    if not HAS_PDFPLUMBER:
        print("\nInstalling pdfplumber...")
        os.system("pip install pdfplumber")
        print("Please re-run the script after installation.")
        return

    download_all_pdfs()

    # Test PDF extraction on one file
    test_pdf = f"{OUTPUT_DIR}/no37/s_kijun_seitou.pdf"
    if os.path.exists(test_pdf):
        print(f"\nTesting PDF extraction on: {test_pdf}")
        text = extract_text_from_pdf(test_pdf)
        if text:
            print("Extracted text (first 2000 chars):")
            print(text[:2000])
        else:
            print("Failed to extract text")


if __name__ == "__main__":
    main()
