import requests
from bs4 import BeautifulSoup
import time
import json
import re
import os

BASE_URL = "https://shakaifukushi.kakomonn.com"
LIST_URL = "https://shakaifukushi.kakomonn.com/list1/56011"
OUTPUT_FILE = "social_r6.json"


def get_question_links():
    links = []
    seen = set()
    for page in range(1, 4):
        print(f"Fetching list page {page}...")
        try:
            r = requests.get(
                f"{LIST_URL}?page={page}", headers={"User-Agent": "Mozilla/5.0"}
            )
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")
            anchors = soup.find_all("a", href=True)
            for a in anchors:
                href = a["href"]
                if "/questions/" in href:
                    full_url = href if href.startswith("http") else BASE_URL + href
                    if full_url not in seen:
                        seen.add(full_url)
                        links.append(full_url)
            time.sleep(1)
        except Exception as e:
            print(f"Error fetching list page {page}: {e}")
    return links


def clean_text(text):
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


def scrape_detail(url, index):
    try:
        r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")

        # 1. Question Text
        # Found in div.detail_list
        q_div = soup.find("div", class_="detail_list")
        q_text = clean_text(q_div.get_text()) if q_div else ""

        # 2. Options
        # Found in ul.list inside div.problem_detail usually
        # We will look for all ul.list and pick the one with ~5 LI items
        options = []
        uls = soup.find_all("ul", class_="list")
        correct_ul = None
        for ul in uls:
            lis = ul.find_all("li")
            if 3 <= len(lis) <= 5:  # Valid option count
                # Verify content isn't menu (check for links?)
                # Options might have links or text
                # Check for "Home" in text which implies menu
                ul_text = ul.get_text()
                if "Home" not in ul_text and "出題" not in ul_text:
                    correct_ul = ul
                    break

        if correct_ul:
            for li in correct_ul.find_all("li"):
                options.append(clean_text(li.get_text()))

        # 3. Answer
        # Not easily scrapable via requests.
        correct_answ = []

        # 4. Explanation
        explanation = ""
        # Not easily scrapable or inside hidden areas

        if q_text:
            return {
                "id": f"R6_{index + 1}",
                "questionText": q_text,
                "options": options,
                "correctAnswer": correct_answ,
                "explanation": explanation,
                "group": "past_social",
                "year": "令和6年度",
                "category_label": "社会福祉士",
                "source_url": url,
            }
        return None

    except Exception as e:
        print(f"Error scraping {url}: {e}")
        return None


if __name__ == "__main__":
    links = get_question_links()
    print(f"Found {len(links)} links.")

    results = []
    for i, link in enumerate(links):
        print(f"[{i + 1}/{len(links)}] Scraping {link}...")
        data = scrape_detail(link, i)
        if data:
            results.append(data)
        time.sleep(0.5)

        if (i + 1) % 10 == 0:
            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                json.dump(results, f, ensure_ascii=False, indent=2)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(results)} items to {OUTPUT_FILE}")
