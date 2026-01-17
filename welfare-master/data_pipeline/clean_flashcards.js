
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../app/assets/flashcards.json');

function normalize(str) {
    if (!str) return "";
    // NFKC normalization (Full width to half width)
    let s = str.normalize('NFKC');
    // Remove content in parens for comparison purposes
    // e.g. "OT (Occupational Therapist)" -> "OT"
    // e.g. "ADL[Activity...]" -> "ADL"
    s = s.replace(/[\(（\[].*?[\)）\]]/g, '');
    // Remove punctuation/spaces
    s = s.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '');
    return s.toLowerCase();
}

function run() {
    console.log(`Loading ${FILE}...`);
    let cards = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    console.log(`Initial count: ${cards.length}`);

    const seen = new Map();
    const uniqueCards = [];
    const duplicates = [];

    // Priority: WAM > Kaigo > Keifukai (based on insertion order usually, assuming wam was first)
    // Actually, maybe we want to keep the one with the best definition?
    // For now, let's just keep the *first* one found, as WAM is usually high quality specialized terms.

    for (const card of cards) {
        const key = normalize(card.term);

        if (!key) {
            uniqueCards.push(card); // keep if we can't normalize (safety)
            continue;
        }

        if (seen.has(key)) {
            const existing = seen.get(key);
            // console.log(`Duplicate detected:\n  Keep: ${existing.term} (${existing.id})\n  Drop: ${card.term} (${card.id})`);
            duplicates.push({ kept: existing.term, dropped: card.term, id_dropped: card.id });
        } else {
            seen.set(key, card);
            uniqueCards.push(card);
        }
    }

    console.log(`Removed ${duplicates.length} duplicates.`);
    if (duplicates.length > 0) {
        console.log("Sample removed:");
        duplicates.slice(0, 10).forEach(d => console.log(` - Dropped "${d.dropped}" (similar to "${d.kept}")`));
    }

    // Save back
    fs.writeFileSync(FILE, JSON.stringify(uniqueCards, null, 2));
    console.log(`Saved clean list with ${uniqueCards.length} cards.`);
}

run();
