const fs = require('fs');
const path = require('path');

const DB_PATH = "app/assets/separated_db/master_social.json";

function inspect() {
    if (!fs.existsSync(DB_PATH)) {
        console.log("DB not found");
        return;
    }
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));

    // Filter for Reiwa 6 (group_id: past_social_37 or similar)
    const r6 = data.filter(q => q.group_id && q.group_id.includes('37')); // Reiwa 6 is 36th or 37th? 
    // R6 exam is usually the 36th exam (conducted in Feb 2024)? 
    // Wait. R6 exam (conducted Feb 2024) is the 36th.
    // R5 exam (conducted Feb 2023) is the 35th.
    // Let's check the IDs.

    console.log(`Total items in DB: ${data.length}`);
    console.log(`Searching for R6 items...`);

    // Let's group by group_id
    const groups = {};
    data.forEach(q => {
        const g = q.group_id || 'unknown';
        if (!groups[g]) groups[g] = [];
        groups[g].push(q);
    });

    Object.keys(groups).forEach(g => {
        if (g.includes('social') || g.includes('past')) {
            console.log(`Group: ${g}, Count: ${groups[g].length}`);
            // Check sorting of first few
            const samples = groups[g].slice(0, 5).map(q => q.id);
            console.log(`  IDs: ${samples.join(', ')} ...`);

            // sort check
            let sorted = true;
            for (let i = 0; i < groups[g].length - 1; i++) {
                if (groups[g][i].id > groups[g][i + 1].id) {
                    sorted = false;
                    console.log(`  Order break at index ${i}: ${groups[g][i].id} > ${groups[g][i + 1].id}`);
                    break;
                }
            }
            console.log(`  Is Sorted by ID? ${sorted}`);

            if (g === 'past_social_37') {
                console.log("--- First Item Dump ---");
                console.log(JSON.stringify(groups[g][0], null, 2));

                console.log("--- Question Numbers ---");
                // Check if we can extract number from text "問題１"
                const nums = groups[g].map(q => {
                    const m = q.question_text.match(/問題(\d+)/);
                    return m ? parseInt(m[1]) : -1;
                });
                console.log(`Numbers found: ${nums.length}`);
                console.log(`Range: ${Math.min(...nums)} - ${Math.max(...nums)}`);
                // Find missing
                const missing = [];
                for (let i = Math.min(...nums); i <= Math.max(...nums); i++) {
                    if (!nums.includes(i)) missing.push(i);
                }
                console.log(`Missing Numbers: ${missing.join(', ')}`);
            }
        }
    });
}


inspect();
