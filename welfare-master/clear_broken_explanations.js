const fs = require('fs');
const path = require('path');

const TARGET_PATH = path.join(__dirname, 'app/assets/past_social_complete.json');

// Re-use logic to identify which ones have source formatting
const SOURCE_FILES = [
    'app/assets/master_database_v13_rev2.json',
    'app/assets/master_database_final.json',
    'data_pipeline/master_database_v2_final.json',
    'app/assets/master_data.json',
];

const normalize = (text) => text ? text.replace(/\s+/g, '').substring(0, 80) : '';

const explanationLookup = new Map();
for (const relPath of SOURCE_FILES) {
    try {
        const data = JSON.parse(fs.readFileSync(path.join(__dirname, relPath), 'utf8'));
        for (const q of data) {
            const key = normalize(q.question_text || q.questionText);
            if (key && q.explanation && q.explanation.length > 30) {
                explanationLookup.set(key, true);
            }
        }
    } catch (e) { }
}

const data = JSON.parse(fs.readFileSync(TARGET_PATH, 'utf8'));
let cleared = 0;

for (const q of data) {
    const key = normalize(q.question_text);
    // If we have an explanation but NO source for it (meaning it's likely the AI generated one that lost formatting)
    // AND it doesn't have newlines (confirming it lost formatting)
    if (q.explanation && q.explanation.length > 30 && !explanationLookup.has(key)) {
        if (!q.explanation.includes('\n')) {
            // Clear it so it gets regenerated
            q.explanation = "";
            cleared++;
        }
    }
}

fs.writeFileSync(TARGET_PATH, JSON.stringify(data), 'utf8');
console.log(`Cleared ${cleared} explanations to force re-generation.`);
