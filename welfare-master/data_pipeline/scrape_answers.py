"""
Scrape correct answers from kakomonn.com question pages.
The answers are displayed when you view a question's detail page.
"""

import requests
from bs4 import BeautifulSoup
import json
import time
import re

# Headers for polite scraping
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}


def get_answer_from_question_page(url):
    """
    Scrape the correct answer from a single question page on kakomonn.com
    Returns the answer as a string (e.g., "2" or "1,3")
    """
    try:
        r = requests.get(url, headers=HEADERS, timeout=10)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")

        # Look for answer indicators
        # Pattern 1: Look for elements with "正解" or "正答"
        answer_text = None

        # Check for answer in page content
        for tag in soup.find_all(["div", "span", "p", "li"]):
            text = tag.get_text()
            # Look for patterns like "正解：2" or "正答 2" or "答え：1,3"
            match = re.search(
                r"(?:正解|正答|答え)[：:\s]*([1-5](?:\s*[,、]\s*[1-5])*)", text
            )
            if match:
                answer_text = match.group(1).replace("、", ",").replace(" ", "")
                break

        # Pattern 2: Look for highlighted/selected answer options
        if not answer_text:
            # Check for class names indicating correct answer
            correct_elements = soup.find_all(
                class_=re.compile(r"correct|right|answer|seikai")
            )
            for elem in correct_elements:
                text = elem.get_text()
                if text.strip() and len(text.strip()) <= 5:
                    answer_text = text.strip()
                    break

        return answer_text
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None


def scrape_answers_for_exam(exam_name, base_list_url, num_pages=3, expected_count=150):
    """
    Scrape all answers for an exam by first getting question links from list pages.
    """
    print(f"\n{'=' * 60}")
    print(f"Scraping answers for: {exam_name}")
    print(f"{'=' * 60}")

    # Step 1: Get all question links from list pages
    question_links = []
    for page in range(1, num_pages + 1):
        url = f"{base_list_url}?page={page}"
        print(f"Fetching list page {page}: {url}")
        try:
            r = requests.get(url, headers=HEADERS, timeout=10)
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")

            # Find question links
            links = soup.find_all("a", href=re.compile(r"/questions/\d+"))
            for link in links:
                href = link.get("href")
                if href:
                    full_url = (
                        f"https://shakaifukushi.kakomonn.com{href}"
                        if href.startswith("/")
                        else href
                    )
                    if full_url not in question_links:
                        question_links.append(full_url)

            time.sleep(0.5)
        except Exception as e:
            print(f"Error on page {page}: {e}")

    print(f"Found {len(question_links)} question links")

    # Step 2: Fetch answers for each question
    answers = {}
    for i, url in enumerate(question_links[:expected_count], 1):
        print(f"Fetching question {i}/{len(question_links)}: {url}")
        answer = get_answer_from_question_page(url)
        if answer:
            answers[str(i)] = answer
            print(f"  -> Answer: {answer}")
        else:
            print(f"  -> No answer found")
        time.sleep(0.3)  # Be polite

    return answers


def main():
    # Test with a single question first
    test_url = "https://shakaifukushi.kakomonn.com/questions/75132"
    print("Testing single question scrape...")
    print(f"URL: {test_url}")

    r = requests.get(test_url, headers=HEADERS, timeout=10)
    soup = BeautifulSoup(r.text, "html.parser")

    # Print all text content to examine structure
    print("\n--- Page Structure Analysis ---")

    # Find all elements that might contain answer info
    for class_name in ["answer", "correct", "seikai", "seitou", "result"]:
        elements = soup.find_all(class_=re.compile(class_name, re.I))
        if elements:
            print(f"\nElements with class containing '{class_name}':")
            for elem in elements[:3]:
                print(f"  {elem.name}: {elem.get_text()[:100]}")

    # Look for any text containing 正解/正答
    print("\n--- Text containing 正解/正答 ---")
    for tag in soup.find_all(string=re.compile(r"正[解答]")):
        parent = tag.parent
        if parent:
            print(f"  {parent.name}: {parent.get_text()[:150]}")


if __name__ == "__main__":
    main()
