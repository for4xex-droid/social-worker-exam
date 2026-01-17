const fs = require('fs');
const path = require('path');

const COMMON_DB = "app/assets/separated_db/master_common.json";

function analyze() {
    if (!fs.existsSync(COMMON_DB)) {
        console.log("No common DB found.");
        return;
    }

    const data = JSON.parse(fs.readFileSync(COMMON_DB, 'utf-8'));
    console.log(`Total Common Items: ${data.length}`);

    // Frequency map for Categories and their sources
    const catAnalysis = {};

    data.forEach(q => {
        const c = q.category_label || "Unknown";
        if (!catAnalysis[c]) catAnalysis[c] = { count: 0, sources: {} };

        catAnalysis[c].count++;
        const src = q.source_tag || "unknown";
        catAnalysis[c].sources[src] = (catAnalysis[c].sources[src] || 0) + 1;
    });

    console.log("\n--- Category Breakdown with Sources ---");
    const sortedCats = Object.entries(catAnalysis).sort((a, b) => b[1].count - a[1].count);
    sortedCats.forEach(([cat, info]) => {
        console.log(`${cat}: ${info.count}`);
        Object.entries(info.sources).forEach(([src, cnt]) => {
            console.log(`  - ${src}: ${cnt}`);
        });
    });
}

analyze();
