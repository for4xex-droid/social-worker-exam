import * as schema from './schema';
import { sql } from 'drizzle-orm';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';

const DB_NAME = 'welfare_master_v26_social_clean.db';

// 実行時に動的に読み込む（トップレベルでは読み込まない）
let expoDb: any = null;
export let db: any = null;

const getDb = () => {
    if (db) return db;

    // Native Only
    try {
        // トップレベルでのインポートを避けるため、requireを使用
        console.log("[db] Require expo-sqlite...");
        const { openDatabaseSync } = require('expo-sqlite');
        console.log("[db] Require drizzle-orm...");
        const { drizzle } = require('drizzle-orm/expo-sqlite');

        if (!expoDb) {
            console.log("[db] Opening database sync...");
            expoDb = openDatabaseSync(DB_NAME);
            console.log("[db] Database opened.");
        }

        if (expoDb && !db) {
            console.log("[db] Initializing Drizzle...");
            db = drizzle(expoDb, { schema });
            console.log("[db] Drizzle initialized.");
        }
        return db;
    } catch (e) {
        console.error("[db] Failed to load ExpoSQLite Native Module:", e);
        return null;
    }
};

// Native does not need manual save
export const saveDb = async () => {
    // No-op for native sqlite
};

export const initializeDb = async () => {
    const currentDb = getDb();
    if (!currentDb || !expoDb) {
        console.log('Database not available.');
        return;
    }

    try {
        // For development/debugging: Force reset if needed
        // In production, we would use migration versioning
        const FORCE_RESET = false;

        if (FORCE_RESET) {
            console.log("[db] FORCE RESET: Dropping tables...");
            await currentDb.run(sql`DROP TABLE IF EXISTS questions`);
        }

        // まずテーブルを作成
        console.log("[db] Creating tables...");
        await createTables();

        console.log('[db] Checking database status...');
        const result = await currentDb.select({ count: sql`count(*)` }).from(schema.questions);
        const count = (result[0] as any).count || 0;
        console.log(`[db] Current question count: ${count}`);

        if (true || count === 0) {
            console.log("[db] Seeding/Syncing database...");
            await seedDatabase();
        } else {
            console.log(`[db] Database already has ${count} questions.`);
        }

        // Check for mental past questions
        const mentalPastCountResult = await currentDb.select({ count: sql`count(*)` })
            .from(schema.questions)
            .where(sql`group_id = 'past_mental'`);
        const mentalPastCount = (mentalPastCountResult[0] as any).count || 0;
        console.log(`[db] Current mental past count: ${mentalPastCount}`);

        if (mentalPastCount === 0) {
            console.log("[db] Seeding Mental Past Questions...");
            await seedMentalPastQuestions();
        }

        // Check for mental special questions (New)
        const mentalSpecCountResult = await currentDb.select({ count: sql`count(*)` })
            .from(schema.questions)
            .where(sql`group_id = 'spec_mental'`);
        const mentalSpecCount = (mentalSpecCountResult[0] as any).count || 0;
        console.log(`[db] Current mental special count: ${mentalSpecCount}`);

        if (mentalSpecCount === 0) {
            console.log("[db] Seeding Mental Special Questions...");
            await seedMentalSpecialQuestions();
        }

        // Flashcards Seeding Logic
        const flashcardCountResult = await currentDb.select({ count: sql`count(*)` }).from(schema.memorizationCards);
        const flashcardCount = (flashcardCountResult[0] as any).count || 0;
        console.log(`[db] Current flashcard count: ${flashcardCount}`);

        // FORCE RELOAD for Development/Update cycle
        console.log("[db] Checking flashcards updates...");
        // Always seed if count is 0, or if we want to force update (commented out in prod usually)
        if (flashcardCount === 0) {
            console.log("[db] Seeding/Updating flashcards...");
            await seedFlashcards();
        }

    } catch (e) {
        console.log('[db] Error initializing DB, creating tables...', e);
        await createTables();
        await seedDatabase();
        await seedMentalPastQuestions();
        await seedFlashcards();
    }
};

