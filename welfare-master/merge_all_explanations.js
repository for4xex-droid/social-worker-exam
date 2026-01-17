const fs = require('fs');
const path = require('path');

// Target file
const TARGET_PATH = path.join(__dirname, 'app/assets/past_social_complete.json');

// Source files with explanations (multiple sources for better coverage)
const SOURCE_FILES = [
    'app/assets/master_database_v13_rev2.json',
    'app/assets/master_database_final.json',
    'data_pipeline/master_database_v2_final.json',
    'app/assets/master_data.json',
    'app/assets/master_database_v12_repaired.json',
    'app/assets/master_database_v11_repaired.json',
    'app/assets/master_database_v10_normalized.json',
];

// Normalize text for matching
const normalize = (text) => {
    if (!text) return '';
    return text.replace(/\s+/g, '').substring(0, 80);
};

console.log('Building explanation lookup from multiple sources...');

// Build a comprehensive lookup from all sources
const explanationLookup = new Map();

for (const relPath of SOURCE_FILES) {
    const filePath = path.join(__dirname, relPath);
    if (!fs.existsSync(filePath)) continue;

    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        let added = 0;

        for (const q of data) {
            const key = normalize(q.question_text || q.questionText);
            if (!key) continue;

            const expl = q.explanation || '';
            // Only store if explanation is meaningful
            if (expl && expl.length > 30 && !expl.includes('準備中')) {
                const existing = explanationLookup.get(key);
                // Prefer longer explanations
                if (!existing || expl.length > existing.length) {
                    explanationLookup.set(key, expl);
                    added++;
                }
            }
        }
        console.log(`  ${relPath}: +${added} explanations`);
    } catch (e) {
        console.log(`  ${relPath}: ERROR - ${e.message}`);
    }
}

console.log(`Total unique explanations in lookup: ${explanationLookup.size}`);

// Load target and merge
const targetData = JSON.parse(fs.readFileSync(TARGET_PATH, 'utf8'));

let mergedCount = 0;
let alreadyHad = 0;
let stillMissing = 0;

for (const q of targetData) {
    // Force overwrite to restore formatting
    // const hasExpl = q.explanation && q.explanation.length > 30 && !q.explanation.includes('準備中');
    // if (hasExpl) {
    //    alreadyHad++;
    //    continue;
    // }

    const key = normalize(q.question_text);
    const foundExpl = explanationLookup.get(key);

    if (foundExpl) {
        q.explanation = foundExpl;
        mergedCount++;
    } else {
        stillMissing++;
    }
}

console.log(`\nResults:`);
console.log(`  Already had explanation: ${alreadyHad}`);
console.log(`  Newly merged: ${mergedCount}`);
console.log(`  Still missing: ${stillMissing}`);

// Save
fs.writeFileSync(TARGET_PATH, JSON.stringify(targetData), 'utf8');
console.log(`\nSaved to ${TARGET_PATH}`);

// List some still missing for reference
if (stillMissing > 0) {
    const missing = targetData.filter(q => !q.explanation || q.explanation.length <= 30 || q.explanation.includes('準備中'));
    console.log(`\nSample missing:`, missing.slice(0, 5).map(q => q.id));
}
