import requests
from bs4 import BeautifulSoup
from pypdf import PdfReader
import io
import json
import re
import time
import sys

# Constants
YEAR_CONFIGS = [
    {
        "year": "令和6年度",
        "exam_num": "37",
        "am_url": "https://www.sssc.or.jp/shakai/past_exam/pdf/no37/listen_ss_am_37.html",
        "pm_url": "https://www.sssc.or.jp/shakai/past_exam/pdf/no37/listen_ss_pm_37.html",
        "ans_url": "https://www.sssc.or.jp/shakai/past_exam/pdf/no37/s_kijun_seitou.pdf",
    },
    {
        "year": "令和5年度",
        "exam_num": "36",
        "am_url": "https://www.sssc.or.jp/shakai/past_exam/pdf/no36/listen_sp_am_36.html",
        "pm_url": "https://www.sssc.or.jp/shakai/past_exam/pdf/no36/listen_sp_pm_36.html",
        "ans_url": "https://www.sssc.or.jp/shakai/past_exam/pdf/no36/s_kijun_seitou.pdf",
    },
    {
        "year": "令和4年度",
        "exam_num": "35",
        "am_url": "https://www.sssc.or.jp/shakai/past_exam/pdf/no35/listen_sp_am_35.html",
        "pm_url": "https://www.sssc.or.jp/shakai/past_exam/pdf/no35/listen_sp_pm_35.html",
        "ans_url": "https://www.sssc.or.jp/shakai/past_exam/pdf/no35/s_kijun_seitou.pdf",
    },
]

HEADERS = {"User-Agent": "Mozilla/5.0"}


def normalize_text(text):
    return re.sub(r"\s+", " ", text).strip()


def fetch_html_questions(url):
    print(f"  Fetching HTML: {url}...")
    try:
        res = requests.get(url, headers=HEADERS, timeout=10)
        res.encoding = res.apparent_encoding
        soup = BeautifulSoup(res.text, "html.parser")

        questions = []
        dts = soup.find_all("dt")

        for dt in dts:
            dt_text = normalize_text(dt.get_text())
            match = re.search(r"問題\s*(\d+)", dt_text)
            if match:
                q_num = int(match.group(1))
                options = []

                # Find options (dd siblings)
                curr = dt.find_next_sibling()
                while curr and curr.name == "dd":
                    opt_text = normalize_text(curr.get_text())
                    options.append(opt_text)
                    curr = curr.find_next_sibling()

                questions.append({"number": q_num, "text": dt_text, "options": options})
        return questions
    except Exception as e:
        print(f"  Error fetching HTML: {e}")
        return []


def fetch_pdf_answers(url):
    print(f"  Fetching Answer PDF: {url}...")
    answers = {}
    try:
        res = requests.get(url, headers=HEADERS, timeout=10)
        f = io.BytesIO(res.content)
        reader = PdfReader(f)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"

        # Simple extraction strategy:
        # Find "問題番号 1 2 3..." line
        # Find "正 答 4 1 2..." line
        # But split by whitespace

        lines = text.split("\n")

        # Buffer for question numbers
        q_buffer = []

        for line in lines:
            normalized = normalize_text(line)
            if "問題番号" in normalized:
                # Extract numbers
                # Remove "問題番号" prefix
                parts = normalized.replace("問題番号", "").strip().split()
                # filter numeric
                nums = [p for p in parts if re.match(r"^\d+$", p)]
                q_buffer = nums

            elif (
                "正 答" in normalized or "正答" in normalized
            ):  # Some PDFs might omit space
                if not q_buffer:
                    continue
                # Extract answers
                # Answers can be "1" or "1,2"
                parts = (
                    normalized.replace("正 答", "").replace("正答", "").strip().split()
                )
                # We assume the count matches q_buffer
                # But sometimes header text gets mixed in.
                # Heuristic: Take first N parts where N = len(q_buffer)

                # Filter parts that look like answers (digits or digit,digit)
                ans_parts = [p for p in parts if re.match(r"^\d+(,\d+)?$", p)]

                if len(ans_parts) >= len(q_buffer):
                    for i, q_num in enumerate(q_buffer):
                        answers[int(q_num)] = ans_parts[i]
                else:
                    print(
                        f"    Warning: Mismatch Q:{len(q_buffer)} A:{len(ans_parts)} in line: {normalized}"
                    )

                q_buffer = []  # Reset

        return answers

    except Exception as e:
        print(f"  Error fetching PDF: {e}")
        return {}


def main():
    final_data = []

    for config in YEAR_CONFIGS:
        print(f"Processing {config['year']} (Exam {config['exam_num']})...")

        # 1. Fetch Questions
        am_qs = fetch_html_questions(config["am_url"])
        pm_qs = fetch_html_questions(config["pm_url"])
        all_qs = am_qs + pm_qs
        print(f"  Found {len(am_qs)} AM + {len(pm_qs)} PM = {len(all_qs)} questions.")

        if len(all_qs) == 0:
            print("  Skipping due to no questions.")
            continue

        # 2. Fetch Answers
        ans_map = fetch_pdf_answers(config["ans_url"])
        print(f"  Found {len(ans_map)} answers.")

        # 3. Merge and Format
        exam_id_base = f"ss{config['exam_num']}"

        count = 0
        for q in all_qs:
            q_num = q["number"]

            # Format ID: ss37_001
            q_id = f"{exam_id_base}_{q_num:03d}"

            # Find Answer
            correct = ans_map.get(q_num, "0")  # Default 0 if missing

            # Clean text
            # Remove "問題1" prefix from text? Keep it for context?
            # User usually wants clean text.
            clean_text = re.sub(r"^問題\s*\d+\s*", "", q["text"]).strip()

            # Determine Group/Source
            # group_id: past_social_{exam_num}
            group_id = f"past_social_{config['exam_num']}"

            # Category?
            # We don't have category per question from HTML (It has headers but scraping them linked to questions is complex)
            # Default to "過去問" or "未分類"
            # However, we can guess common vs spec based on Question Number.
            # Social Worker:
            #  Common: 1-83
            #  Spec: 84-150
            # BUT this varies by year.
            # Assuming standard breakdown.
            is_common = q_num <= 83
            cat_label = "共通科目" if is_common else "専門科目"

            item = {
                "id": q_id,
                "question_text": clean_text,
                "explanation": "解説は準備中です。",  # Placeholder
                "options": q["options"],
                "correct_answer": str(correct),
                "group_id": group_id,
                "year": config["year"],
                "category_label": cat_label,
                "is_free": is_common,  # Common is free usually
                "source_tag": "official_scrape_20260117",
            }
            final_data.append(item)
            count += 1

        print(f"  Merged {count} items for {config['year']}.")

    # Save Final
    out_path = "app/assets/past_social_complete.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(final_data, f, indent=4, ensure_ascii=False)

    print(f"\nSaved total {len(final_data)} questions to {out_path}.")


if __name__ == "__main__":
    main()
