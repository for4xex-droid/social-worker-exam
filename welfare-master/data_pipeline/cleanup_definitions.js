
const fs = require('fs');
const path = require('path');

const TARGET_FILE = path.join(__dirname, '../app/assets/flashcards.json');

function clean() {
    console.log(`Cleaning ${TARGET_FILE}...`);
    let cards = JSON.parse(fs.readFileSync(TARGET_FILE, 'utf8'));

    let modified = 0;

    for (const card of cards) {
        let def = card.definition;

        // Regex patterns to clean up
        // 1. "用語: ... Output: " or "出力: "
        def = def.replace(/^用語:.*?\n(出力:|Output:)?\s*/s, '');
        // 1.5 "修正文:" or "修正案:" pattern
        def = def.replace(/^(修正文|修正案|NG文|OK文|問題文|修正後の問題文)[:：]?\s*/, '');
        // 2. "【解説】" or "解説:" and others
        def = def.replace(/^(【[^】]+】|[^：]+[:：])\s*/g, (match) => {
            // Aggressively remove any bracketed header like 【回答】【用語】【解説】
            // or labeled header like "回答:" at the very start
            if (match.includes('解説') || match.includes('用語') || match.includes('回答') || match.includes('問題') || match.includes('修正')) {
                return '';
            }
            return match;
        });
        // 3. "【用語】..."
        def = def.replace(/^【?用語】?[:：]?.*?\n【?解説】?[:：]?\s*/s, '');

        // 4. Remove leading/trailing quotes if any
        def = def.replace(/^["「]/, '').replace(/["」]$/, '');

        if (def !== card.definition) {
            card.definition = def.trim();
            modified++;
        }
    }

    fs.writeFileSync(TARGET_FILE, JSON.stringify(cards, null, 2), 'utf8');
    console.log(`Cleaned ${modified} definitions.`);
}

clean();
