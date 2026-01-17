const fs = require('fs');
const path = require('path');

/**
 * Fix correct_answer format across all data files.
 * Converts string formats like "1,2" to array formats like ["1", "2"]
 */

const FILES_TO_FIX = [
    'app/assets/past_social_complete.json',
    'app/assets/separated_db/master_social.json',
    'app/assets/separated_db/master_mental.json',
    'app/assets/separated_db/master_care.json',
    'app/assets/separated_db/master_common.json',
    'app/assets/separated_db/master_daily.json',
    'app/public/web_spec_social_v3.json',
];

function fixCorrectAnswer(value) {
    if (!value) return [];

    // Already an array
    if (Array.isArray(value)) {
        return value.map(v => String(v).trim());
    }

    // String value
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];

        // Check if it's already valid JSON array
        if (trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    return parsed.map(v => String(v).trim());
                }
            } catch (e) {
                // Not valid JSON, continue processing
            }
        }

        // Comma-separated: "1,2" -> ["1", "2"]
        if (trimmed.includes(',')) {
            return trimmed.split(',').map(s => s.trim());
        }

        // Single value: "1" -> ["1"]
        return [trimmed];
    }

    // Object or other
    return [];
}

let totalFixed = 0;

for (const relPath of FILES_TO_FIX) {
    const filePath = path.join(__dirname, relPath);

    if (!fs.existsSync(filePath)) {
        console.log(`SKIP (not found): ${relPath}`);
        continue;
    }

    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        if (!Array.isArray(data)) {
            console.log(`SKIP (not array): ${relPath}`);
            continue;
        }

        let fixedCount = 0;

        for (const item of data) {
            const original = item.correct_answer || item.correctAnswer;
            const fixed = fixCorrectAnswer(original);

            // Check if format changed
            const originalStr = JSON.stringify(original);
            const fixedStr = JSON.stringify(fixed);

            if (originalStr !== fixedStr) {
                fixedCount++;
            }

            // Always use correct_answer (snake_case for consistency)
            item.correct_answer = fixed;

            // Remove camelCase version if exists
            if (item.correctAnswer !== undefined) {
                delete item.correctAnswer;
            }
        }

        // Write back
        fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
        console.log(`FIXED ${fixedCount} items in ${relPath} (total: ${data.length})`);
        totalFixed += fixedCount;

    } catch (e) {
        console.error(`ERROR processing ${relPath}:`, e.message);
    }
}

console.log(`\nTotal fixed: ${totalFixed} items across all files.`);
console.log('Done! Now run: node reorganize_database.js && node sync_web_assets.js');
