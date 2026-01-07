import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import masterData from '../assets/master_database.json';

const DB_NAME = 'welfare_master.db';

const expoDb = openDatabaseSync(DB_NAME);
export const db = drizzle(expoDb, { schema });

/**
 * Initialize database and seed data if empty
 */
export const initializeDb = async () => {
    try {
        // Check if table exists (simple check)
        // In production, better to use migrations, but for this prototype we'll check rows
        const result = await db.select().from(schema.questions).limit(1);

        if (result.length === 0) {
            console.log('Database empty, seeding master data...');
            await seedDatabase();
        } else {
            console.log('Database already initialized.');
        }
    } catch (e) {
        console.log('Error initializing DB (likely first run), attempting seed...', e);
        // If select fails, tables likely don't exist. Drizzle Kit usually handles migration generation,
        // but for Expo without migrations setup, we might need a raw query or ensure tables created.
        // For this prototype, we rely on Drizzle's push or manual table creation if needed.
        // However, with `drizzle-orm` and `expo-sqlite`, we often need to run migrations.
        // Let's create tables manually for simplicity in this swift prototype phase.
        await createTables();
        await seedDatabase();
    }
};

const createTables = async () => {
    // Manual table creation for "No Migrations" setup (Prototype speedup)
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
    const batchSize = 100;
    // @ts-ignore
    const data = masterData as typeof schema.questions.$inferInsert[];

    for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize).map(item => ({
            id: item.id,
            questionText: item.question_text,
            explanation: item.explanation,
            options: item.options,
            correctAnswer: item.correct_answer,
            group: item.group,
            year: item.year,
            categoryLabel: item.category_label,
            isFree: item.is_free,
        }));

        // @ts-ignore
        await db.insert(schema.questions).values(batch).onConflictDoNothing();
    }
    console.log(`Seeded ${data.length} questions successfully.`);
};
