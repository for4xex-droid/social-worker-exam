import os
import requests
import time

TARGET_DIR = "source/kaigo_pdfs"
SESSIONS = [34, 33]


def download_file(url, folder):
    if not os.path.exists(folder):
        os.makedirs(folder, exist_ok=True)
    local_filename = os.path.join(folder, os.path.basename(url))
    if os.path.exists(local_filename):
        return
    try:
        r = requests.get(url, stream=True)
        if r.status_code == 200:
            print(f"Downloading {url}...")
            with open(local_filename, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            time.sleep(0.5)
    except Exception as e:
        print(f"Error {url}: {e}")


def main():
    print(f"Starting hidden Kaigo download for sessions {SESSIONS}...")
    for no in SESSIONS:
        save_dir = os.path.join(TARGET_DIR, f"no{no}")

        # Questions AM (01-08)
        for i in range(1, 9):
            url = f"https://www.sssc.or.jp/kaigo/past_exam/pdf/no{no}/k_am_{i:02d}_{no}.pdf"
            download_file(url, save_dir)

        # Questions PM (01-05)
        for i in range(1, 6):
            url = f"https://www.sssc.or.jp/kaigo/past_exam/pdf/no{no}/k_pm_{i:02d}_{no}.pdf"
            download_file(url, save_dir)

        # Answer Key
        url = f"https://www.sssc.or.jp/kaigo/past_exam/pdf/no{no}/k_kijun_seitou.pdf"
        download_file(url, save_dir)

    print("Hidden Kaigo download complete.")


if __name__ == "__main__":
    main()
