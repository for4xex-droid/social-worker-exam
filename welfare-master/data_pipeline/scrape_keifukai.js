
const fs = require('fs');
const path = require('path');
const https = require('https');

const URL = "https://www.keifukai.jp/jyouhou/";
const OUTPUT_FILE = path.join(__dirname, 'keifukai_raw.json');

async function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
            res.on('error', (e) => reject(e));
        });
    });
}

async function scrapeKeifukai() {
    console.log(`Fetching ${URL}...`);
    try {
        const html = await fetchUrl(URL);

        // Remove newlines for easier regex
        const flatHtml = html.replace(/\r?\n/g, '');

        // Pattern: <dt>Term：Reading</dt><dd>Definition</dd>
        // Note: The colon might be full-width '：' or half-width ':'
        // Also attributes might exist.

        // Strategy: Find all <dt>...(.*?)...</dt> and then the immediate next <dd>...(.*?)</dd>
        // Since regex across tags can be tricky with nesting, we'll try a relatively robust regex for this simple structure.
        // Assuming structure is flat <dl><dt>...</dt><dd>...</dd> ... </dl>

        const regex = /<dt.*?>(.*?)<\/dt>\s*<dd.*?>(.*?)<\/dd>/gi;

        const results = [];
        let match;

        while ((match = regex.exec(flatHtml)) !== null) {
            let dtContent = match[1].replace(/<[^>]+>/g, '').trim();
            let ddContent = match[2].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();

            // Extract term from "Term：Reading"
            // Split by '：' (full width) or ':' (half width)
            let term = dtContent;
            let parts = dtContent.split(/：|:/);
            if (parts.length > 1) {
                term = parts[0].trim();
            }

            // Remove any leading/trailing weird chars
            term = term.replace(/^・/, '').trim();

            if (term && ddContent) {
                results.push({
                    term: term,
                    original_definition: ddContent,
                    source_url: URL
                });
            }
        }

        console.log(`Extracted ${results.length} terms.`);
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
        console.log(`Saved to ${OUTPUT_FILE}`);

    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

scrapeKeifukai();
