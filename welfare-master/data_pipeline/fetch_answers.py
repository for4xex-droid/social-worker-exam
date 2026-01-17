import requests
import io
from pypdf import PdfReader
import sys

# Windows console encoding fix
sys.stdout.reconfigure(encoding="utf-8")

URL = "https://www.sssc.or.jp/shakai/past_exam/pdf/no37/s_kijun_seitou.pdf"

print(f"Fetching PDF: {URL}")
# Use a browser-like user agent to avoid 403
headers = {"User-Agent": "Mozilla/5.0"}
res = requests.get(URL, headers=headers)
print(f"Status Code: {res.status_code}")

if res.status_code == 200:
    f = io.BytesIO(res.content)
    try:
        reader = PdfReader(f)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"

        print("--- Extracted Text Preview ---")
        print(text[:1000])
    except Exception as e:
        print(f"PDF Error: {e}")
else:
    print("Failed to download PDF")
