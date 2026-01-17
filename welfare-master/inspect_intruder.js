const fs = require('fs');
const path = 'app/assets/separated_db/master_social.json';

try {
    const data = JSON.parse(fs.readFileSync(path, 'utf8'));

    // Find the intruder
    const ps = data.filter(q => q.id && q.id.includes('ps_R6_'));

    console.log(`Intruder Count (ps_R6): ${ps.length}`);

    if (ps.length > 0) {
        console.log(`[Intruder Sample]`);
        console.log(`ID: ${ps[0].id}`);
        console.log(`Group ID: ${ps[0].group_id}`);
        console.log(`Year: ${ps[0].year}`);
        console.log(`Category: ${ps[0].category_label}`);
        console.log(`Text: ${ps[0].question_text.substring(0, 30)}...`);
    } else {
        console.log("No intruders found in master_social.json (weird)");
    }

    // Check for correct data
    const ss = data.filter(q => q.id && q.id.startsWith('ss37_'));
    console.log(`Correct Data Count (ss37): ${ss.length}`);
    if (ss.length > 0) {
        console.log(`[Correct Sample] Group ID: ${ss[0].group_id}`);
    }

} catch (e) {
    console.error(e);
}
