const fs = require('fs');
const path = require('path');

const DB_DIR = "app/assets/separated_db";

function main() {
    console.log("Verifying Database Separation...");

    // Load DBs
    const pathSocial = path.join(DB_DIR, "master_social.json");
    const pathMental = path.join(DB_DIR, "master_mental.json");

    if (!fs.existsSync(pathSocial) || !fs.existsSync(pathMental)) {
        console.error("Database files missing. Run reorganize script first.");
        return;
    }

    const dbSocial = JSON.parse(fs.readFileSync(pathSocial, 'utf-8'));
    const dbMental = JSON.parse(fs.readFileSync(pathMental, 'utf-8'));

    console.log(`Checking Social DB (${dbSocial.length} items)...`);
    let errSocial = 0;
    dbSocial.forEach(q => {
        const s = JSON.stringify(q);
        // "精神専" is the folder code for Mental Special
        if (s.includes("精神専")) {
            errSocial++;
        }
        // "精神専門" is another indicator
        if (s.includes("精神専門")) {
            errSocial++;
        }
    });

    console.log(`Checking Mental DB (${dbMental.length} items)...`);
    let errMental = 0;
    dbMental.forEach(q => {
        const s = JSON.stringify(q);
        // "SW専" is the folder code for Social Special
        if (s.includes("SW専")) {
            errMental++;
        }
        // "社会専門" is another indicator
        if (s.includes("社会専門")) {
            errMental++;
        }
    });

    console.log("\n--- Verification Result ---");
    console.log(`Mental questions found in Social DB: ${errSocial}`);
    console.log(`Social questions found in Mental DB: ${errMental}`);

    if (errSocial === 0 && errMental === 0) {
        console.log("\nSUCCESS: Databases are perfectly separated.");
    } else {
        console.error("\nFAILURE: Contamination detected!");
    }
}

main();
