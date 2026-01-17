
const fs = require('fs');
const path = require('path');

const RAW_FILE = path.join(__dirname, 'keifukai_raw.json');
const FLASHCARDS_FILE = path.join(__dirname, '../app/assets/flashcards.json');
const ENV_FILE = path.join(__dirname, '.env');

// Simple .env parser
function loadEnv() {
    if (fs.existsSync(ENV_FILE)) {
        const content = fs.readFileSync(ENV_FILE, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = parts.slice(1).join('=').trim();
                process.env[key] = val.replace(/"/g, '').replace(/'/g, '');
            }
        }
    }
}

loadEnv();

const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
    console.error("Error: OPENAI_API_KEY not found in .env");
    process.exit(1);
}

// Reuse existing flashcards to append or rewrite if needed
let existingCards = [];
if (fs.existsSync(FLASHCARDS_FILE)) {
    existingCards = JSON.parse(fs.readFileSync(FLASHCARDS_FILE, 'utf8'));
}

async function rewriteDefinition(term, originalDef) {
    const url = "https://api.openai.com/v1/chat/completions";

    const prompt = `
    あなたは社会福祉士試験の学習アプリの編集者です。
    以下の用語の「解説」を、単語カード（クイズ）の問題文として適した形にリライトしてください。
    
    ターゲット用語: ${term}
    元の解説: ${originalDef}
    
    【ルール】
    1. **必ず日本語**で出力すること。
    2. 60文字以内の「簡潔な一文」にすること。絶対に長文にしないこと。
    3. 文中にターゲット用語「${term}」そのものを含めないこと。
    4. 「正解は」や「答えは」から始めないこと。
    5. 解説のみを出力すること。
    `;

    const body = {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 150
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`API Error ${res.status}: ${err}`);
        }

        const data = await res.json();
        return data.choices[0].message.content.trim();
    } catch (e) {
        console.error(`Failed to rewrite ${term}:`, e.message);
        return null; // Return null on failure
    }
}

async function processKeifukai() {
    console.log("Loading raw Keifukai data...");
    const rawData = JSON.parse(fs.readFileSync(RAW_FILE, 'utf8'));

    // Check duplicates against existing cards
    const existingTerms = new Set(existingCards.map(c => c.term));
    const newCards = [];

    console.log("Checking for duplicates...");
    const candidates = rawData.filter(item => {
        if (!item.term || !item.original_definition) return false;
        if (existingTerms.has(item.term)) {
            // console.log(`Duplicate found: ${item.term} (Skipping)`);
            return false;
        }
        return true;
    });

    console.log(`Processing ${candidates.length} new terms from Keifukai...`);

    let processedCount = 0;
    for (const item of candidates) {
        process.stdout.write(`[${processedCount + 1}/${candidates.length}] ${item.term}... `);

        const newDef = await rewriteDefinition(item.term, item.original_definition);

        if (newDef) {
            newCards.push({
                id: `keifukai_${processedCount + 1}`,
                term: item.term,
                definition: newDef,
                group_id: 'welfare_glossary', // Generic group
                category_label: '一般福祉用語',
                original_definition: item.original_definition,
                source_url: item.source_url
            });
            console.log("OK");
        } else {
            console.log("FAILED");
        }
        processedCount++;
        // await new Promise(r => setTimeout(r, 200)); 
    }

    const finalCards = existingCards.concat(newCards);

    console.log(`Added ${newCards.length} cards. Total: ${finalCards.length}`);

    fs.writeFileSync(FLASHCARDS_FILE, JSON.stringify(finalCards, null, 2), 'utf8');
    console.log(`Saved merged file to ${FLASHCARDS_FILE}`);
}

processKeifukai();
