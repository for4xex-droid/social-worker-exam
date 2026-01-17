const fs = require('fs');
const path = require('path');

const TARGET_FILE = "app/assets/social_spec_part7.json";
// Keywords confirmed to be associated with bad data in this batch
const NG_KEYWORDS = ['カリキュラム', 'テキスト', '履修', '教科書', '図', '表', '試験'];

function main() {
    console.log(`Cleaning ${TARGET_FILE}...`);
    const data = JSON.parse(fs.readFileSync(TARGET_FILE, 'utf-8'));
    const initialCount = data.length;

    const cleanData = data.filter(q => {
        const text = (q.question_text || "") + (q.explanation || "");
        // If it matches keywords, DROP IT.
        // Exception: "代表" contains "表", "意図" contains "図".
        // We need slight strictness or manual confirmation from previous step.
        // Previous step showed 8 candidates.
        // Let's implement specific checks for "図" and "表" to avoid over-deletion if possible,
        // but for this batch, "表3-14" and "カリキュラム" were the issues.

        // Strict check for single char keywords
        if (text.includes('カリキュラム')) return false;
        if (text.includes('テキスト')) return false;
        if (text.includes('履修')) return false;
        if (text.includes('教科書')) return false;
        if (text.includes('試験')) return false; // "国家試験" might be okay? Assume bad for now in this generated batch.

        // Contextual check for 図/表
        // "表" checks
        if (/表\d/.test(text)) return false; // "表1"
        if (/表に/.test(text)) return false; // "表に"
        if (/次の表/.test(text)) return false;

        // "図" checks
        if (/図\d/.test(text)) return false;
        if (/図を/.test(text)) return false;
        if (/次の図/.test(text)) return false;

        return true;
    });

    const removedCount = initialCount - cleanData.length;
    console.log(`Removed ${removedCount} items. Remaining: ${cleanData.length}`);

    fs.writeFileSync(TARGET_FILE, JSON.stringify(cleanData, null, 4));
}

main();
