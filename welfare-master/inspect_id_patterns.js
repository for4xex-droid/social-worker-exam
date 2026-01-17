const fs = require('fs');
const path = 'app/assets/past_social_complete.json';

try {
    const data = JSON.parse(fs.readFileSync(path, 'utf8'));

    // Filter R6
    const r6 = data.filter(q => q.group_id === 'past_social_37');

    console.log(`Total R6 questions: ${r6.length}`);

    if (r6.length > 0) {
        // Sort explicitly to simulate useBookshelf
        r6.sort((a, b) => (a.id > b.id ? 1 : -1));

        console.log('First 5 IDs (after sort):', r6.slice(0, 5).map(q => q.id).join(', '));
        console.log('Last 5 IDs (after sort):', r6.slice(-5).map(q => q.id).join(', '));

        // Check for non-standard IDs
        const weirdIds = r6.filter(q => !q.id.startsWith('ss37_'));
        if (weirdIds.length > 0) {
            console.log('WARNING: Found weird IDs:', weirdIds.map(q => q.id));
        } else {
            console.log('All IDs start with ss37_');
        }
    }
} catch (e) {
    console.error(e);
}
