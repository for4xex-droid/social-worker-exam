import requests
from bs4 import BeautifulSoup
import json
import re

URL = "https://www.sssc.or.jp/shakai/past_exam/pdf/no37/listen_ss_am_37.html"


def normalize_text(text):
    return re.sub(r"\s+", " ", text).strip()


def extract():
    print(f"Fetching {URL}...")
    res = requests.get(URL)
    res.encoding = res.apparent_encoding
    soup = BeautifulSoup(res.text, "html.parser")

    questions = []

    # Strategy: Find <dl> lists. Usually one <dl> contains one or more questions?
    # Or maybe the whole page is one big <dl>?

    # Find all <dt>
    dts = soup.find_all("dt")
    print(f"Found {len(dts)} <dt> elements.")

    current_q = None

    for dt in dts:
        dt_text = normalize_text(dt.get_text())

        # Check if this is a Question header
        # Pattern: "問題１", "問題 1", "問題10"
        match = re.match(r"問題\s*(\d+)", dt_text)
        if match:
            # Save previous question
            if current_q:
                questions.append(current_q)

            q_num = match.group(1)
            # Remove "問題X" from text if needed, or keep it
            # The text usually includes the instruction like "Choose the most appropriate one."

            current_q = {"number": q_num, "text": dt_text, "options": []}

            # Find following DDs
            # siblings
            curr = dt.find_next_sibling()
            while curr and curr.name == "dd":
                opt_text = normalize_text(curr.get_text())
                current_q["options"].append(opt_text)
                curr = curr.find_next_sibling()
        else:
            print(f"Ignored DT: {dt_text[:30]}...")

    # Last one
    if current_q:
        questions.append(current_q)

    with open("inspect_result.json", "w", encoding="utf-8") as f:
        json.dump(questions, f, indent=2, ensure_ascii=False)

    print(f"Extracted {len(questions)} questions.")
    if len(questions) > 0:
        print(f"First: {questions[0]['text'][:30]}...")
        print(f"Last: {questions[-1]['text'][:30]}...")


if __name__ == "__main__":
    extract()
