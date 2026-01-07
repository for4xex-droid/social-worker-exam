import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';
import { sql } from 'drizzle-orm';
import masterData from '../assets/master_database.json';

const DB_NAME = 'welfare_master.db';

const expoDb = openDatabaseSync(DB_NAME);
export const db = drizzle(expoDb, { schema });

/**
 * Initialize database and seed data
 */
export const initializeDb = async () => {
    try {
        console.log('Checking database status...');
        const result = await db.select().from(schema.questions).limit(1);

        // Even if not empty, we run seed to sync latest master_database.json changes
        // while preserving user progress thanks to onConflictDoUpdate
        await seedDatabase();

    } catch (e) {
        console.log('Error initializing DB, attempting recovery...', e);
        await createTables();
        await seedDatabase();
    }
};

const createTables = async () => {
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
}

const seedDatabase = async () => {
    const batchSize = 50;
    // @ts-ignore
    const data = masterData as any[];

    console.log(`Syncing ${data.length} questions from master data...`);

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

        // @ts-ignore
        await db.insert(schema.questions).values(batch).onConflictDoUpdate({
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
