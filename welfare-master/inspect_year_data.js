const fs = require('fs');
const path = 'app/assets/past_social_complete.json';

try {
    const data = JSON.parse(fs.readFileSync(path, 'utf8'));

    // Check specific IDs
    const q1 = data.find(q => q.id === 'ss37_001');
    const q101 = data.find(q => q.id === 'ss37_101');

    console.log('--- Inspector ---');
    if (q1) {
        console.log(`[ss37_001] Year: "${q1.year}", Group: "${q1.group_id}"`);
    } else {
        console.log('[ss37_001] NOT FOUND');
    }

    if (q101) {
        console.log(`[ss37_101] Year: "${q101.year}", Group: "${q101.group_id}"`);
    } else {
        console.log('[ss37_101] NOT FOUND');
    }

    // Check how many have the correct year
    const r6_correct = data.filter(q => q.group_id === 'past_social_37' && q.year === '令和6年度');
    console.log(`Total R6 questions with correct year: ${r6_correct.length} / 129`);

} catch (e) {
    console.error(e);
}
