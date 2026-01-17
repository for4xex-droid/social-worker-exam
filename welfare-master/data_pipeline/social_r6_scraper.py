import requests
from bs4 import BeautifulSoup
import time
import json
import re

BASE_URL = "https://shakaifukushi.kakomonn.com"
LIST_URL = "https://shakaifukushi.kakomonn.com/list1/56011"


def get_question_links():
    links = []
    seen = set()
    for page in range(1, 4):  # Pages 1 to 3
        print(f"Fetching list page {page}...")
        try:
            r = requests.get(
                f"{LIST_URL}?page={page}", headers={"User-Agent": "Mozilla/5.0"}
            )
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")

            # Find all links to /questions/
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


def scrape_detail(url):
    try:
        r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")

        # 1. Question Text
        # Inspecting common patterns.
        # Often in a div with itemprop="name" or specific ID
        # Looking at previous grep, "itemprop='name'" was on the list item.
        # On detail page, maybe <h1> or <div class="question_sentence">

        # Try finding the stored 'question' text
        # Usually it's the first significant text block or strict class
        q_text = ""
        # Strategy: Look for class that looks like question
        candidate_q = (
            soup.find("div", class_="question_sentence")
            or soup.find("div", class_="question")
            or soup.find("p", class_="question")
        )
        if candidate_q:
            q_text = candidate_q.get_text()
        else:
            # Fallback: look for generic container
            # The h1 usually has title, Q text might be below
            pass

        # 2. Options
        options = []
        # Look for <ol> or <ul> with choices
        # Or inputs with type="radio" / "checkbox" labels

        # 3. Answer
        correct_answer = []
        # Look for answer block

        # Just to be safe for the first run, let's DUMP the classes used in the main area
        # so we can refine this script in the next step.
        main = soup.find("main")
        classes = set()
        if main:
            for tag in main.find_all(True):
                if tag.get("class"):
                    classes.update(tag.get("class"))

        return {
            "url": url,
            "classes_found": list(classes),
            "text_preview": main.get_text()[:200] if main else "",
        }

    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    links = get_question_links()
    print(f"Found {len(links)} unique question links.")

    if links:
        # Scrape ONE to analyze structure
        target = links[0]
        print(f"Analyzing structure of {target}...")
        data = scrape_detail(target)
        print(json.dumps(data, indent=2, ensure_ascii=False))
