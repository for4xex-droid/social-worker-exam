---
name: scrape-sequential-urls
description: Scrape a range of URLs with sequential numeric IDs (e.g., questions/100 to questions/200).
---

# Scrape Sequential URLs

This skill provides a generic tool to scrape content from a website where the pages are accessed via sequential numeric IDs in the URL.

## Usage

1.  **Identify the Range**: Determine the first and last URL you want to scrape.
    *   Start: `https://example.com/items/100`
    *   End: `https://example.com/items/200`

2.  **Run the Script**:
    Use the `run_command` tool to execute the python script located in `scripts/scrape_range.py`.

    ```powershell
    python .agent/skills/scrape-sequential-urls/scripts/scrape_range.py --start-url "https://example.com/items/100" --end-url "https://example.com/items/200" --output-dir "data/scraped_items" --delay 1.5
    ```

    **Arguments:**
    *   `--start-url`: The full URL of the starting page.
    *   `--end-url`: The full URL of the ending page.
    *   `--output-dir`: The local directory where HTML files will be saved.
    *   `--delay`: (Optional) Seconds to wait between requests to avoid being blocked (default: 1.0).

## Example (Social Worker Exam Past Questions)

To scrape the range `63481` to `63630` for the specific request:

```powershell
python .agent/skills/scrape-sequential-urls/scripts/scrape_range.py --start-url "https://shakaifukushi.kakomonn.com/questions/63481" --end-url "https://shakaifukushi.kakomonn.com/questions/63630" --output-dir "data/kakomonn_raw"
```

## Output

The script will save each page as an HTML file in the specified output directory, named by its ID (e.g., `63481.html`, `63482.html`).

## Post-Processing

After scraping, you will likely need to parse the HTML files to extract specific data (question text, answers, etc.). You can write a separate script using `BeautifulSoup` to process the saved HTML files in the output directory.
