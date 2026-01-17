const fs = require('fs');
const FILE = 'app/assets/master_database_v3.json';
const raw = fs.readFileSync(FILE, 'utf8');
console.log(`Contains '養成課程': ${raw.includes('養成課程')}`);

// Check hex dump of '養成課程' in file to ensure no encoding weirdness
if (raw.includes('養成課程')) {
    const idx = raw.indexOf('養成課程');
    const snippet = raw.substring(idx, idx + 10);
    console.log(`Snippet: ${snippet}`);
}
