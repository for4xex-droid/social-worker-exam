const fs = require('fs');
const path = require('path');
const FILES = [
    "app/assets/master_data.json",
    "app/assets/master_database_v3.json",
    "app/assets/master_database_v10_normalized.json",
    "app/assets/mental_special.json",
    "app/assets/social_spec_part7.json"
].map(p => path.join(__dirname, '../', p));

const ID = "32641";

FILES.forEach(f => {
    if (fs.existsSync(f)) {
        const d = JSON.parse(fs.readFileSync(f));
        const hit = d.find(q => q.id == ID || q.id === ID);
        if (hit) console.log(`Found ${ID} in ${path.basename(f)}`);
    }
});
