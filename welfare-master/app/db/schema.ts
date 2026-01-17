import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const questions = sqliteTable('questions', {
    id: text('id').primaryKey(),
    questionText: text('question_text').notNull(),
    explanation: text('explanation').notNull(),
    options: text('options', { mode: 'json' }).notNull().$type<string[]>(),
    correctAnswer: text('correct_answer', { mode: 'json' }).notNull().$type<string[]>(),
    group: text('group_id').notNull(), // 'past_social', 'common', etc.
    year: text('year'),
    categoryLabel: text('category_label'),
    isFree: integer('is_free', { mode: 'boolean' }).notNull().default(false),
    isMastered: integer('is_mastered', { mode: 'boolean' }).default(false),
    correctStreak: integer('correct_streak').default(0),
});

export const userProgress = sqliteTable('user_progress', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    questionId: text('question_id').references(() => questions.id),
    isCorrect: integer('is_correct', { mode: 'boolean' }).notNull(),
    timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});

export const memorizationCards = sqliteTable('memorization_cards', {
    id: text('id').primaryKey(),
    term: text('term').notNull(), // The word to recall (Answer side)
    definition: text('definition').notNull(), // The meaning/question (Front side)
    group: text('group_id').notNull(), // 'common', 'spec', etc.
    categoryLabel: text('category_label'),

    // Learning State (Mutable)
    isMastered: integer('is_mastered', { mode: 'boolean' }).default(false),
    proficiency: integer('proficiency').default(0), // 0=New, 1=Weak... 5=Mastered
    lastReviewed: integer('last_reviewed', { mode: 'timestamp' }),
});

export const cardStudyLogs = sqliteTable('card_study_logs', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    cardId: text('card_id').references(() => memorizationCards.id),
    result: text('result').notNull(), // 'ok', 'ng'
    timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});
