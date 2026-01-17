const fs = require('fs');
const path = require('path');

const DB_PATH = "app/assets/social_spec_part7.json";
const NG_KEYWORDS = ['カリキュラム', 'テキスト', '履修', '教科書', '図', '表', '試験'];

function main() {
    console.log("Loading DB...");
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));

    console.log(`Total questions: ${db.length}`);

    const candidates = [];

    db.forEach(q => {
        const text = (q.question_text || "") + (q.explanation || "");

        // Check for keywords
        const hitWords = NG_KEYWORDS.filter(w => text.includes(w));

        if (hitWords.length > 0) {
            candidates.push({
                id: q.id,
                text: q.question_text.substring(0, 50) + "...",
                hit: hitWords,
                full_text: q.question_text
            });
        }
    });

    console.log(`Found ${candidates.length} candidates.`);

    fs.writeFileSync("candidates.json", JSON.stringify(candidates, null, 2));
    console.log("Saved candidates to candidates.json");
}

main();
