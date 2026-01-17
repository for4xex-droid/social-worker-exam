
const fs = require('fs');
const path = require('path');

const URL = "https://www.wam.go.jp/content/wamnet/pcpub/syogai/handbook/dictionary/";

async function fetchAndParse() {
    console.log(`Fetching ${URL}...`);
    try {
        const response = await fetch(URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const buffer = await response.arrayBuffer();

        // Try decoding as Shift_JIS (common for Japanese gov sites)
        const decoder = new TextDecoder('shift-jis');
        let html = decoder.decode(buffer);

        // Double check simple heuristic: if it contains "" (replacement char) too much, might be utf-8?
        // But let's assume Shift-JIS first as evident from previous garbled output.

        console.log(`Downloaded ${html.length} chars.`);

        // Flatten
        const htmlFlat = html.replace(/\r?\n/g, '');

        // Regex
        // <div class="wordListBox"> ... <h4>Term</h4> ... <div class="meaningArea">Def</div>
        const regex = /<div class="wordListBox">.*?<h4>(.*?)<\/h4>.*?<div class="meaningArea">(.*?)<\/div>/g;

        const results = [];
        let match;

        while ((match = regex.exec(htmlFlat)) !== null) {
            let termRaw = match[1];
            let defRaw = match[2];

            // Clean
            let term = termRaw.replace(/<[^>]+>/g, '').trim();
            let definition = defRaw.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();

            let baseTerm = term;
            const parenMatch = term.match(/^(.+?)（.+?）$/);
            if (parenMatch) {
                baseTerm = parenMatch[1];
            }

            if (baseTerm && definition) {
                results.push({
                    term: baseTerm,
                    full_term: term,
                    original_definition: definition
                });
            }
        }

        console.log(`Extracted ${results.length} terms.`);

        fs.writeFileSync(path.join(__dirname, 'wam_raw.json'), JSON.stringify(results, null, 2));
        console.log("Saved to wam_raw.json");

    } catch (e) {
        console.error("Error:", e);
    }
}

fetchAndParse();
