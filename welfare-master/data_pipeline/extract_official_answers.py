"""
Extract official answer keys from SSSC PDFs and update the answer key JSON files.
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

# Exam configurations
EXAMS = [
    {
        "name": "第37回",
        "year": "令和6年度",
        "folder": "no37",
        "answer_pdf": "s_kijun_seitou.pdf",
        "output_file": "answer_key_r6_official.json",
        "group": "past_social",
    },
    {
        "name": "第36回",
        "year": "令和5年度",
        "folder": "no36",
        "answer_pdf": "s_kijun_seitou.pdf",
        "output_file": "answer_key_social_r5_official.json",
        "group": "past_social",
    },
    {
        "name": "第35回",
        "year": "令和4年度",
        "folder": "no35",
        "answer_pdf": "s_kijun_seitou.pdf",
        "output_file": "answer_key_social_r4_official.json",
        "group": "past_social",
    },
]


def download_pdf(url, local_path):
    """Download a PDF file."""
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
        time.sleep(0.5)
        return True
    except Exception as e:
        print(f"  Error downloading {url}: {e}")
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
        print(f"  Error extracting text from {pdf_path}: {e}")
        return None


def parse_answer_key_from_text(text):
    """
    Parse answer key from SSSC PDF text format.
    Format: 問題番号 N N N N N N
            正 答   X X X X X X
    """
    answers = {}

    lines = text.split("\n")
    i = 0
    while i < len(lines) - 1:
        line = lines[i].strip()

        # Look for "問題番号" line
        if "問題番号" in line:
            # Extract question numbers from this line
            q_numbers = re.findall(r"\d+", line)

            # Next line should be "正 答" or "正答"
            if i + 1 < len(lines):
                answer_line = lines[i + 1].strip()
                if "正" in answer_line and "答" in answer_line:
                    # Extract answers - handle both simple (1) and compound (1,2) answers
                    # Remove "正 答" or "正答" prefix
                    answer_part = re.sub(r"^正\s*答\s*", "", answer_line)

                    # Split by whitespace but keep compound answers together
                    # Pattern: numbers possibly with commas between them
                    answer_matches = re.findall(r"(\d(?:,\d)*)", answer_part)

                    # Map question numbers to answers
                    for j, q_num in enumerate(q_numbers):
                        if j < len(answer_matches):
                            answers[q_num] = answer_matches[j]
        i += 1

    return answers


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    all_results = {}

    for exam in EXAMS:
        print(f"\n{'=' * 60}")
        print(f"Processing {exam['name']} ({exam['year']})")
        print(f"{'=' * 60}")

        # Download answer PDF
        pdf_url = f"{BASE_URL}/{exam['folder']}/{exam['answer_pdf']}"
        pdf_path = f"{OUTPUT_DIR}/{exam['folder']}/{exam['answer_pdf']}"

        if not download_pdf(pdf_url, pdf_path):
            continue

        # Extract text
        text = extract_text_from_pdf(pdf_path)
        if not text:
            print("  Failed to extract text")
            continue

        # Parse answers
        answers = parse_answer_key_from_text(text)
        print(f"  Extracted {len(answers)} answers")

        # Show first and last few answers for verification
        sorted_keys = sorted(answers.keys(), key=int)
        if sorted_keys:
            print(f"  First 5: {[(k, answers[k]) for k in sorted_keys[:5]]}")
            print(f"  Last 5: {[(k, answers[k]) for k in sorted_keys[-5:]]}")

        # Save to JSON file
        output_path = f"{DATA_DIR}/{exam['output_file']}"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(answers, f, ensure_ascii=False, indent=4)
        print(f"  Saved to: {output_path}")

        all_results[exam["name"]] = {
            "year": exam["year"],
            "count": len(answers),
            "output_file": exam["output_file"],
        }

    # Summary
    print(f"\n{'=' * 60}")
    print("Summary")
    print(f"{'=' * 60}")
    for name, result in all_results.items():
        print(
            f"  {name} ({result['year']}): {result['count']} answers -> {result['output_file']}"
        )


if __name__ == "__main__":
    main()
