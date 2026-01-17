const fs = require('fs');
const path = require('path');

const DB_DIR = "app/assets/separated_db";

function main() {
    console.log("Verifying Database Separation (Strict Metadata Check)...");

    const pathSocial = path.join(DB_DIR, "master_social.json");
    const pathMental = path.join(DB_DIR, "master_mental.json");

    if (!fs.existsSync(pathSocial)) { console.error("Missing Social DB"); return; }
    if (!fs.existsSync(pathMental)) { console.error("Missing Mental DB"); return; }

    const dbSocial = JSON.parse(fs.readFileSync(pathSocial, 'utf-8'));
    const dbMental = JSON.parse(fs.readFileSync(pathMental, 'utf-8'));

    let errSocial = 0;

    console.log(`Checking Social DB (${dbSocial.length} items)...`);
    dbSocial.forEach(q => {
        const qStr = JSON.stringify(q);
        // Error if: It is marked as Mental Special Source, but NOT Social Special Source.
        const isMentalSource = qStr.includes("精神専") || qStr.includes("精神専門");
        const isSocialSource = qStr.includes("SW専") || qStr.includes("社会専門");

        if (isMentalSource && !isSocialSource) {
            // It might be here because it fell into "Common" bucket via keyword match?
            // But reorganize priority puts it in Mental if it has Mental Code.
            // So this should ideally be 0.
            console.error(`[FAIL] Mental-only data found in Social: ${q.id.substring(0, 20)}... cat:${q.category_label}`);
            errSocial++;
        }
    });

    let errMental = 0;
    console.log(`Checking Mental DB (${dbMental.length} items)...`);
    dbMental.forEach(q => {
        const qStr = JSON.stringify(q);
        const isPsw = qStr.includes("PSW専") || qStr.includes("ＰＳＷ専");
        const isMentalSource = qStr.includes("精神専") || qStr.includes("精神専門") || isPsw;
        // SW専 should not match PSW専.
        // Simple heuristic: if it has SW専, verify it's not part of PSW match if possible, 
        // or just rely on the fact that if it is PSW, it is Mental.
        // But here we want to detect "Social Only" in Mental.
        // If it is PSW, it is Mental. So if logic says "Social Only", we must ensure it is NOT PSW.

        // Strict check for SW
        const hasSwSen = qStr.includes("SW専") || qStr.includes("ＳＷ専");
        const isSocialSource = (hasSwSen && !isPsw) || qStr.includes("社会専門");

        if (isSocialSource && !isMentalSource) {
            console.error(`[FAIL] Social-only data found in Mental: ${q.id.substring(0, 20)}... cat:${q.category_label}`);
            errMental++;
        }
    });

    console.log("\n--- Strict Verification Result ---");
    console.log(`Mental-only in Social DB: ${errSocial}`);
    console.log(`Social-only in Mental DB: ${errMental}`);

    if (errSocial === 0 && errMental === 0) {
        console.log("\nSUCCESS: Strict separation confirmed.");
        console.log("Databases adhere to folder source of truth.");
    } else {
        console.error("\nFAILURE: Contamination detected.");
    }
}

main();
