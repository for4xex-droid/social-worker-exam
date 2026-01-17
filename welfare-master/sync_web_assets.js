const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, 'app/assets/separated_db');
const DEST_DIR = path.join(__dirname, 'app/public');

if (!fs.existsSync(DEST_DIR)) fs.mkdirSync(DEST_DIR, { recursive: true });

// Mapping: Source -> Dest
const MAPPING = {
    'master_common.json': 'web_common.json',
    'master_daily.json': 'web_daily.json',
    'master_social.json': 'web_spec_social_v3.json', // Social Unified (Clean V3)
    'master_mental.json': 'web_spec_mental_0.json', // Mental Unified (Spec + Past) - putting all in chunk 0
    'master_care.json': 'web_spec_care.json'
};

console.log("Syncing Web Assets...");

// 1. Copy main files
for (const [src, dest] of Object.entries(MAPPING)) {
    const srcPath = path.join(SOURCE_DIR, src);
    const destPath = path.join(DEST_DIR, dest);
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied ${src} -> ${dest}`);
    } else {
        console.warn(`Missing source: ${src}`);
    }
}

// 2. Clear old discrete files to avoid duplication
// Because master_social.json now contains both spec and past, we empty the old separate past file
// to prevent double loading if the web client still tries to fetch it.
const EMPTY_FILES = [
    'web_past_social.json',
    'web_past_mental.json'
];

for (const f of EMPTY_FILES) {
    fs.writeFileSync(path.join(DEST_DIR, f), "[]");
    console.log(`Cleared ${f} (using unified spec file instead)`);
}

// 3. Mental Chunks Cleanup (Remove chunk 1..20 since we put all in chunk 0)
// Web client loops until 404, so having only chunk 0 is fine.
// We delete chunk 1 to N to ensure it stops loading there.
for (let i = 1; i <= 20; i++) {
    const f = `web_spec_mental_${i}.json`;
    const p = path.join(DEST_DIR, f);
    if (fs.existsSync(p)) {
        fs.unlinkSync(p);
        console.log(`Removed obsolete chunk: ${f}`);
    }
}

console.log("Web asset sync complete.");
