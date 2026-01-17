import urllib.request
import json
import re

URL = "https://www.wam.go.jp/content/wamnet/pcpub/syogai/handbook/dictionary/"


def fetch_and_parse():
    print(f"Fetching {URL}...")
    try:
        req = urllib.request.Request(
            URL,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            },
        )
        with urllib.request.urlopen(req) as response:
            raw_data = response.read()

        # Try decoding with Shift_JIS or UTF-8
        try:
            html = raw_data.decode("utf-8")
        except UnicodeDecodeError:
            try:
                html = raw_data.decode("shift_jis")
            except UnicodeDecodeError:
                html = raw_data.decode("cp932", errors="ignore")

        print(f"Downloaded {len(html)} chars.")

        # Remove newlines for easier regex
        html_flat = html.replace("\n", "").replace("\r", "")

        # Regex to find dictionary entries
        # Structure: <div class="wordListBox"> ... <h4>Term</h4> ... <div class="meaningArea">Def</div>

        pattern = re.compile(
            r'<div class="wordListBox">.*?<h4>(.*?)</h4>.*?<div class="meaningArea">(.*?)</div>',
            re.DOTALL,
        )

        matches = pattern.findall(html_flat)
        matches = matches[
            1:
        ]  # Skip template/header if matched incorrectly? No, findall matches all.

        results = []
        for term_raw, def_raw in matches:
            # Clean Term
            term = re.sub(r"<[^>]+>", "", term_raw).strip()
            # Clean Definition
            definition = re.sub(r"<br\s*/?>", " ", def_raw, flags=re.IGNORECASE)
            definition = re.sub(r"<[^>]+>", "", definition).strip()

            # Remove reading from term if present e.g. "Term (Reading)"
            # Keep only the Term part for the card "Front" (or usage)
            # Actually, Flashcard: Front=Def, Back=Term.
            # We want Back=Term without reading, maybe?
            # "アスペルガー症候群（アスペルガーショウコウグン）"
            # It's better to keep reading in the term if it's there? Or split it?
            # Let's clean it for the Answer to be short.
            base_term = term
            m = re.match(r"^(.+?)（.+?）$", term)
            if m:
                base_term = m.group(1)

            if base_term and definition:
                results.append(
                    {"term": base_term, "full_term": term, "definition": definition}
                )

        print(f"Extracted {len(results)} terms.")

        with open("wam_raw.json", "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    fetch_and_parse()
