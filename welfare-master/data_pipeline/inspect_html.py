import requests
from bs4 import BeautifulSoup
import sys

URL = "https://www.sssc.or.jp/shakai/past_exam/pdf/no37/listen_ss_am_37.html"

try:
    print(f"Fetching {URL}...")
    res = requests.get(URL)
    res.encoding = res.apparent_encoding  # Detect encoding (Shift_JIS usually?)

    soup = BeautifulSoup(res.text, "html.parser")

    # Try to find Question 1
    # Usually text contains "問題1" or "問題１"
    # Or look for specific headers.

    print("\n--- Page Title ---")
    print(soup.title.string if soup.title else "No Title")

    print("\n--- Searching for '問題１' or '問題1' ---")
    # Find element containing specific text
    target = soup.find(lambda tag: tag.name and "問題１" in tag.text)

    if not target:
        target = soup.find(lambda tag: tag.name and "問題1" in tag.text)

    if target:
        print(f"Found tag: {target.name}")
        print(f"Parent: {target.parent.name}")
        # Print surrounding HTML structure
        parent = target.parent
        print(parent.prettify()[:1000])  # First 1000 chars
    else:
        print("Target '問題1' not found. Dumping first 1000 chars of body:")
        print(soup.body.prettify()[:1000] if soup.body else "No body")

except Exception as e:
    print(f"Error: {e}")
