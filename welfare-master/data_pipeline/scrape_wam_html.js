
const fs = require('fs');
const path = require('path');

const HTML_FILE = path.join(__dirname, 'wam_dictionary.html');
const OUTPUT_FILE = path.join(__dirname, 'wam_raw.json');

function parse() {
    console.log("Reading HTML...");
    let html = fs.readFileSync(HTML_FILE, 'utf8');

    // Remove newlines to make regex easier
    html = html.replace(/\r?\n/g, '');

    // Regex to find wordListBox blocks
    // <div class="wordListBox"> ... <h4>Term</h4> ... <div class="meaningArea">Def</div> ... </div>
    // This is a naive regex, but sufficient for this specific clean HTML structure usually.

    // First, split by wordListBox to get chunks
    const chunks = html.split('class="wordListBox"');
    const results = [];

    // Skip the first chunk (before the first term)
    for (let i = 1; i < chunks.length; i++) {
        const chunk = chunks[i];

        // Extract Term from <h4>
        const termMatch = chunk.match(/<h4>(.*?)<\/h4>/);
        if (!termMatch) continue;
        let term = termMatch[1].replace(/<[^>]+>/g, '').trim(); // Remove tags inside H4 if any

        // Extract Definition from meaninArea
        const defMatch = chunk.match(/class="meaningArea">(.*?)<\/div>/);
        if (!defMatch) continue;
        let definition = defMatch[1].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();

        // Clean up term (remove reading if present? e.g. Term (Reading))
        // Usually we want just the Term for the card, or Term + Reading?
        // Let's keep distinct term and reading if possible?
        // The user wants "Term Cards".
        // "アスペルガー症候群（アスペルガーショウコウグン）" -> Term: アスペルガー症候群

        const parenMatch = term.match(/^(.+?)（(.+?)）$/);
        if (parenMatch) {
            term = parenMatch[1];
            // reading = parenMatch[2];
        }

        if (term && definition) {
            results.push({ term, definition });
        }
    }

    console.log(`Found ${results.length} terms.`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
    console.log(`Saved to ${OUTPUT_FILE}`);
}

parse();
