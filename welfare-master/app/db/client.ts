import * as schema from './schema';
import { sql } from 'drizzle-orm';
import { Platform } from 'react-native';

const DB_NAME = 'welfare_master.db';

// 実行時に動的に読み込む（トップレベルでは読み込まない）
let expoDb: any = null;
export let db: any = null;

const getDb = () => {
    if (db) return db;
    if (Platform.OS === 'web') return null;

    try {
        // トップレベルでのインポートを避けるため、requireを使用
        const { openDatabaseSync } = require('expo-sqlite');
        const { drizzle } = require('drizzle-orm/expo-sqlite');

        if (!expoDb) {
            expoDb = openDatabaseSync(DB_NAME);
        }

        if (expoDb && !db) {
            db = drizzle(expoDb, { schema });
        }
        return db;
    } catch (e) {
        console.error("Failed to load ExpoSQLite Native Module:", e);
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
        // まずテーブルを作成
        await createTables();

        console.log('Checking database status...');
        const result = await currentDb.select({ count: sql`count(*)` }).from(schema.questions);
        const count = (result[0] as any).count || 0;

        if (count === 0) {
            await seedDatabase();
        } else {
            console.log(`Database already has ${count} questions.`);
        }
    } catch (e) {
        console.log('Error initializing DB, creating tables...', e);
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
    const masterData = require("../assets/master_database.json");
    const batchSize = 50;
    const data = masterData as any[];

    for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize).map(item => ({
            id: String(item.id),
            questionText: item.question_text,
            explanation: item.explanation,
            options: item.options,
            correctAnswer: item.correct_answer,
            group: item.group,
            year: item.year,
            categoryLabel: item.category_label,
            isFree: item.is_free ? 1 : 0,
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
    console.log(`Database sync completed.`);
};
