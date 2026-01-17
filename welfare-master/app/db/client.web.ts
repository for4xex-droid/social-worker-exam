import { Platform } from 'react-native';
import { drizzle } from 'drizzle-orm/sql-js';
import * as schema from './schema';
import Constants from 'expo-constants';

// polyfill
if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && !window.setImmediate) {
        // @ts-ignore
        window.setImmediate = (callback: any) => setTimeout(callback, 0);
    }
}

// Export the Drizzle instance
export let db: any = null;

export const saveDb = async () => {
    console.log("Web: Save skipped");
};

export const initializeDb = async () => {
    if (Platform.OS !== 'web') return;
    if (db) return;

    try {
        // @ts-ignore
        const initSqlJs = (await import('sql.js')).default;
        const SQL = await initSqlJs({
            locateFile: (file: string) => `/${file}`
        });

        const sqliteDb = new SQL.Database();


        // Safe Reset: Create then Delete
        sqliteDb.run(`CREATE TABLE IF NOT EXISTS questions (
            id TEXT PRIMARY KEY,
            question_text TEXT NOT NULL,
            explanation TEXT NOT NULL,
            options TEXT NOT NULL, 
            correct_answer TEXT NOT NULL, 
            group_id TEXT NOT NULL,
            year TEXT,
            category_label TEXT,
            is_free INTEGER DEFAULT 0,
            is_mastered INTEGER DEFAULT 0,
            correct_streak INTEGER DEFAULT 0
        );`);

        sqliteDb.run(`CREATE TABLE IF NOT EXISTS memorization_cards (
            id TEXT PRIMARY KEY,
            term TEXT NOT NULL,
            definition TEXT NOT NULL,
            group_id TEXT NOT NULL,
            category_label TEXT,
            is_mastered INTEGER DEFAULT 0,
            proficiency INTEGER DEFAULT 0,
            last_reviewed INTEGER
        );`);

        try {
            // Helper for inserting questions - optimized with transactions
            const insertQuestions = (data: any[]) => {
                console.log(`Web: Inserting ${data.length} questions...`);
                let successCount = 0;
                const BATCH_SIZE = 100;

                for (let i = 0; i < data.length; i += BATCH_SIZE) {
                    const chunk = data.slice(i, i + BATCH_SIZE);
                    try {
                        sqliteDb.run("BEGIN TRANSACTION");
                        for (const q of chunk) {
                            const qText = q.question_text || q.questionText || "";
                            const expl = q.explanation || "";
                            const opts = (typeof q.options === 'string')
                                ? q.options
                                : JSON.stringify(q.options || []);
                            let corr = q.correct_answer || q.correctAnswer || "";
                            // Ensure correct_answer is valid JSON for Drizzle (mode: 'json')
                            if (Array.isArray(corr)) {
                                corr = JSON.stringify(corr);
                            } else if (typeof corr === 'string') {
                                // Handle comma-separated answers like "1,2" -> ["1","2"]
                                if (corr.includes(',')) {
                                    corr = JSON.stringify(corr.split(',').map(s => s.trim()));
                                } else {
                                    // Single answer like "1" -> ["1"]
                                    corr = JSON.stringify([corr.trim()]);
                                }
                            } else {
                                corr = JSON.stringify([]);
                            }
                            const grp = q.group_id || q.group || "unknown";
                            const yr = q.year || "";
                            const cat = q.category_label || q.categoryLabel || "";
                            const free = (q.is_free || q.isFree) ? 1 : 0;

                            sqliteDb.run(`INSERT OR REPLACE INTO questions 
                                (id, question_text, explanation, options, correct_answer, group_id, year, category_label, is_free, is_mastered, correct_streak)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [q.id, qText, expl, opts, corr, grp, yr, cat, free, 0, 0]
                            );
                            successCount++;
                        }
                        sqliteDb.run("COMMIT");
                    } catch (e) {
                        console.error("Batch failed, trying individual inserts for this chunk", e);
                        try { sqliteDb.run("ROLLBACK"); } catch (re) { }

                        // Fallback: Try individually
                        sqliteDb.run("BEGIN TRANSACTION");
                        for (const q of chunk) {
                            try {
                                const qText = q.question_text || q.questionText || "";
                                const expl = q.explanation || "";
                                const opts = (typeof q.options === 'string') ? q.options : JSON.stringify(q.options || []);
                                let corr = q.correct_answer || q.correctAnswer || "";
                                if (Array.isArray(corr)) {
                                    corr = JSON.stringify(corr);
                                } else if (typeof corr === 'string') {
                                    if (corr.includes(',')) {
                                        corr = JSON.stringify(corr.split(',').map((s: string) => s.trim()));
                                    } else {
                                        corr = JSON.stringify([corr.trim()]);
                                    }
                                } else {
                                    corr = JSON.stringify([]);
                                }
                                const grp = q.group_id || q.group || "unknown";
                                const yr = q.year || "";
                                const cat = q.category_label || q.categoryLabel || "";
                                const free = (q.is_free || q.isFree) ? 1 : 0;

                                sqliteDb.run(`INSERT OR REPLACE INTO questions 
                                    (id, question_text, explanation, options, correct_answer, group_id, year, category_label, is_free, is_mastered, correct_streak)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                    [q.id, qText, expl, opts, corr, grp, yr, cat, free, 0, 0]
                                );
                                successCount++;
                            } catch (ie) {
                                if (q.id && q.id.includes('ss37')) {
                                    // @ts-ignore
                                    if (!window['__hasAlertedError']) {
                                        // @ts-ignore
                                        window['__hasAlertedError'] = true;
                                        alert(`R6 Data Insert Error (${q.id}): ${ie}`);
                                    }
                                }
                            }
                        }
                        sqliteDb.run("COMMIT");
                    }
                }
                console.log(`Web: Successfully inserted ${successCount}/${data.length} questions.`);
            };

            // 1. Load Common Questions (Compact)
            console.log("Web: Fetching web_common.json...");
            const resCommon = await fetch('/web_common.json?t=' + Date.now());
            if (resCommon.ok) {
                const data = await resCommon.json();
                console.log(`Web: Loaded ${data.length} common questions.`);
                insertQuestions(data);
            } else {
                console.warn("Web: Failed to fetch web_common.json");
            }

            // 1.5 Load Daily Mission Pool
            console.log("Web: Fetching web_daily.json...");
            try {
                const resDaily = await fetch('/web_daily.json?t=' + Date.now());
                if (resDaily.ok) {
                    const data = await resDaily.json();
                    console.log(`Web: Loaded ${data.length} daily pool items.`);
                    insertQuestions(data);
                }
            } catch (e) { console.warn("Web: Daily load failed", e); }

            // 2. Load Cards
            console.log("Web: Fetching web_cards.json...");
            const resCards = await fetch('/web_cards.json?t=' + Date.now());
            if (resCards.ok) {
                const cardData = await resCards.json();
                console.log(`Web: Loaded ${cardData.length} cards.`);

                sqliteDb.run("BEGIN TRANSACTION");
                const stmtCard = sqliteDb.prepare(`INSERT OR REPLACE INTO memorization_cards (
                    id, term, definition, group_id, category_label, is_mastered, proficiency, last_reviewed
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

                for (const c of cardData) {
                    const term = c.term || "";
                    const def = c.definition || "";
                    const grp = c.group_id || c.group || "common";
                    const cat = c.category_label || c.categoryLabel || "";
                    stmtCard.run([c.id, term, def, grp, cat, 0, 0, null]);
                }
                stmtCard.free();
                sqliteDb.run("COMMIT");
            } else {
                console.warn("Web: Failed to fetch web_cards.json");
            }

            // 3. Variant Specific Data
            const variant = Constants.expoConfig?.extra?.variant;
            if (variant === 'social') {
                try {
                    console.log("Web: Fetching web_past_social.json...");
                    const res = await fetch('/web_past_social.json?t=' + Date.now());
                    if (res.ok) {
                        const data = await res.json();
                        console.log(`Web: Loaded ${data.length} social past questions.`);
                        insertQuestions(data);
                    } else {
                        console.warn("Web: Failed to fetch web_past_social.json");
                    }

                    // Social Special
                    console.log("Web: Fetching web_spec_social.json...");
                    const resSpec = await fetch('/web_spec_social_v3.json?t=' + Date.now());
                    if (resSpec.ok) {
                        const dataSpec = await resSpec.json();
                        console.log(`Web: Loaded ${dataSpec.length} social special questions.`);
                        insertQuestions(dataSpec);
                    }
                } catch (e) {
                    console.warn("Web: Failed to load social past data", e);
                }
            } else if (variant === 'mental') {
                try {
                    // Mental Special (Split Loading)
                    console.log("Web: Fetching mental special chunks...");
                    let chunkIndex = 0;
                    while (true) {
                        try {
                            const chunkUrl = `/web_spec_mental_${chunkIndex}.json?t=` + Date.now();
                            const res = await fetch(chunkUrl);
                            if (!res.ok) break; // Stop when 404

                            const data = await res.json();
                            console.log(`Web: Loaded chunk ${chunkIndex} with ${data.length} questions.`);
                            insertQuestions(data);
                            chunkIndex++;

                            if (chunkIndex > 20) break; // Safety limit
                        } catch (e) {
                            console.warn(`Web: Error loading mental chunk ${chunkIndex}`, e);
                            break;
                        }
                    }
                    console.log(`Web: Total ${chunkIndex} chunks loaded.`);

                    // Mental Past
                    console.log("Web: Fetching web_past_mental.json...");
                    const resPast = await fetch('/web_past_mental.json?t=' + Date.now());
                    if (resPast.ok) {
                        const dataPast = await resPast.json();
                        console.log(`Web: Loaded ${dataPast.length} mental past questions.`);
                        insertQuestions(dataPast);
                    }
                } catch (e) {
                    console.warn("Web: Failed to load mental special/past data", e);
                }
            }

        } catch (err) {
            console.error("Web: Data load error", err);
        }

        db = drizzle(sqliteDb, { schema });

    } catch (e) {
        console.error("Web: Critical init error", e);
    }
};
