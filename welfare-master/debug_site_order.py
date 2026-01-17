import requests
from bs4 import BeautifulSoup
import re

URL_AM = "https://www.sssc.or.jp/shakai/past_exam/pdf/no37/listen_ss_am_37.html"
URL_PM = "https://www.sssc.or.jp/shakai/past_exam/pdf/no37/listen_ss_pm_37.html"
HEADERS = {"User-Agent": "Mozilla/5.0"}
LOG_PATH = "r6_debug.log"


def normalize_text(text):
    return re.sub(r"\s+", " ", text).strip()


def check(url, label):
    print(f"Checking {label} -> {LOG_PATH}")

    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(f"\n--- Checking {label} ---\n")
        try:
            res = requests.get(url, headers=HEADERS, timeout=10)
            res.encoding = res.apparent_encoding
            soup = BeautifulSoup(res.text, "html.parser")
            dts = soup.find_all("dt")

            last_num = 0
            count = 0
            for dt in dts:
                dt_text = normalize_text(dt.get_text())
                if not dt_text:
                    continue

                match = re.search(r"問題\s*(\d+)", dt_text)

                if match:
                    num = int(match.group(1))
                    if last_num > 0 and num < last_num:
                        f.write(f"  [ORDER REVERSAL] Found {num} after {last_num}\n")
                    elif last_num > 0 and num != last_num + 1:
                        f.write(
                            f"  [GAP] Found {num} after {last_num} (Gap: {num - last_num - 1})\n"
                        )

                    f.write(f"  Q{num}: {dt_text[:40]}...\n")
                    last_num = num
                    count += 1
                else:
                    f.write(f"  [NO MATCH] {dt_text}\n")

            f.write(f"Total questions found in {label}: {count}\n")

        except Exception as e:
            f.write(f"Error: {e}\n")


if __name__ == "__main__":
    # clear log
    with open(LOG_PATH, "w", encoding="utf-8") as f:
        f.write("Debug Log Start\n")

    check(URL_AM, "AM")
    check(URL_PM, "PM")
