import requests
from bs4 import BeautifulSoup
import time
import json
import re
import os


def clean_text(text):
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


def get_question_links(list_base_url, pages=3):
    links = []
    seen = set()
    for page in range(1, pages + 1):
        print(f"  Fetching list page {page}...")
        try:
            r = requests.get(
                f"{list_base_url}?page={page}", headers={"User-Agent": "Mozilla/5.0"}
            )
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")
            anchors = soup.find_all("a", href=True)
            for a in anchors:
                href = a["href"]
                if "/questions/" in href:
                    # Handle relative vs absolute
                    if href.startswith("/"):
                        # Get domain from list_base_url
                        domain = "/".join(list_base_url.split("/")[:3])
                        full_url = domain + href
                    else:
                        full_url = href

                    if full_url not in seen:
                        seen.add(full_url)
                        links.append(full_url)
            time.sleep(1)
        except Exception as e:
            print(f"  Error fetching list page {page}: {e}")
    return links


def scrape_detail(url, index, group_name, year_label):
    try:
        r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")

        # 1. Question Text
        q_div = soup.find("div", class_="detail_list")
        if not q_div:
            # Fallback for different layouts
            q_div = soup.find("div", class_="problem_sentence") or soup.find("main")

        q_text = clean_text(q_div.get_text()) if q_div else ""

        # 2. Options
        options = []
        uls = soup.find_all("ul", class_="list")
        correct_ul = None
        for ul in uls:
            lis = ul.find_all("li")
            if 3 <= len(lis) <= 5:
                ul_text = ul.get_text()
                if "Home" not in ul_text and "出題" not in ul_text:
                    correct_ul = ul
                    break

        if correct_ul:
            for li in correct_ul.find_all("li"):
                options.append(clean_text(li.get_text()))

        if q_text:
            return {
                "question_text": q_text,
                "options": options,
                "group": group_name,
                "year": year_label,
                "category_label": "社会福祉士"
                if "social" in group_name
                else "精神保健福祉士"
                if "mental" in group_name
                else "介護福祉士",
                "source_url": url,
                "questionNumber": index + 1,
            }
        return None
    except Exception as e:
        print(f"  Error scraping {url}: {e}")
        return None


def main():
    jobs = [
        # Social Worker
        {
            "group": "past_social",
            "year": "令和5年度",
            "url": "https://shakaifukushi.kakomonn.com/list1/56010",
            "pages": 3,
        },
        {
            "group": "past_social",
            "year": "令和4年度",
            "url": "https://shakaifukushi.kakomonn.com/list1/56009",
            "pages": 3,
        },
        {
            "group": "past_social",
            "year": "令和3年度",
            "url": "https://shakaifukushi.kakomonn.com/list1/56008",
            "pages": 3,
        },
        # Mental Health Worker
        {
            "group": "past_mental",
            "year": "令和6年度",
            "url": "https://seishinhoken.kakomonn.com/list1/12014",
            "pages": 3,
        },
    ]

    all_scraped = []

    for job in jobs:
        print(f"Working on {job['group']} {job['year']}...")
        links = get_question_links(job["url"], job["pages"])
        print(f" Found {len(links)} links.")

        for i, link in enumerate(links):
            print(f" [{i + 1}/{len(links)}] Scraping {link}...")
            data = scrape_detail(link, i, job["group"], job["year"])
            if data:
                all_scraped.append(data)
            time.sleep(0.5)

        # Save intermediate results
        with open("batch_scraped.json", "w", encoding="utf-8") as f:
            json.dump(all_scraped, f, ensure_ascii=False, indent=2)

    print(f"Total scraped: {len(all_scraped)}")


if __name__ == "__main__":
    main()
