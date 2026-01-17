
const fs = require('fs');
const path = require('path');

const TARGET_FILE = path.join(__dirname, '../app/assets/flashcards.json');
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

// Function to calculate similarity or simple inclusion
// Inclusion is strict: if term appears in definition, it's a leak.
function leaksAnswer(term, definition) {
    // Basic check: direct inclusion
    // Remove "（...）" readings from term for checking
    const baseTerm = term.replace(/（.+?）/g, '').replace(/\(.+?\)/g, '').trim();
    if (baseTerm.length < 2) return false; // Too short to ban (e.g. "OT" might appear in "OT") - though actually "OT" shouldn't be in def of "OT".

    // Case insensitive check
    const defUpper = definition.toUpperCase();
    const termUpper = baseTerm.toUpperCase();

    return defUpper.includes(termUpper);
}

async function fixDefinition(term, currentDef, originalDef) {
    const url = "https://api.openai.com/v1/chat/completions";

    const baseTerm = term.replace(/（.+?）/g, '').replace(/\(.+?\)/g, '').trim();

    const prompt = `
    修正依頼: 社会福祉士試験の単語カードの問題文（解説）の中に、答えとなる「用語」が含まれてしまっています。
    「用語」を一切使わずに、その意味がわかるように問題文を書き直してください。
    
    【ターゲット用語（正解）】: ${baseTerm}
    【現在の問題文（NG）】: ${currentDef}
    【元の辞書定義（参考）】: ${originalDef || "なし"}
    
    【修正ルール】 - 厳守
    1. **「${baseTerm}」という言葉を絶対に文章に入れないこと。**
    2. 代わりに「この制度は」「この専門職は」「この障害は」などの指示語や、より広い概念語を使うこと。
    3. 60文字以内の簡潔な日本語で、「〜のこと。」「〜制度。」のような体言止めにする。
    4. 答えが見えていなくても、知識があれば正解できる内容にすること。
    
    出力例:
    用語: ソーシャルワーカー
    NG文: ソーシャルワーカーは、相談援助を行う専門職。
    OK文: 独自の専門知識と技術を用い、利用者の相談援助を行う専門職の総称。
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
        let fixed = data.choices[0].message.content.trim();

        // Post-cleaning just in case
        fixed = fixed.replace(/^用語:.*?\n(OK文:|Output:)?\s*/s, '')
            .replace(/^OK文[:：]?\s*/, '')
            .replace(/^["「]/, '').replace(/["」]$/, '');

        return fixed;
    } catch (e) {
        console.error(`Failed to fix ${term}:`, e.message);
        return null;
    }
}

async function run() {
    console.log(`Loading ${TARGET_FILE}...`);
    let cards = JSON.parse(fs.readFileSync(TARGET_FILE, 'utf8'));

    console.log(`Checking ${cards.length} cards for leaked answers...`);

    let leakCount = 0;
    const cardsToFix = [];

    // First pass: identify leaks
    for (let i = 0; i < cards.length; i++) {
        if (leaksAnswer(cards[i].term, cards[i].definition)) {
            // console.log(`Leak detected in [${cards[i].term}]: ${cards[i].definition}`);
            cardsToFix.push(i);
            leakCount++;
        }
    }

    console.log(`Found ${leakCount} cards with leaked answers. Fixing...`);

    for (const index of cardsToFix) {
        const card = cards[index];
        process.stdout.write(`Fixing [${card.term}]... `);

        const fixedDef = await fixDefinition(card.term, card.definition, card.original_definition);

        if (fixedDef) {
            // Check if fix worked
            if (leaksAnswer(card.term, fixedDef)) {
                console.log("FAILED (Leak persists).");
            } else {
                card.definition = fixedDef;
                console.log("Fixed!");
            }
        } else {
            console.log("Error calling API.");
        }

        // await new Promise(r => setTimeout(r, 200));
    }

    fs.writeFileSync(TARGET_FILE, JSON.stringify(cards, null, 2), 'utf8');
    console.log(`Saved fixes to ${TARGET_FILE}`);
}

run();
