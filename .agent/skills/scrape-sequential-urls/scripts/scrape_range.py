import argparse
import os
import time
import requests
import re
from urllib.parse import urlparse


def extract_id(url):
    """Extracts the last numeric part of a URL."""
    match = re.search(r"(\d+)(?:/)?$", url)
    if match:
        return int(match.group(1))
    return None


def get_base_url(url, id_val):
    """Reconstructs the base URL format/template from a URL and its ID."""
    # Replace the ID in the URL with a placeholder format
    return url.replace(str(id_val), "{}")


def scrape_range(start_url, end_url, output_dir, delay=1.0):
    start_id = extract_id(start_url)
    end_id = extract_id(end_url)

    if start_id is None or end_id is None:
        print("Error: Could not extract numeric IDs from the provided URLs.")
        return

    if start_id > end_id:
        print(f"Swapping start ({start_id}) and end ({end_id}) IDs.")
        start_id, end_id = end_id, start_id

    # Infer URL pattern
    url_template = get_base_url(start_url, start_id)

    print(f"Scraping from ID {start_id} to {end_id}")
    print(f"URL Template: {url_template.format('{id}')}")
    print(f"Output Directory: {output_dir}")

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    session = requests.Session()
    # Add a user agent to be polite/avoid immediate blocking
    session.headers.update(
        {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
    )

    success_count = 0
    error_count = 0

    for current_id in range(start_id, end_id + 1):
        target_url = url_template.format(current_id)
        output_file = os.path.join(output_dir, f"{current_id}.html")

        if os.path.exists(output_file):
            print(f"Skipping {current_id} (already exists)")
            continue

        try:
            print(f"Fetching {target_url} ...", end="", flush=True)
            response = session.get(target_url, timeout=10)

            if response.status_code == 200:
                with open(output_file, "w", encoding="utf-8") as f:
                    f.write(response.text)
                print(" OK")
                success_count += 1
            else:
                print(f" Failed (Status: {response.status_code})")
                error_count += 1

        except Exception as e:
            print(f" Error: {e}")
            error_count += 1

        time.sleep(delay)

    print("-" * 30)
    print(f"Completed. Success: {success_count}, Failed: {error_count}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape a range of sequential URLs.")
    parser.add_argument(
        "--start-url",
        required=True,
        help="The first URL in the sequence (e.g., .../questions/100)",
    )
    parser.add_argument(
        "--end-url",
        required=True,
        help="The last URL in the sequence (e.g., .../questions/200)",
    )
    parser.add_argument(
        "--output-dir", required=True, help="Directory to save the scraped HTML files"
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.0,
        help="Delay between requests in seconds (default: 1.0)",
    )

    args = parser.parse_args()

    scrape_range(args.start_url, args.end_url, args.output_dir, args.delay)
