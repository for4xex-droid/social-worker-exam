const fs = require('fs');
const path = require('path');

const DB_PATH = "app/assets/separated_db/master_social.json";

function main() {
    console.log(`Loading ${DB_PATH}...`);
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));

    // 1. Find "Kyosei Katei" (養成課程)
    const survivors = data.filter(q => {
        const text = (q.question_text || "") + (q.explanation || "");
        return text.includes("養成課程");
    });

    console.log(`Found ${survivors.length} items with '養成課程'.`);
    survivors.forEach(q => {
        console.log(`[${q.id}] Cat:${q.category_label} Source:${q.source_tag || 'Unknown'} Text:${q.question_text.substring(0, 40)}...`);
    });

    // 2. Find Roman Numerals
    const romanRegex = /[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/;
    const romans = data.filter(q => {
        const text = (q.question_text || "") + (q.explanation || "");
        return romanRegex.test(text);
    });

    console.log(`Found ${romans.length} items with Roman Numerals.`);
    if (romans.length > 0) {
        console.log(`Sample [${romans[0].id}]: ${romans[0].question_text.substring(0, 40)}...`);
    }
}

main();
