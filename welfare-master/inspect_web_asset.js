const fs = require('fs');
const path = 'app/public/web_spec_social.json';

try {
    if (!fs.existsSync(path)) {
        console.log(`File not found: ${path}`);
    } else {
        const data = JSON.parse(fs.readFileSync(path, 'utf8'));

        // R6 (37) check
        const r6 = data.filter(q => q.group_id && q.group_id.includes('social_37'));

        console.log(`Checking Web Asset: ${path}`);
        console.log(`Total questions in file: ${data.length}`);
        console.log(`R6 Count: ${r6.length}`);

        if (r6.length > 0) {
            console.log(`First 5 IDs: ${r6.slice(0, 5).map(q => q.id).join(', ')}`);
            console.log(`First Question Text: ${r6[0].question_text.substring(0, 30)}...`);
            console.log(`ID format example: ${r6[0].id}`);

            // Random check for middle
            console.log(`10th item ID: ${r6[9] ? r6[9].id : 'N/A'}`);
            console.log(`100th item ID: ${r6[99] ? r6[99].id : 'N/A'}`);
        }
    }
} catch (e) {
    console.error(e);
}
