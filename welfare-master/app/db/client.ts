import * as schema from './schema';
import { sql } from 'drizzle-orm';
import { Platform } from 'react-native';

const DB_NAME = 'welfare_master_v3.db';

// 実行時に動的に読み込む（トップレベルでは読み込まない）
let expoDb: any = null;
export let db: any = null;

const getDb = () => {
    if (db) return db;
    if (Platform.OS === 'web') return null;

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

export const initializeDb = async () => {
    if (Platform.OS === 'web') return;

    const currentDb = getDb();
    if (!currentDb || !expoDb) {
        console.log('Database not available.');
        return;
    }

    try {
        // For development/debugging: Force reset if needed
        // In production, we would use migration versioning
        const FORCE_RESET = true;

        if (FORCE_RESET) {
            console.log("[db] FORCE RESET: Dropping tables...");
            await currentDb.run(sql`DROP TABLE IF EXISTS questions`);
            await currentDb.run(sql`DROP TABLE IF EXISTS user_progress`);
        }

        // まずテーブルを作成
        console.log("[db] Creating tables...");
        await createTables();

        console.log('[db] Checking database status...');
        const result = await currentDb.select({ count: sql`count(*)` }).from(schema.questions);
        const count = (result[0] as any).count || 0;
        console.log(`[db] Current question count: ${count}`);

        if (count === 0) {
            console.log("[db] Seeding needed.");
            await seedDatabase();
        } else {
            console.log(`[db] Database already has ${count} questions.`);

            // Check if we need to force reload (e.g. if new master data is available)
            const FORCE_RELOAD_DB = false;
            if (FORCE_RELOAD_DB && count < 4000) { // Simple heuristic
                console.log("[db] Force reloading database...");
                await seedDatabase();
            }
        }
    } catch (e) {
        console.log('[db] Error initializing DB, creating tables...', e);
        await createTables();
        await seedDatabase();
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
    `);
    console.log('Tables created.');
};

const seedDatabase = async () => {
    const currentDb = getDb();
    if (!currentDb) return;

    console.log("Seeding database...");

    try {
        // Try to load the normalized asset first
        let masterData;
        try {
            masterData = require("../assets/master_data.json");
            console.log("[db] Loading normalized master_data.json");
        } catch (e) {
            console.log("[db] Normalized data not found, falling back to raw if possible.");
            masterData = require("../assets/master_database.json");
        }

        const batchSize = 50;
        const data = masterData as any[];

        console.log(`[db] Found ${data.length} items to seed.`);

        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize).map(item => ({
                id: String(item.id),
                // Handle both raw (snake_case) and normalized (camelCase) formats
                questionText: item.questionText || item.question_text,
                explanation: item.explanation,
                options: item.options,
                correctAnswer: item.correctAnswer || item.correct_answer,
                group: item.group || item.group_id || 'common',
                year: item.year,
                categoryLabel: item.categoryLabel || item.category_label,
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
        }
    } catch (e) {
        console.error("Failed to seed database", e);
    }
    console.log(`Database sync completed.`);
};
