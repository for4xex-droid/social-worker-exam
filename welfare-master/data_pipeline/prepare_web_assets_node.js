const fs = require('fs');
const path = require('path');

// --- CONFIG ---
const VARIANT = process.env.APP_VARIANT || 'social';
console.log(`[Node.js Pipeline] Generating assets for variant: ${VARIANT}`);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DB_DIR = path.join(PROJECT_ROOT, "app/assets/separated_db");
const PUBLIC_DIR = path.join(PROJECT_ROOT, "app/public");

if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// Map variant to master file
const VARIANT_MAP = {
    'social': 'master_social.json',
    'mental': 'master_mental.json',
    'care': 'master_care.json'
};

const MASTER_FILE = path.join(DB_DIR, VARIANT_MAP[VARIANT]);

// Common Subjects Keywords (Shared logic)
const COMMON_KEYWORDS = [
    "人体の構造と機能", "心理学理論", "社会理論", "現代社会",
    "社会調査", "相談援助", "権利擁護", "低所得者",
    "更生保護", "社会保障", "医学概論", "公衆衛生", "法学"
];

// Main function
function main() {
    if (!fs.existsSync(MASTER_FILE)) {
        console.error(`Master file not found: ${MASTER_FILE}`);
        process.exit(1);
    }

    console.log(`Loading ${MASTER_FILE}...`);
    const raw = fs.readFileSync(MASTER_FILE, 'utf-8');
    const questions = JSON.parse(raw);
    console.log(`Loaded ${questions.length} questions.`);

    const listCommon = [];
    const listPast = [];
    const listSpec = [];

    // Filter & Sort
    for (const q of questions) {
        // Ensure ID
        if (!q.id) q.id = Math.random().toString(36).substr(2, 9);

        // Normalize fields
        let cat = q.category_label || "";

        // CLEANUP: Merge "Subject_part_1" -> "Subject"
        cat = cat.replace(/_part_\d+/gi, "")
            .replace(/_vol_\d+/gi, "")
            .replace(/（\d+）/g, "") // Remove (1), (2) etc if present
            .trim();

        // Update the object for output
        q.category_label = cat;

        const group = q.group || "";
        const year = q.year || "";

        // 1. Check Past (Has year or existing group)
        if (year || group.startsWith('past')) {
            const qCopy = { ...q, group: `past_${VARIANT}` };
            listPast.push(qCopy);
            continue;
        }

        // 2. Check Common
        let isCommon = false;
        if (COMMON_KEYWORDS.some(k => cat.includes(k))) {
            isCommon = true;
        }
        // Also check if existing group says common
        if (group === 'common') isCommon = true;

        if (isCommon) {
            // Check if this variant uses this common subject? 
            // We assume master_*.json only contains relevant stuff (reorganized).
            // But we should differentiate "Common" group.
            const qCopy = { ...q, group: 'common' };
            listCommon.push(qCopy);
        } else {
            // 3. Spec (Specialized)
            const qCopy = { ...q, group: `spec_${VARIANT}` };
            listSpec.push(qCopy);
        }
    }

    console.log(`\n--- Generation Stats for ${VARIANT} ---`);
    console.log(`Common: ${listCommon.length}`);
    console.log(`Past:   ${listPast.length}`);
    console.log(`Spec:   ${listSpec.length}`);

    // Save
    fs.writeFileSync(path.join(PUBLIC_DIR, "web_common.json"), JSON.stringify(listCommon, null, 4));
    fs.writeFileSync(path.join(PUBLIC_DIR, `web_past_${VARIANT}.json`), JSON.stringify(listPast, null, 4));
    fs.writeFileSync(path.join(PUBLIC_DIR, `web_spec_${VARIANT}.json`), JSON.stringify(listSpec, null, 4));

    // Also generate simplified cards if needed (placeholder)
    if (!fs.existsSync(path.join(PUBLIC_DIR, "web_cards.json"))) {
        fs.writeFileSync(path.join(PUBLIC_DIR, "web_cards.json"), "[]");
    }

    console.log("\nAssets generated successfully!");
}

main();
