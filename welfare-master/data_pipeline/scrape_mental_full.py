"""
精神保健福祉士国家試験 過去問スクレイピングスクリプト
公式サイトのHTML形式問題ページから問題を抽出
"""

import json
import re
import requests
from bs4 import BeautifulSoup
import sys

sys.stdout.reconfigure(encoding="utf-8")

# 対象年度とURL
EXAM_DATA = [
    {
        "year": "令和6年度",
        "exam_number": 27,
        "am_url": "https://www.sssc.or.jp/seishin/past_exam/pdf/no27/listen_se_am_27.html",
        "pm_url": "https://www.sssc.or.jp/seishin/past_exam/pdf/no27/listen_se_pm_27.html",
        "expected_total": 132,  # 84 + 48
    },
    {
        "year": "令和5年度",
        "exam_number": 26,
        "am_url": "https://www.sssc.or.jp/seishin/past_exam/pdf/no26/listen_sp_am_26.html",
        "pm_url": "https://www.sssc.or.jp/seishin/past_exam/pdf/no26/listen_sp_pm_26.html",
        "expected_total": 163,  # 83 + 80
    },
    {
        "year": "令和4年度",
        "exam_number": 25,
        "am_url": "https://www.sssc.or.jp/seishin/past_exam/pdf/no25/listen_sp_am_25.html",
        "pm_url": "https://www.sssc.or.jp/seishin/past_exam/pdf/no25/listen_sp_pm_25.html",
        "expected_total": 163,  # 83 + 80
    },
]


def fetch_html(url):
    """URLからHTMLを取得"""
    try:
        resp = requests.get(url, timeout=30)
        resp.encoding = "utf-8"
        return resp.text
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None


def parse_questions(html_content, session_type="am"):
    """
    HTMLから問題を抽出
    session_type: "am" (午前/共通) or "pm" (午後/専門)
    """
    if not html_content:
        return []

    soup = BeautifulSoup(html_content, "html.parser")
    text = soup.get_text()

    # 問題を正規表現で抽出
    # パターン: 問題N で始まり、次の問題N+1 または終端まで
    pattern = r"問題\s*(\d+)\s*([\s\S]*?)(?=問題\s*\d+|$)"
    matches = re.findall(pattern, text)

    questions = []
    for match in matches:
        q_num = int(match[0])
        q_body = match[1].strip()

        # 選択肢を抽出 (1, 2, 3, 4, 5 で始まる行)
        # パターン: 行頭の数字 + スペース + 選択肢テキスト
        option_pattern = r"^\s*([1-5])\s+(.+?)$"
        lines = q_body.split("\n")

        question_text = ""
        options = []
        in_options = False

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # 選択肢の検出
            opt_match = re.match(r"^([1-5])\s+(.+)$", line)
            if opt_match:
                in_options = True
                opt_num = int(opt_match.group(1))
                opt_text = opt_match.group(2).strip()
                options.append(opt_text)
            elif not in_options:
                # 問題文
                if question_text:
                    question_text += " "
                question_text += line

        # 正規化
        question_text = re.sub(r"\s+", " ", question_text).strip()

        if question_text and len(options) > 0:
            questions.append(
                {
                    "number": q_num,
                    "question_text": question_text,
                    "options": options,
                    "session": session_type,
                }
            )

    return questions


def scrape_all_exams():
    """全年度の問題をスクレイピング"""
    all_data = []

    for exam in EXAM_DATA:
        print(f"\n=== {exam['year']} (第{exam['exam_number']}回) ===")

        # 午前問題
        print(f"  Fetching AM: {exam['am_url']}")
        am_html = fetch_html(exam["am_url"])
        am_questions = parse_questions(am_html, "am")
        print(f"  AM Questions: {len(am_questions)}")

        # 午後問題
        print(f"  Fetching PM: {exam['pm_url']}")
        pm_html = fetch_html(exam["pm_url"])
        pm_questions = parse_questions(pm_html, "pm")
        print(f"  PM Questions: {len(pm_questions)}")

        # 統合
        year_questions = []

        # 午前（共通科目）
        for q in am_questions:
            year_questions.append(
                {
                    "id": f"mental_{exam['exam_number']}_{q['number']:03d}",
                    "year": exam["year"],
                    "exam_number": exam["exam_number"],
                    "number": q["number"],
                    "question_text": q["question_text"],
                    "options": q["options"],
                    "correct_answer": [],  # 後で解答PDFから補完
                    "group": "past_mental",
                    "group_id": "past_mental",
                    "categoryLabel": "共通科目",
                    "session": "am",
                }
            )

        # 午後（専門科目）- 番号オフセット
        am_max = max([q["number"] for q in am_questions]) if am_questions else 0
        for q in pm_questions:
            new_number = am_max + q["number"]  # 連番にする
            year_questions.append(
                {
                    "id": f"mental_{exam['exam_number']}_{new_number:03d}",
                    "year": exam["year"],
                    "exam_number": exam["exam_number"],
                    "number": new_number,
                    "question_text": q["question_text"],
                    "options": q["options"],
                    "correct_answer": [],
                    "group": "past_mental",
                    "group_id": "past_mental",
                    "categoryLabel": "専門科目",
                    "session": "pm",
                }
            )

        print(f"  Total: {len(year_questions)} (Expected: {exam['expected_total']})")
        all_data.extend(year_questions)

    return all_data


def main():
    print("Starting scrape...")
    questions = scrape_all_exams()

    # 保存
    output_file = "mental_questions_scraped_full.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)

    print(f"\nSaved {len(questions)} questions to {output_file}")

    # サマリ
    summary = {}
    for q in questions:
        y = q["year"]
        summary[y] = summary.get(y, 0) + 1
    print("\nSummary:")
    for y, c in sorted(summary.items()):
        print(f"  {y}: {c}問")


if __name__ == "__main__":
    main()
