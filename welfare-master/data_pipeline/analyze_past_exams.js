const fs = require('fs');
const path = require('path');

const DB_PATH = "app/assets/separated_db/master_social.json";

function analyze() {
    if (!fs.existsSync(DB_PATH)) {
        console.log(`Database not found at ${DB_PATH}`);
        return;
    }

    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    console.log(`Total questions in DB: ${data.length}`);

    // Group by Year (using 'year' field or heuristically determining it)
    const byYear = {};
    const unknownYear = [];

    data.forEach(q => {
        // Filter for "Past Exams" usually indicated by group_id starting with 'past' or non-spec/non-common key?
        // Actually, let's just check the 'year' field first.
        let y = q.year;

        // If year is missing, try to guess from group_id or category
        if (!y) {
            if (q.group_id && q.group_id.includes('past')) {
                // Try to extract year from group_id like 'past_social_33'
                const match = q.group_id.match(/(\d+)/);
                if (match) y = match[1];
            }
        }

        if (y) {
            // Visualize year cleanly (e.g., "33" -> "第33回", "2021" -> "2021")
            const key = `Year_${y}`;
            if (!byYear[key]) byYear[key] = [];
            byYear[key].push(q);
        } else {
            // Check if it's strictly a past question source
            if (q.source_tag === 'social_file' || q.source_tag === 'master_v3' || (q.group_id && q.group_id.startsWith('past'))) {
                unknownYear.push(q);
            }
        }
    });

    console.log("\n--- Breakdown by Year ---");
    Object.keys(byYear).sort().forEach(k => {
        const questions = byYear[k];
        console.log(`${k}: ${questions.length} questions`);

        // Check sort order (naive check by ID or Question Text start)
        // Usually questions start with "問題1" or just have an ID that indicates order.
        // Let's print the first 3 and last 3 Question Texts to see if they are in order.

        // Sort by ID to see if ID matches order
        // questions.sort((a, b) => String(a.id).localeCompare(String(b.id))); 
        // We want to see the stored order, so don't sort yet? 
        // User says "order is scattered", so we should check current list order.

        console.log(`  First 3 (Stored Order):`);
        questions.slice(0, 3).forEach(q => console.log(`    [${q.id}] ${q.question_text.substring(0, 20)}...`));

        console.log(`  Last 3 (Stored Order):`);
        questions.slice(-3).forEach(q => console.log(`    [${q.id}] ${q.question_text.substring(0, 20)}...`));
    });

    if (unknownYear.length > 0) {
        console.log(`\nUnknown Year (Past-like): ${unknownYear.length} questions`);
        console.log(`  Sample: [${unknownYear[0].id}] ${unknownYear[0].question_text.substring(0, 20)}...`);
    }

    // Specific check for Recent Years (Reiwa 3, 4, 5, 6 -> Exams 33, 34, 35, 36 approx)
    // Social Worker Exams:
    // 36th (Reiwa 5/2024 Feb)
    // 35th (Reiwa 4/2023 Feb)
    // ...
}

analyze();
