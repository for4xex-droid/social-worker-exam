const fs = require('fs');
const path = require('path');

const INPUT_FILES = [
    "app/assets/past_social_complete.json",
    "app/assets/master_data.json",
    "app/assets/master_database_v3.json",
    "app/assets/master_database_v10_normalized.json",
    "app/assets/mental_special.json",
    "app/assets/mental_special_lite.json",
    "app/assets/social_spec_part7.json"
].map(p => path.join(__dirname, p));

const OUTPUT_DIR = "app/assets/separated_db";

const SOCIAL_SPEC_KEYWORDS = [
    "福祉サービスの組織と経営", "高齢者福祉", "高齢者に対する支援", "介護保険制度",
    "児童・家庭福祉", "児童や家庭に対する支援", "貧困に対する支援", "低所得者に対する支援",
    "保健医療と福祉", "保健医療サービス",
    "ソーシャルワークの理論と方法", "ソーシャルワーク演習",
    "更生保護制度", "就労支援サービス"
];
const SOCIAL_FOLDER_CODES = ["SW専", "社会専門"];

const MENTAL_SPEC_KEYWORDS = [
    "精神疾患とその治療", "精神保健の課題と支援", "精神保健福祉相談援助の基盤",
    "精神保健福祉の理論と相談援助",
    "精神保健", "精神障害"
];
const MENTAL_FOLDER_CODES = ["精神専", "精神専門", "PSW"];

const CARE_SPEC_KEYWORDS = [
    "介護の基本", "介護過程", "発達と老化の理解", "認知症の理解", "障害の理解",
    "こころとからだのしくみ", "医療的ケア", "生活支援技術"
];
const CARE_FOLDER_CODES = ["介護専", "介護専門"];

