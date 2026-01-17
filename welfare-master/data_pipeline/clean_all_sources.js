const fs = require('fs');
const path = require('path');

// Defined in reorganize_database.js. We clean THE SOURCE to ensure persistence.
const FILES_TO_CLEAN = [
    "app/assets/master_data.json",
    "app/assets/master_database_v3.json",
    "app/assets/master_database_v10_normalized.json",
    "app/assets/mental_special.json",
    "app/assets/mental_special_lite.json",
    "app/assets/social_spec_part7.json"
].map(p => path.join(__dirname, '../', p));

const STRICT_BAN_KEYWORDS = [
    '養成課程',
    '本書',
    '執筆',
    '編集委員',
    'カリキュラム',
    'テキスト',
    '履修',
    '教科書',
    '学習のポイント',
    '参照して',
    '次ページ',
    '前ページ'
];

const ROMAN_MAP = {
    'Ⅰ': '1', 'Ⅱ': '2', 'Ⅲ': '3', 'Ⅳ': '4', 'Ⅴ': '5',
    'Ⅵ': '6', 'Ⅶ': '7', 'Ⅷ': '8', 'Ⅸ': '9', 'Ⅹ': '10'
};

function cleanFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.log(`Skipping missing file: ${filePath}`);
        return;
    }

    console.log(`Scanning ${path.basename(filePath)}...`);
    let data = [];
    try {
        data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
        console.error(`Error reading ${filePath}: ${e.message}`);
        return;
    }

    const initialCount = data.length;
    let removedLog = [];
    let modifiedCount = 0;

    const cleanData = [];

    data.forEach(q => {
        let qText = q.question_text || "";
        let expText = q.explanation || "";

        // 0. Normalize Roman Numerals (Text & Explanation)
        const originalTextCombined = qText + expText;
        qText = qText.replace(/[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/g, m => ROMAN_MAP[m]);
        expText = expText.replace(/[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/g, m => ROMAN_MAP[m]);

        // Normalize Roman Numerals (Options)
        let opts = q.options || q.optionsVal || [];
        let optsStrOriginal = "";
        let optsStrNew = "";

        if (Array.isArray(opts)) {
            optsStrOriginal = opts.join("");
            opts = opts.map(o => {
                if (typeof o === 'string') return o.replace(/[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/g, m => ROMAN_MAP[m]);
                return o;
            });
            optsStrNew = opts.join("");

            // Update object
            if (q.options) q.options = opts;
            if (q.optionsVal) q.optionsVal = opts;
        }

        if ((qText + expText) !== originalTextCombined || optsStrNew !== optsStrOriginal) {
            q.question_text = qText;
            q.explanation = expText;
            modifiedCount++;
        }

        // 1. Check for bad keywords (on normalized text + OPTIONS)
        // Include options in the check
        const optionsStr = Array.isArray(opts) ? opts.join("") : "";
        const checkText = (qText + expText + optionsStr).replace(/\s/g, "");

        let isBad = false;

        // A. Strict Keywords
        for (const word of STRICT_BAN_KEYWORDS) {
            if (checkText.includes(word)) {
                removedLog.push(`[${word}] ${q.id}: ${qText.substring(0, 30)}...`);
                isBad = true;
                break;
            }
        }

        if (!isBad) {
            // B. Contextual "Table/Figure"
            if (/表\d/.test(checkText) || /表[にのを]/.test(checkText) || /次の表/.test(checkText)) {
                removedLog.push(`[表-Pattern] ${q.id}: ${qText.substring(0, 30)}...`);
                isBad = true;
            } else if (/図\d/.test(checkText) || /図[にのを]/.test(checkText) || /次の図/.test(checkText)) {
                removedLog.push(`[図-Pattern] ${q.id}: ${qText.substring(0, 30)}...`);
                isBad = true;
            } else if (checkText.includes("国家試験") && checkText.includes("出題")) {
                if (checkText.includes("対策") || checkText.includes("傾向")) {
                    removedLog.push(`[試験meta] ${q.id}: ${qText.substring(0, 30)}...`);
                    isBad = true;
                }
            }
        }

        if (!isBad) {
            cleanData.push(q);
        }
    });

    const removedCount = initialCount - cleanData.length;

    if (removedCount > 0 || modifiedCount > 0) {
        console.log(`  Removed ${removedCount} items. Normalized ${modifiedCount} items.`);
        fs.writeFileSync(filePath, JSON.stringify(cleanData, null, 4));
    } else {
        console.log(`  No changes needed for ${path.basename(filePath)}`);
    }
}

function main() {
    FILES_TO_CLEAN.forEach(f => cleanFile(f));
}

main();
