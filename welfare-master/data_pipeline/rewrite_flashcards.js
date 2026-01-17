
const fs = require('fs');
const path = require('path');

const WAM_FILE = path.join(__dirname, 'wam_raw.json');
const OUTPUT_FILE = path.join(__dirname, '../app/assets/flashcards.json');
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
                const val = parts.slice(1).join('=').trim(); // handle values with =
                process.env[key] = val.replace(/"/g, '').replace(/'/g, ''); // basic quotes removal
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

async function rewriteDefinition(term, originalDef) {
    const url = "https://api.openai.com/v1/chat/completions";

    // Strict prompt for quality (Japanese)
    const prompt = `
    あなたは社会福祉士試験の学習アプリの編集者です。
    以下の用語の「解説」を、単語カード（クイズ）の問題文として適した形にリライトしてください。
    
    ターゲット用語: ${term}
    元の解説: ${originalDef}
    
    【ルール】
    1. **必ず日本語**で出力すること。
    2. 60文字以内の「簡潔な一文」にすること。絶対に長文にしないこと。
    3. 文中にターゲット用語「${term}」そのものを含めないこと。（「この障害は」「この制度は」のように指示語で置き換えるか、隠すこと）
    4. 「正解は」や「答えは」から始めないこと。
    5. 解説のみを出力すること（「はい、こちらです」などの前置きは不要）。
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
        const rewritten = data.choices[0].message.content.trim();
        return rewritten;
    } catch (e) {
        console.error(`Failed to rewrite ${term}:`, e.message);
        return null; // Return null on failure
    }
}

async function processAll() {
    console.log("Loading raw WAM data...");
    const rawData = JSON.parse(fs.readFileSync(WAM_FILE, 'utf8'));

    console.log(`Processing ${rawData.length} terms with OpenAI API...`);

    const flashcards = [];
    let count = 0;

    // Process in chunks to avoid rate limits? 
    // Sequential for safety and simplicity as requested "avoid errors"
    for (const item of rawData) {
        // Skip redirects (start with →)
        if (item.original_definition.trim().startsWith('→')) {
            console.log(`Skipping redirect: ${item.term}`);
            continue;
        }

        process.stdout.write(`[${count + 1}/${rawData.length}] ${item.term}... `);

        // Basic pre-check: if term is in definition literally, API usually handles it, but good to note.

        const newDef = await rewriteDefinition(item.term, item.original_definition);

        if (newDef) {
            flashcards.push({
                id: `wam_${count + 1}`,
                term: item.term,
                definition: newDef,
                group_id: 'wam_glossary',
                category_label: '障害福祉用語集',
                original_definition: item.original_definition
            });
            console.log("OK");
        } else {
            console.log("FAILED");
        }

        count++;
        // Small delay to be nice to API limits if on free tier
        // await new Promise(r => setTimeout(r, 200)); 
    }

    console.log(`Generated ${flashcards.length} flashcards.`);

    // Save
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(flashcards, null, 2), 'utf8');
    console.log(`Saved to ${OUTPUT_FILE}`);
}

processAll();
