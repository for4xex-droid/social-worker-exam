
const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = "https://www.kaigo-web.info/sp/jiten/";
const OUTPUT_FILE = path.join(__dirname, 'kaigo_raw.json');

// Pages: index.html (A), index2.html (Ka) ... index10.html (Wa)
// Note: Page 1 is index.html. Pages 2-10 are index{N}.html
// There are 10 pages total for standard syllabary.

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

async function scrapeAll() {
    console.log("Starting scrape of Kaigo Jiten...");
    const results = [];

    for (let i = 1; i <= 10; i++) {
        const pageName = i === 1 ? 'index.html' : `index${i}.html`;
        const url = BASE_URL + pageName;

        console.log(`Fetching ${url}...`);

        try {
            const html = await fetchUrl(url);

            // Naive Regex extraction for <th>Term</th><td>Def</td>
            // Structure: <tr><th>Term</th><td>Def</td></tr>
            // Be careful of newlines and attributes

            // Remove newlines for easier regex
            const flatHtml = html.replace(/\r?\n/g, '');

            // Regex: <tr>.*?<th>(.*?)<\/th>.*?<td>(.*?)<\/td>.*?<\/tr>
            // Note: Some pages might have attributes in tr/th/td
            const regex = /<tr>.*?<th>(.*?)<\/th>.*?<td>(.*?)<\/td>.*?<\/tr>/g;

            let match;
            let pageCount = 0;
            while ((match = regex.exec(flatHtml)) !== null) {
                let term = match[1].replace(/<[^>]+>/g, '').trim();
                let def = match[2].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();

                // Skip empty or header rows if any
                if (!term || !def) continue;

                results.push({
                    term: term,
                    original_definition: def,
                    source_url: url
                });
                pageCount++;
            }
            console.log(`  Found ${pageCount} terms.`);

        } catch (e) {
            console.error(`  Error fetching ${url}: ${e.message}`);
        }

        // Wait a bit
        await new Promise(r => setTimeout(r, 500));
    }

    console.log(`Total Extracted: ${results.length} terms.`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
    console.log(`Saved to ${OUTPUT_FILE}`);
}

scrapeAll();
