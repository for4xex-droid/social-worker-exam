const fs = require('fs');
const DB = "app/assets/separated_db/master_social.json";
const KEYWORD = "養成課程";

const data = JSON.parse(fs.readFileSync(DB, 'utf-8'));
const hits = data.filter(q => JSON.stringify(q).includes(KEYWORD));

console.log(`Hits: ${hits.length}`);
hits.forEach(q => console.log(`[${q.id}] Source:${q.source_tag} Text:${q.question_text.substring(0, 20)}...`));
