import os
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

URL = "https://www.sssc.or.jp/kaigo/past_exam/index.html"
TARGET_DIR = "source/kaigo_pdfs"
TARGET_SESSIONS = ["no37", "no36", "no35", "no34", "no33"]


def download_file(url, folder):
    if not os.path.exists(folder):
        os.makedirs(folder, exist_ok=True)
    local_filename = os.path.join(folder, os.path.basename(urlparse(url).path))
    print(f"Downloading {url} to {local_filename}...")
    try:
        with requests.get(url, stream=True) as r:
            r.raise_for_status()
            with open(local_filename, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
        print("Done.")
    except Exception as e:
        print(f"Failed to download {url}: {e}")


def main():
    print(f"Fetching {URL}...")
    try:
        r = requests.get(URL)
        r.raise_for_status()
        r.encoding = r.apparent_encoding
    except Exception as e:
        print(f"Failed: {e}")
        return

    soup = BeautifulSoup(r.text, "html.parser")
    links = soup.find_all("a", href=True)

    count = 0
    for link in links:
        href = link["href"]
        full_url = urljoin(URL, href)

        # Target PDF files in past_exam/pdf
        if ".pdf" in full_url and "/past_exam/pdf/" in full_url:
            # Session ID (no36, no35 etc)
            parts = full_url.split("/")
            session_id = "misc"
            for part in parts:
                if part.startswith("no"):
                    session_id = part
                    break

            if session_id not in TARGET_SESSIONS:
                continue

            # Download if it's a question file (usually prefixed with 'k_' or contains 'am'/'pm')
            filename = os.path.basename(full_url)
            # Questions: k_am_xx, k_pm_xx, etc.
            # Answer keys: k_kijun_seitou, etc. (we might need these too)
            if "kijun_seitou" in filename or filename.startswith("k_"):
                save_dir = os.path.join(TARGET_DIR, session_id)
                download_file(full_url, save_dir)
                count += 1

    print(f"Total Kaigo files downloaded: {count}")


if __name__ == "__main__":
    main()
