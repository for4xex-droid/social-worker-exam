const fs = require('fs');
const path = require('path');

// Source files
const NEW_DATA_PATH = path.join(__dirname, 'app/assets/past_social_complete.json');
const OLD_DATA_PATH = path.join(__dirname, 'app/assets/master_data.json');

console.log('Loading data files...');

const newData = JSON.parse(fs.readFileSync(NEW_DATA_PATH, 'utf8'));
const oldData = JSON.parse(fs.readFileSync(OLD_DATA_PATH, 'utf8'));

console.log(`New Data: ${newData.length} items`);
console.log(`Old Data: ${oldData.length} items`);

// Build a lookup from old data using normalized question text as key
// Normalize: remove whitespace, take first 50 chars
const normalize = (text) => {
    if (!text) return '';
    return text.replace(/\s+/g, '').substring(0, 80);
};

const explanationLookup = new Map();
for (const q of oldData) {
    const key = normalize(q.question_text || q.questionText);
    if (!key) continue;

    const expl = q.explanation || '';
    // Only store if explanation is meaningful (not placeholder)
    if (expl && expl.length > 20 && !expl.includes('準備中')) {
        // Prefer longer explanations
        const existing = explanationLookup.get(key);
        if (!existing || expl.length > existing.length) {
            explanationLookup.set(key, expl);
        }
    }
}

console.log(`Explanation Lookup: ${explanationLookup.size} entries with meaningful explanations`);

// Merge explanations into new data
let mergedCount = 0;
for (const q of newData) {
    const key = normalize(q.question_text);
    if (!key) continue;

    const oldExpl = explanationLookup.get(key);
    if (oldExpl) {
        q.explanation = oldExpl;
        mergedCount++;
    }
}

console.log(`Merged ${mergedCount} explanations into new data.`);

// Write back
fs.writeFileSync(NEW_DATA_PATH, JSON.stringify(newData, null, 2), 'utf8');
console.log(`Updated ${NEW_DATA_PATH}`);

// Also check sample
const sample = newData.find(q => q.id === 'ss37_001');
if (sample) {
    console.log(`\nSample (ss37_001) Explanation: ${sample.explanation?.substring(0, 100)}...`);
}
