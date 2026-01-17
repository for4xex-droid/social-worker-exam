const https = require('https');

const url = 'https://dist-psi-jet-69.vercel.app/web_spec_social.json';

console.log(`Fetching from ${url}...`);

https.get(url, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log(`Total items: ${json.length}`);

            const counts = {};
            json.forEach(item => {
                const cat = item.category_label || 'Unknown';
                counts[cat] = (counts[cat] || 0) + 1;
            });

            console.log('\n--- Category Counts ---');
            Object.keys(counts).forEach(key => {
                console.log(`${key}: ${counts[key]}`);
            });

        } catch (e) {
            console.error('Error parsing JSON:', e.message);
        }
    });

}).on('error', (err) => {
    console.error('Error fetching URL:', err.message);
});
