const fs = require('fs');
const d = JSON.parse(fs.readFileSync('app/assets/master_database_v3.json', 'utf-8'));
const q = d.find(i => i.id == "32641");
console.log(JSON.stringify(q, null, 2));