function main() {
    console.log("Starting Database Reorganization (Node.js) - STRICT MODE + NORMALIZATION...");

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const uniqueQuestions = new Map();

    for (const fpath of INPUT_FILES) {
        if (!fs.existsSync(fpath)) continue;
        console.log(`Loading ${fpath}...`);
        try {
            const raw = fs.readFileSync(fpath, 'utf-8');
            const data = JSON.parse(raw);

            const isMentalSpecSource = fpath.includes('mental_special');
            const isSocialSpecSource = fpath.includes('social_spec');
            const isLegacyMixed = fpath.includes('master_database_v3') || fpath.includes('master_data.json') || fpath.includes('master_database_v10');
            const isNewPast = fpath.includes('past_social_complete.json');

            for (const q of data) {
                const qText = q.question_text || "";
                if (!qText || qText.length < 5) continue;

                // FIX: Remove legacy 'ps_' intruder data for recent years
                if (q.id && typeof q.id === 'string' && q.id.startsWith('ps_')) {
                    if (q.id.includes('R6') || q.id.includes('R5') || q.id.includes('R4') || q.id.includes('_37_')) {
                        continue;
                    }
                }

                if (isNewPast) {
                    q.source_tag = 'official_scrape';
                } else {
                    const gid = q.group_id || "";
                    const cat = q.category_label || "";
                    if ((gid.includes('past_social') || gid.includes('past_common') || cat.includes('過去問')) && !gid.includes('mental') && !fpath.includes('mental')) {
                        continue;
                    }
                }

                if (!q.source_tag) {
                    if (isMentalSpecSource) q.source_tag = 'mental_spec_file';
                    else if (isSocialSpecSource) q.source_tag = 'social_spec_file';
                    else if (isLegacyMixed) q.source_tag = 'legacy_mixed';
                }

                let uniqueKey = qText;
                // FIX: Use ID for official scrape to prevent deduping questions with same text (e.g. scrape errors)
                if (q.source_tag === 'official_scrape') {
                    uniqueKey = q.id || q.question_number || qText;
                }

                if (uniqueQuestions.has(uniqueKey)) {
                    // Start of Selection
                    const existing = uniqueQuestions.get(uniqueKey);
                    // Prioritize official scrape
                    if (q.source_tag === 'official_scrape') {
                        uniqueQuestions.set(uniqueKey, q);
                    }
                    // End of Selection
                } else {
                    uniqueQuestions.set(uniqueKey, q);
                }
            }
        } catch (e) {
            console.error(`  Error loading ${fpath}: ${e.message}`);
        }
    }

    console.log(`Total Unique Questions: ${uniqueQuestions.size}`);

    const dbSocial = [];
    const dbMental = [];
    const dbCare = [];
    const dbCommon = [];
    const dbDaily = [];

    for (const q of uniqueQuestions.values()) {
        const qStr = JSON.stringify(q);
        let cat = q.category_label || "";

        cat = cat.replace(/_part_\d+/gi, "")
            .replace(/_vol_\d+/gi, "")
            .replace(/（\d+）/g, "")
            .trim();

        // NORMALIZATION
        // 1. Remove leading numbers (e.g., '1医学概論', '12 ソーシャルワーク')
        cat = cat.replace(/^\d+\s?/, "");

        // 2. Remove suffixes like '(2)', '（共通）'
        cat = cat.replace(/\s?\(2\)/, "").replace(/（共通）/, "");

        // 3. Unify variations based on official subject names
        if (cat.includes('地域福祉') && cat.includes('包括')) cat = '地域福祉と包括的支援体制';
        if (cat === '障害福祉') cat = '障害者福祉';
        if (cat === '心理学と心理的支援') cat = '心理学理論と心理的支援';
        if (cat === '社会学と社会システム') cat = '社会理論と社会システム';
        if (cat === '社会福祉調査の基礎') cat = '社会調査の基礎'; // Official name

        q.category_label = cat;

        if (q.source_tag === 'official_scrape') {
            dbSocial.push(q);
            continue;
        }

        // DAILY MISSION CHECK
        if (cat === '共通科目（総合）' || cat === '総合問題') {
            q.group_id = 'daily_pool';
            q.category_label = 'HIDDEN_DAILY';
            dbDaily.push(q);
            continue;
        }

        let isSocial = false;
        let isMental = false;
        let isCare = false;

        if (SOCIAL_FOLDER_CODES.some(c => cat.includes(c)) && !cat.includes("精神") && !cat.includes("PSW")) isSocial = true;
        if (MENTAL_FOLDER_CODES.some(c => cat.includes(c))) isMental = true;
        if (CARE_FOLDER_CODES.some(c => cat.includes(c))) isCare = true;

        if (!isSocial && !isMental && !isCare) {
            if (q.source_tag === 'social_spec_file') isSocial = true;
            if (q.source_tag === 'mental_spec_file') isMental = true;
        }

        if (!isSocial && !isMental && !isCare) {
            if (SOCIAL_SPEC_KEYWORDS.some(k => cat.includes(k))) isSocial = true;
            else if (MENTAL_SPEC_KEYWORDS.some(k => cat.includes(k))) isMental = true;
            else if (CARE_SPEC_KEYWORDS.some(k => cat.includes(k))) isCare = true;
        }

        if (!isSocial && !isMental && !isCare) {
            dbCommon.push(q);
        } else {
            if (isSocial) dbSocial.push(q);
            if (isMental) dbMental.push(q);
            if (isCare) dbCare.push(q);
        }
    }

    console.log(`Social Spec DB: ${dbSocial.length}`);
    console.log(`Mental Spec DB: ${dbMental.length}`);
    console.log(`Care Spec DB: ${dbCare.length}`);
    console.log(`Common DB: ${dbCommon.length}`);
    console.log(`Daily DB: ${dbDaily.length}`);

    // SORTING
    const sorter = (a, b) => (a.id > b.id) ? 1 : -1;
    dbSocial.sort(sorter);
    dbMental.sort(sorter);
    dbCare.sort(sorter);
    dbCommon.sort(sorter);
    dbDaily.sort(sorter);

    fs.writeFileSync(path.join(OUTPUT_DIR, "master_social.json"), JSON.stringify(dbSocial, null, 2));
    fs.writeFileSync(path.join(OUTPUT_DIR, "master_mental.json"), JSON.stringify(dbMental, null, 2));
    fs.writeFileSync(path.join(OUTPUT_DIR, "master_care.json"), JSON.stringify(dbCare, null, 2));
    fs.writeFileSync(path.join(OUTPUT_DIR, "master_common.json"), JSON.stringify(dbCommon, null, 2));
    fs.writeFileSync(path.join(OUTPUT_DIR, "master_daily.json"), JSON.stringify(dbDaily, null, 2));
}

main();
