
const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, 'master_database.json');
const OUTPUT_FILE = path.join(__dirname, '../app/assets/flashcards.json');

function generateFlashcards() {
    console.log(`Loading ${INPUT_FILE}...`);

    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`Error: ${INPUT_FILE} not found.`);
        return;
    }

    const rawData = fs.readFileSync(INPUT_FILE, 'utf8');
    const data = JSON.parse(rawData);

    console.log(`Processing ${data.length} questions...`);

    const flashcards = [];
    let generatedCount = 0;

    for (const item of data) {
        // 1. Get Candidate Term (Correct Answer)
        const correctAnswers = item.correct_answer || [];
        if (!correctAnswers.length) continue;

        let term = correctAnswers[0];
        if (typeof term !== 'string') continue;
        term = term.trim();

        // --- Strict Filter 1: Term Quality ---
        // Must be short (Max 15 chars)
        if (term.length > 15) continue;

        // Must NOT contain punctuation
        if (/[。、，．「」]/.test(term)) continue;

        // Must NOT end with sentence-like particles
        if (term.endsWith('こと') || term.endsWith('ある') || term.endsWith('ない') ||
            term.endsWith('した') || term.endsWith('から') || term.endsWith('ため')) {
            continue;
        }

        // Filter 2: Explanation must exist
        const explanation = item.explanation;
        if (!explanation || explanation.length < 10) continue;

        // --- Strict Filter 3: Explanation quality (One Sentence Rule) ---
        // Split by full stop "。"
        // Note: positive lookbehind equivalent in JS split is slightly tricky, 
        // so we'll just split and append "。" back if needed, or just split.
        const sentences = explanation.split('。');

        let targetSentence = null;

        for (let s of sentences) {
            s = s.trim();
            if (!s) continue;

            // Add back the full stop for completeness? Or keep without?
            // Usually definitions in cards end with "。"
            // Let's assume we append "。" later if missing.

            if (s.includes(term)) {
                // Check 1: Is this just "The answer is Term"?
                if (s.startsWith("正解は") && s.length < term.length + 15) {
                    continue;
                }

                // Check 2: Length limit (Max 80 chars)
                if (s.length > 80) continue;

                targetSentence = s;

                // Preference
                if (s.startsWith("なぜなら")) {
                    break;
                }
            }
        }

        if (!targetSentence) continue;

        // Cleanup
        let definition = targetSentence;
        // Remove "正解は...です" prefix
        definition = definition.replace(/^正解は.*?(です|ます)[。]?/, '').trim();
        definition = definition.replace(/^なぜなら、?/, '').trim();

        if (!definition || !definition.includes(term)) continue;

        // Length check strict
        if (definition.length > 70 || definition.length < 10) continue;

        // Append "。" if missing
        if (!definition.endsWith('。')) definition += '。';

        // Create Cloze
        // Escape special regex chars in term
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const frontText = definition.replace(new RegExp(escapedTerm, 'g'), "【　？　】");

        const card = {
            id: `card_${item.id}`,
            term: term,
            definition: frontText,
            group_id: item.group || 'common',
            category_label: item.category_label || '未分類',
            source_question_id: item.id,
            original_explanation: explanation
        };

        flashcards.push(card);
        generatedCount++;
    }

    console.log(`Generated ${generatedCount} flashcards.`);

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(flashcards, null, 2), 'utf8');
    console.log(`Saved to ${OUTPUT_FILE}`);
}

generateFlashcards();
