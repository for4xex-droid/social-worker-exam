"""
Download all exam PDFs from SSSC and extract questions, options, and answers.
Creates a complete database of official exam data.
"""

import requests
import json
import re
import os
import time
import pdfplumber

BASE_URL = "https://www.sssc.or.jp/shakai/past_exam/pdf"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
OUTPUT_DIR = (
    "c:/Users/user/.gemini/social-worker-exam/welfare-master/data_pipeline/sssc_pdfs"
)
DATA_DIR = "c:/Users/user/.gemini/social-worker-exam/welfare-master/data_pipeline"

# Exam configurations - all subjects for each year
EXAMS = {
    "第37回": {
        "year": "令和6年度",
        "folder": "no37",
        "subjects": [
            # AM subjects (共通科目 for social worker - mental health worker shared)
            {"file": "sp_am_01_37.pdf", "name": "医学概論", "q_start": 1},
            {"file": "sp_am_02_37.pdf", "name": "心理学と心理的支援", "q_start": 7},
            {"file": "sp_am_03_37.pdf", "name": "社会学と社会システム", "q_start": 13},
            {"file": "sp_am_04_37.pdf", "name": "社会福祉の原理と政策", "q_start": 19},
            {"file": "sp_am_05_37.pdf", "name": "社会保障", "q_start": 28},
            {
                "file": "sp_am_06_37.pdf",
                "name": "権利擁護を支える法制度",
                "q_start": 37,
            },
            {
                "file": "sp_am_07_37.pdf",
                "name": "地域福祉と包括的支援体制",
                "q_start": 43,
            },
            {"file": "sp_am_08_37.pdf", "name": "障害者福祉", "q_start": 52},
            {"file": "sp_am_09_37.pdf", "name": "刑事司法と福祉", "q_start": 58},
            {
                "file": "sp_am_10_37.pdf",
                "name": "ソーシャルワークの基盤と専門職",
                "q_start": 64,
            },
            {
                "file": "sp_am_11_37.pdf",
                "name": "ソーシャルワークの理論と方法",
                "q_start": 70,
            },
            {"file": "sp_am_12_37.pdf", "name": "社会福祉調査の基礎", "q_start": 79},
            # PM subjects (社会福祉士専門科目)
            {"file": "ss_pm_01_37.pdf", "name": "高齢者福祉", "q_start": 85},
            {"file": "ss_pm_02_37.pdf", "name": "児童・家庭福祉", "q_start": 91},
            {"file": "ss_pm_03_37.pdf", "name": "貧困に対する支援", "q_start": 97},
            {"file": "ss_pm_04_37.pdf", "name": "保健医療と福祉", "q_start": 103},
            {
                "file": "ss_pm_05_37.pdf",
                "name": "ソーシャルワークの基盤と専門職（専門）",
                "q_start": 109,
            },
            {
                "file": "ss_pm_06_37.pdf",
                "name": "ソーシャルワークの理論と方法（専門）",
                "q_start": 115,
            },
            {
                "file": "ss_pm_07_37.pdf",
                "name": "福祉サービスの組織と経営",
                "q_start": 124,
            },
        ],
        "answer_file": "answer_key_r6_official.json",
        "total_questions": 129,
    },
    "第36回": {
        "year": "令和5年度",
        "folder": "no36",
        "subjects": [
            # Older format with different subject names
            {
                "file": "sp_am_01_36.pdf",
                "name": "人体の構造と機能及び疾病",
                "q_start": 1,
            },
            {"file": "sp_am_02_36.pdf", "name": "心理学理論と心理的支援", "q_start": 8},
            {
                "file": "sp_am_03_36.pdf",
                "name": "社会理論と社会システム",
                "q_start": 15,
            },
            {"file": "sp_am_04_36.pdf", "name": "現代社会と福祉", "q_start": 22},
            {"file": "sp_am_05_36.pdf", "name": "地域福祉の理論と方法", "q_start": 32},
            {"file": "sp_am_06_36.pdf", "name": "福祉行財政と福祉計画", "q_start": 42},
            {"file": "sp_am_07_36.pdf", "name": "社会保障", "q_start": 49},
            {
                "file": "sp_am_08_36.pdf",
                "name": "障害者に対する支援と障害者自立支援制度",
                "q_start": 56,
            },
            {
                "file": "sp_am_09_36.pdf",
                "name": "低所得者に対する支援と生活保護制度",
                "q_start": 63,
            },
            {"file": "sp_am_10_36.pdf", "name": "保健医療サービス", "q_start": 70},
            {
                "file": "sp_am_11_36.pdf",
                "name": "権利擁護と成年後見制度",
                "q_start": 77,
            },
            {"file": "ss_pm_01_36.pdf", "name": "社会調査の基礎", "q_start": 84},
            {
                "file": "ss_pm_02_36.pdf",
                "name": "相談援助の基盤と専門職",
                "q_start": 91,
            },
            {"file": "ss_pm_03_36.pdf", "name": "相談援助の理論と方法", "q_start": 98},
            {
                "file": "ss_pm_04_36.pdf",
                "name": "福祉サービスの組織と経営",
                "q_start": 119,
            },
            {
                "file": "ss_pm_05_36.pdf",
                "name": "高齢者に対する支援と介護保険制度",
                "q_start": 126,
            },
            {
                "file": "ss_pm_06_36.pdf",
                "name": "児童や家庭に対する支援と児童・家庭福祉制度",
                "q_start": 136,
            },
            {"file": "ss_pm_07_36.pdf", "name": "就労支援サービス", "q_start": 143},
            {"file": "ss_pm_08_36.pdf", "name": "更生保護制度", "q_start": 147},
        ],
        "answer_file": "answer_key_social_r5_official.json",
        "total_questions": 150,
    },
    "第35回": {
        "year": "令和4年度",
        "folder": "no35",
        "subjects": [
            {
                "file": "sp_am_01_35.pdf",
                "name": "人体の構造と機能及び疾病",
                "q_start": 1,
            },
            {"file": "sp_am_02_35.pdf", "name": "心理学理論と心理的支援", "q_start": 8},
            {
                "file": "sp_am_03_35.pdf",
                "name": "社会理論と社会システム",
                "q_start": 15,
            },
            {"file": "sp_am_04_35.pdf", "name": "現代社会と福祉", "q_start": 22},
            {"file": "sp_am_05_35.pdf", "name": "地域福祉の理論と方法", "q_start": 32},
            {"file": "sp_am_06_35.pdf", "name": "福祉行財政と福祉計画", "q_start": 42},
            {"file": "sp_am_07_35.pdf", "name": "社会保障", "q_start": 49},
            {
                "file": "sp_am_08_35.pdf",
                "name": "障害者に対する支援と障害者自立支援制度",
                "q_start": 56,
            },
            {
                "file": "sp_am_09_35.pdf",
                "name": "低所得者に対する支援と生活保護制度",
                "q_start": 63,
            },
            {"file": "sp_am_10_35.pdf", "name": "保健医療サービス", "q_start": 70},
            {
                "file": "sp_am_11_35.pdf",
                "name": "権利擁護と成年後見制度",
                "q_start": 77,
            },
            {"file": "ss_pm_01_35.pdf", "name": "社会調査の基礎", "q_start": 84},
            {
                "file": "ss_pm_02_35.pdf",
                "name": "相談援助の基盤と専門職",
                "q_start": 91,
            },
            {"file": "ss_pm_03_35.pdf", "name": "相談援助の理論と方法", "q_start": 98},
            {
                "file": "ss_pm_04_35.pdf",
                "name": "福祉サービスの組織と経営",
                "q_start": 119,
            },
            {
                "file": "ss_pm_05_35.pdf",
                "name": "高齢者に対する支援と介護保険制度",
                "q_start": 126,
            },
            {
                "file": "ss_pm_06_35.pdf",
                "name": "児童や家庭に対する支援と児童・家庭福祉制度",
                "q_start": 136,
            },
            {"file": "ss_pm_07_35.pdf", "name": "就労支援サービス", "q_start": 143},
            {"file": "ss_pm_08_35.pdf", "name": "更生保護制度", "q_start": 147},
        ],
        "answer_file": "answer_key_social_r4_official.json",
        "total_questions": 150,
    },
}


