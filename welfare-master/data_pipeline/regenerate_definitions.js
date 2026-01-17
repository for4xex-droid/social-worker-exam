
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

// Function to generate definition from scratch (or using context)
async function generateDescription(term, referenceDef) {
    const url = "https://api.openai.com/v1/chat/completions";

    // Prompt designed for consistency and "Exam Quality"
    const prompt = `
    あなたは「社会福祉士国家試験」の教材作成のプロフェッショナルです。
    以下の「用語」について、暗記カード（フラッシュカード）の「表面（問題文）」を作成してください。
    
    【対象用語】: ${term}
    【参考情報（元の解説）】: ${referenceDef || "なし"}
    
    【作成ルール】 - 厳守してください
    1. **40文字〜60文字以内**の日本語で記述すること。長すぎるとNGです。
    2. 文体は「〜のこと。」「〜制度。」「〜の総称。」のように、**体言止め**または簡潔な言い切りで統一すること。
    3. 「〜です」「〜ます」調は避けること。
    4. 問題文を見ただけで答え（用語）が一意に定まるように特徴を捉えること。
    5. 問題文の中に答えとなる「${term}」を含めないこと。
    6. 「正解は」などの前置きは一切書かないこと。解説文のみを出力してください。
    
    例：
    用語: ノーマライゼーション
    出力: 障害者も健常者と同様に、当たり前に生活できる社会を目指す考え方のこと。
    `;

    // Using gpt-3.5-turbo (or gpt-4 if available and cost permits, sticking to 3.5 for speed/cost balance unless instructed otherwise, but prompt is strict)
    // Providing referenceDef helps keep it grounded, but the prompt asks to act as a pro.

    const body = {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3, // Low temperature for consistency
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
            // handle 429 rate limit or others
            if (res.status === 429) return "RATE_LIMIT";
            const err = await res.text();
            throw new Error(`API Error ${res.status}: ${err}`);
        }

        const data = await res.json();
        return data.choices[0].message.content.trim();
    } catch (e) {
        console.error(`Failed to generate for ${term}:`, e.message);
        return null;
    }
}

async function run() {
    console.log(`Loading ${TARGET_FILE}...`);
    let cards = JSON.parse(fs.readFileSync(TARGET_FILE, 'utf8'));

    console.log(`Regenerating definitions for ${cards.length} terms...`);

    const updatedCards = [];
    let count = 0;

    for (const card of cards) {
        process.stdout.write(`[${count + 1}/${cards.length}] ${card.term}... `);

        let newDef = await generateDescription(card.term, card.original_definition);

        // Simple retry logic for rate limits
        if (newDef === "RATE_LIMIT") {
            console.log("Wait(Rate Limit)...");
            await new Promise(r => setTimeout(r, 2000));
            newDef = await generateDescription(card.term, card.original_definition);
        }

        if (newDef) {
            // Update the definition
            card.definition = newDef;
            console.log("Updated");
        } else {
            console.log("Failed (Keeping old)");
        }

        updatedCards.push(card);
        count++;
        // Tiny wait to prevent hammering
        await new Promise(r => setTimeout(r, 100));
    }

    fs.writeFileSync(TARGET_FILE, JSON.stringify(updatedCards, null, 2), 'utf8');
    console.log(`Saved regenerated flashcards to ${TARGET_FILE}`);
}

run();