const createTables = async () => {
    if (!expoDb) return;
    await expoDb.execAsync(`
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY NOT NULL,
        question_text TEXT NOT NULL,
        explanation TEXT NOT NULL,
        options TEXT NOT NULL,
        correct_answer TEXT NOT NULL,
        group_id TEXT NOT NULL,
        year TEXT,
        category_label TEXT,
        is_free INTEGER DEFAULT 0 NOT NULL,
        is_mastered INTEGER DEFAULT 0,
        correct_streak INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS user_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id TEXT REFERENCES questions(id),
        is_correct INTEGER NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memorization_cards (
        id TEXT PRIMARY KEY NOT NULL,
        term TEXT NOT NULL,
        definition TEXT NOT NULL,
        group_id TEXT NOT NULL,
        category_label TEXT,
        is_mastered INTEGER DEFAULT 0,
        proficiency INTEGER DEFAULT 0,
        last_reviewed INTEGER
      );
      CREATE TABLE IF NOT EXISTS card_study_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_id TEXT REFERENCES memorization_cards(id),
        result TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);
    console.log('Tables created.');
};

const seedDatabase = async () => {
    const currentDb = getDb();
    if (!currentDb) return;

    console.log("Seeding database...");

    try {
        // Load the verified and cleaned dataset based on Variant
        const variant = Constants.expoConfig?.extra?.variant;
        console.log(`[db] Seeding database for variant: ${variant}`);

        let specData: any[] = [];
        let commonData: any[] = [];

        try {
            if (variant === 'social') {
                specData = require('../assets/separated_db/master_social.json');
            } else if (variant === 'mental') {
                specData = require('../assets/separated_db/master_mental.json');
            } else if (variant === 'care') {
                specData = require('../assets/separated_db/master_care.json');
            } else {
                specData = require('../assets/separated_db/master_social.json');
            }
        } catch (e) {
            console.warn(`[db] Spec DB load failed: ${e}`);
        }

        try {
            // Check if common db exists (it might not exist yet if reorganize hasn't run)
            commonData = require('../assets/separated_db/master_common.json');
            console.log(`[db] Loaded Common DB: ${commonData.length} items.`);
        } catch (e) {
            console.log("[db] Common DB not found (yet).");
        }

        let dailyData: any[] = [];
        try {
            dailyData = require('../assets/separated_db/master_daily.json');
            console.log(`[db] Loaded Daily Pool: ${dailyData.length} items.`);
        } catch (e) {
            console.log("[db] Daily DB not found (yet).");
        }

        const data = [...specData, ...commonData, ...dailyData];

        const batchSize = 50;
        // const data is already defined above
        console.log(`[db] SEEDING NEW MASTER DATA. Items: ${data.length}`);
        if (data.length > 0) console.log(`[db] First Item Group: ${data[0].group}`);

        for (let i = 0; i < data.length; i += batchSize) {
            try {
                const batch = data.slice(i, i + batchSize).map(item => ({
                    id: String(item.id),
                    // Handle both raw (snake_case) and normalized (camelCase) formats
                    questionText: item.questionText || item.question_text,
                    explanation: item.explanation || "",
                    options: item.options,
                    correctAnswer: item.correctAnswer || item.correct_answer,
                    group: item.group || item.group_id || 'common',
                    year: item.year,
                    categoryLabel: (item.categoryLabel || item.category_label || "").replace(/_part_\d+/gi, "").replace(/_vol_\d+/gi, "").replace(/（\d+）/g, "").trim(),
                    isFree: (item.isFree !== undefined ? item.isFree : (item.is_free ? true : false)),
                }));

                await currentDb.insert(schema.questions).values(batch).onConflictDoUpdate({
                    target: schema.questions.id,
                    set: {
                        questionText: sql`excluded.question_text`,
                        explanation: sql`excluded.explanation`,
                        options: sql`excluded.options`,
                        correctAnswer: sql`excluded.correct_answer`,
                        group: sql`excluded.group_id`,
                        year: sql`excluded.year`,
                        categoryLabel: sql`excluded.category_label`,
                        isFree: sql`excluded.is_free`,
                    }
                });
            } catch (batchErr) {
                console.error(`[db] Batch insert failed at index ${i}:`, batchErr);
            }
        }
    } catch (e) {
        console.error("Failed to prepare seeding", e);
    }
    console.log(`Database sync completed.`);
};

const seedMentalPastQuestions = async () => {
    const currentDb = getDb();
    if (!currentDb) return;

    try {
        console.log("[db] Loading mental_past_questions.json...");
        const pastData = require("../assets/mental_past_questions.json");
        console.log(`[db] Found ${pastData.length} mental past questions.`);

        const batchSize = 50;
        for (let i = 0; i < pastData.length; i += batchSize) {
            const batch = pastData.slice(i, i + batchSize).map((item: any) => ({
                id: String(item.id),
                questionText: item.question_text,
                explanation: item.explanation || "解説は準備中です。",
                options: item.options,
                correctAnswer: item.correct_answer,
                group: 'past_mental',
                year: item.year,
                categoryLabel: item.categoryLabel || item.category_label,
                isFree: true
            }));

            await currentDb.insert(schema.questions).values(batch).onConflictDoUpdate({
                target: schema.questions.id,
                set: {
                    questionText: sql`excluded.question_text`,
                    explanation: sql`excluded.explanation`,
                    options: sql`excluded.options`,
                    correctAnswer: sql`excluded.correct_answer`,
                    group: sql`excluded.group_id`,
                    year: sql`excluded.year`,
                    categoryLabel: sql`excluded.category_label`,
                    isFree: sql`excluded.is_free`,
                }
            });
        }
        console.log("[db] Mental past questions seeded successfully.");
    } catch (e) {
        console.error("[db] Error seeding mental past questions:", e);
        // Fallback or ignore if file missing
    }
};

const seedMentalSpecialQuestions = async () => {
    const currentDb = getDb();
    if (!currentDb) return;

    try {
        console.log("[db] Preparing to import mental_data.db asset...");

        // 1. Load Asset
        const asset = Asset.fromModule(require("../assets/mental_data.db"));
        await asset.downloadAsync();
        if (!asset.localUri) throw new Error("Assets download failed.");

        // 2. Setup paths
        const sqliteDir = FileSystem.documentDirectory + 'SQLite';
        if (!(await FileSystem.getInfoAsync(sqliteDir)).exists) {
            await FileSystem.makeDirectoryAsync(sqliteDir);
        }
        const importDbPath = sqliteDir + '/mental_import.db';

        // 3. Copy to working directory
        const fileInfo = await FileSystem.getInfoAsync(importDbPath);
        if (fileInfo.exists) {
            await FileSystem.deleteAsync(importDbPath);
        }
        await FileSystem.copyAsync({ from: asset.localUri, to: importDbPath });

        // 4. Open Import DB
        const { openDatabaseSync } = require('expo-sqlite');
        const importDb = openDatabaseSync('mental_import.db');

        // 5. Check count
        const countRes = importDb.getFirstSync('SELECT count(*) as c FROM questions');
        const total = countRes ? countRes.c : 0;
        console.log(`[db] Import DB contains ${total} questions. Starting migration...`);

        // 6. Batch Insert
        const BATCH_SIZE = 500;
        for (let offset = 0; offset < total; offset += BATCH_SIZE) {
            const rows = importDb.getAllSync(`SELECT * FROM questions LIMIT ${BATCH_SIZE} OFFSET ${offset}`);

            const batch = rows.map((r: any) => ({
                id: String(r.id),
                questionText: r.questionText,
                explanation: r.explanation,
                options: JSON.parse(r.options),
                correctAnswer: JSON.parse(r.correctAnswer),
                group: r.group,
                year: r.year,
                categoryLabel: r.categoryLabel,
                isFree: Boolean(r.isFree)
            }));

            await currentDb.insert(schema.questions).values(batch).onConflictDoUpdate({
                target: schema.questions.id,
                set: {
                    questionText: sql`excluded.question_text`,
                    explanation: sql`excluded.explanation`,
                    options: sql`excluded.options`,
                    correctAnswer: sql`excluded.correct_answer`,
                    group: sql`excluded.group_id`,
                    year: sql`excluded.year`,
                    categoryLabel: sql`excluded.category_label`,
                    isFree: sql`excluded.is_free`
                }
            });
        }

        // 7. Cleanup
        importDb.closeSync();
        await FileSystem.deleteAsync(importDbPath);
        console.log("[db] Mental special questions imported successfully via SQLite asset.");

    } catch (e) {
        console.error("[db] Error importing mental DB:", e);
    }
};

const seedFlashcards = async () => {
    const currentDb = getDb();
    if (!currentDb) return;

    try {
        console.log("[db] Loading flashcards.json...");
        const flashcardsData = require('../assets/flashcards.json');
        console.log(`[db] Found ${flashcardsData.length} flashcards.`);

        // Clear existing flashcards to reflect updates
        console.log("[db] Clearing existing flashcards...");
        await currentDb.run(sql`DELETE FROM memorization_cards`);

        const batchSize = 100;
        for (let i = 0; i < flashcardsData.length; i += batchSize) {
            const batch = flashcardsData.slice(i, i + batchSize).map((item: any) => ({
                id: item.id,
                term: item.term,
                definition: item.definition,
                group: item.group_id,
                categoryLabel: item.category_label,
            }));

            await currentDb.insert(schema.memorizationCards).values(batch).onConflictDoUpdate({
                target: schema.memorizationCards.id,
                set: {
                    term: sql`excluded.term`,
                    definition: sql`excluded.definition`,
                    group: sql`excluded.group_id`,
                    categoryLabel: sql`excluded.category_label`
                }
            });
        }
        console.log("[db] Flashcards seeded successfully.");
    } catch (e) {
        console.error("[db] Error seeding flashcards:", e);
    }
};