def download_pdf(url, local_path):
    """Download a PDF file."""
    if os.path.exists(local_path):
        return True

    try:
        print(f"    Downloading: {os.path.basename(url)}")
        r = requests.get(url, headers=HEADERS, timeout=30)
        r.raise_for_status()

        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with open(local_path, "wb") as f:
            f.write(r.content)

        time.sleep(0.3)
        return True
    except Exception as e:
        print(f"    Error: {e}")
        return False


def extract_text_from_pdf(pdf_path):
    """Extract text from a PDF file."""
    try:
        text = ""
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text
    except Exception as e:
        print(f"    Error extracting: {e}")
        return None


def parse_questions_from_pdf_text(text, subject_name, expected_q_start):
    """
    Parse questions and options from PDF text.
    Returns list of dicts with question_number, question_text, options.
    """
    questions = []

    # Clean text
    text = text.replace("\r", "")

    # Try to find question markers - various formats
    # "問題 1" or "問 1" with the question text following

    # Split by question number patterns
    # Pattern: starts line with 問題 or 問 followed by number
    parts = re.split(r"\n(?=問題?\s*\d+\s)", text)

    for part in parts:
        # Extract question number
        q_match = re.match(r"問題?\s*(\d+)\s*(.*)", part, re.DOTALL)
        if q_match:
            q_num = int(q_match.group(1))
            rest = q_match.group(2)

            # Extract options (lines starting with 1-5)
            options = []
            option_pattern = re.compile(
                r"^([1-5])\s+(.+?)(?=\n[1-5]\s|\n問題?\s*\d+|\Z)",
                re.MULTILINE | re.DOTALL,
            )

            # Find question text (before first option)
            first_option = re.search(r"\n[1-5]\s", rest)
            if first_option:
                q_text = rest[: first_option.start()].strip()
                options_text = rest[first_option.start() :]

                # Extract each option
                opt_matches = option_pattern.findall(options_text)
                for opt_num, opt_text in opt_matches:
                    clean_opt = " ".join(opt_text.split())  # Normalize whitespace
                    options.append(clean_opt)
            else:
                q_text = rest.strip()

            # Clean question text
            q_text = " ".join(q_text.split())

            if q_text and len(q_text) > 10:  # Filter out garbage
                questions.append(
                    {
                        "question_number": q_num,
                        "question_text": q_text,
                        "options": options[:5],  # Max 5 options
                        "category_label": subject_name,
                    }
                )

    return questions


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    all_questions = []

    for exam_name, exam_info in EXAMS.items():
        print(f"\n{'=' * 60}")
        print(f"Processing {exam_name} ({exam_info['year']})")
        print(f"{'=' * 60}")

        # Load answer key
        answer_file = f"{DATA_DIR}/{exam_info['answer_file']}"
        if os.path.exists(answer_file):
            with open(answer_file, "r", encoding="utf-8") as f:
                answers = json.load(f)
            print(f"  Loaded {len(answers)} answers from {exam_info['answer_file']}")
        else:
            print(f"  Warning: Answer file not found: {answer_file}")
            answers = {}

        exam_questions = []

        for subject in exam_info["subjects"]:
            pdf_url = f"{BASE_URL}/{exam_info['folder']}/{subject['file']}"
            pdf_path = f"{OUTPUT_DIR}/{exam_info['folder']}/{subject['file']}"

            print(f"\n  {subject['name']}:")
            if not download_pdf(pdf_url, pdf_path):
                continue

            text = extract_text_from_pdf(pdf_path)
            if not text:
                continue

            questions = parse_questions_from_pdf_text(
                text, subject["name"], subject["q_start"]
            )
            print(f"    Extracted {len(questions)} questions")

            # Add answer key to each question
            for q in questions:
                q_num = str(q["question_number"])
                if q_num in answers:
                    answer_str = answers[q_num]
                    q["correct_answer"] = [a.strip() for a in answer_str.split(",")]
                else:
                    q["correct_answer"] = []

                q["year"] = exam_info["year"]
                q["group"] = "past_social"
                q["exam_number"] = exam_name

            exam_questions.extend(questions)

        print(f"\n  Total for {exam_name}: {len(exam_questions)} questions")
        all_questions.extend(exam_questions)

    # Save all extracted questions
    output_path = f"{DATA_DIR}/sssc_official_questions.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)

    print(f"\n{'=' * 60}")
    print(f"Total questions extracted: {len(all_questions)}")
    print(f"Saved to: {output_path}")


if __name__ == "__main__":
    main()
