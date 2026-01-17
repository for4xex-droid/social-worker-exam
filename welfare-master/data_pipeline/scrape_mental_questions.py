import requests
from bs4 import BeautifulSoup
import json
import re
import sys
import os
import time

sys.stdout.reconfigure(encoding="utf-8")

ANSWER_FILE = "mental_answers_scraped.json"
OUTPUT_FILE = "mental_questions_merged.json"

TARGETS = [
    {
        "year": "27",
        "time": "am",
        "url": "https://www.sssc.or.jp/seishin/past_exam/pdf/no27/listen_se_am_27.html",
    },
    {
        "year": "27",
        "time": "pm",
        "url": "https://www.sssc.or.jp/seishin/past_exam/pdf/no27/listen_se_pm_27.html",
    },
    {
        "year": "26",
        "time": "am",
        "url": "https://www.sssc.or.jp/seishin/past_exam/pdf/no26/listen_sp_am_26.html",
    },
    {
        "year": "26",
        "time": "pm",
        "url": "https://www.sssc.or.jp/seishin/past_exam/pdf/no26/listen_sp_pm_26.html",
    },
    {
        "year": "25",
        "time": "am",
        "url": "https://www.sssc.or.jp/seishin/past_exam/pdf/no25/listen_sp_am_25.html",
    },
    {
        "year": "25",
        "time": "pm",
        "url": "https://www.sssc.or.jp/seishin/past_exam/pdf/no25/listen_sp_pm_25.html",
    },
]


def clean_text(t):
    # Normalize unicode spaces
    t = t.replace("\u3000", " ").replace("&nbsp;", " ")
    return re.sub(r"\s+", " ", t).strip()


def scrape_page(target, answers):
    print(f"Scraping {target['year']} {target['time']} ({target['url']})...")
    try:
        res = requests.get(target["url"])
        res.encoding = res.apparent_encoding
        soup = BeautifulSoup(res.text, "html.parser")
    except Exception as e:
        print(f"Failed to fetch: {e}")
        return []

    questions = []

    current_q = None
    subject = "専門科目"  # Default

    # Iterate all tags looking for headers and Definitions
    tags = soup.find_all(["h2", "dt", "dd"])

    for tag in tags:
        text = clean_text(tag.get_text())
        if not text:
            continue

        if tag.name == "h2":
            subject = text

        elif tag.name == "dt":
            # "問題１"
            # Note: Sometimes it's "問題1" or "問題１"
            # Regex match
            match = re.search(r"問題\s*(\d+)", text)
            if match:
                if current_q:
                    questions.append(current_q)

                q_num = int(match.group(1))

                # Answer Key
                # answers keys are like "27-1"
                # Sometimes raw answer from gemini might be integer or list
                ans_key = f"{target['year']}-{q_num}"
                raw_ans = answers.get(ans_key, [])

                # Normalize answer to list of integers
                correct_answer = []
                if isinstance(raw_ans, int):
                    correct_answer = [raw_ans]
                elif isinstance(raw_ans, list):
                    correct_answer = raw_ans
                elif isinstance(raw_ans, str):
                    if raw_ans.isdigit():
                        correct_answer = [int(raw_ans)]

                current_q = {
                    "year": target["year"],
                    "number": q_num,
                    "subject": subject,
                    "question_text": "",
                    "options": [],
                    "correct_answer": correct_answer,
                    "group_id": "past_mental",
                    "note": target["time"],
                }

        elif tag.name == "dd":
            if not current_q:
                continue

            # Identify option vs body
            # Options start with "1 ", "2 ", etc.
            opt_match = re.match(r"^([1-5])[\s\u3000](.+)", text)
            if opt_match:
                current_q["options"].append(text)
            else:
                current_q["question_text"] += text + "\n"

    if current_q:
        questions.append(current_q)
    print(f" Found {len(questions)} qs.")
    return questions


def main():
    if os.path.exists(ANSWER_FILE):
        with open(ANSWER_FILE, "r", encoding="utf-8") as f:
            answers = json.load(f)
        print(f"Loaded {len(answers)} answers.")
    else:
        print("Warning: Answers file NOT found. Proceeding without answers.")
        answers = {}

    all_qs = []
    for t in TARGETS:
        qs = scrape_page(t, answers)
        all_qs.extend(qs)
        time.sleep(1)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_qs, f, indent=2, ensure_ascii=False)
    print(f"Merged Total: {len(all_qs)} questions -> {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
