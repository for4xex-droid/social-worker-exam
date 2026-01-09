import requests
from bs4 import BeautifulSoup

URL = "https://shakaifukushi.kakomonn.com/list1/56011"  # Trying R5/36th as test (or finding 37th)

try:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    r = requests.get(URL, headers=headers)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    # Check title
    print("Page Title:", soup.title.string)

    # Check for questions
    questions = soup.find_all("tr")  # Assuming table or similar structure
    print(f"Found {len(questions)} row elements.")

    # Dump just a bit of text to see content
    print(soup.get_text()[:500])

except Exception as e:
    print(f"Error: {e}")
