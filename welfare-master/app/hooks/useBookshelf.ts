import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/client';
import { questions } from '../db/schema';
// sql import removed as we use JS aggregation now
import { useFocusEffect } from 'expo-router';

export interface BookshelfItem {
    id: string; // usually year or group id
    title: string;
    type: 'past' | 'prediction';
    isLocked: boolean;
    progress: number;
    questionCount: number;
    masteredCount: number;
}

export function useBookshelf() {
    const [items, setItems] = useState<BookshelfItem[]>([]);
    const [loading, setLoading] = useState(true);

    const loadBookshelf = useCallback(async () => {
        try {
            // Fetch all questions first to avoid complex group-by SQL issues with Drizzle+Expo
            // For a few thousand records, this is performant enough and safer.
            const allQuestions = await db.select({
                year: questions.year,
                group: questions.group,
                isMastered: questions.isMastered,
            }).from(questions);

            // Aggregate in JS
            const groups: Record<string, { count: number, mastered: number, year: string | null }> = {};

            for (const q of allQuestions) {
                // Use year or group as key
                const key = q.year || q.group;
                if (!groups[key]) {
                    groups[key] = { count: 0, mastered: 0, year: q.year };
                }
                groups[key].count++;
                if (q.isMastered) {
                    groups[key].mastered++;
                }
            }

            const bookshelfItems: BookshelfItem[] = Object.entries(groups).map(([key, data]) => {
                const isPast = key.startsWith('past_') || !!data.year;
                const title = data.year
                    ? `過去問 (${data.year})`
                    : (key === 'common' ? '【AI予想】共通科目' : '【AI予想】専門科目');
                const type = isPast ? 'past' : 'prediction';

                return {
                    id: key,
                    title: title,
                    type: type as 'past' | 'prediction',
                    isLocked: !isPast, // Lock prediction questions
                    progress: data.count > 0 ? (data.mastered / data.count) : 0,
                    questionCount: data.count,
                    masteredCount: data.mastered
                };
            });

            // Filter out internal group IDs that don't match our display needs
            const validItems = bookshelfItems.filter(i =>
                i.title.includes('過去問') || i.title.includes('AI予想')
            );

            // Sort: Prediction questions first, then Past exams by year desc
            validItems.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'prediction' ? -1 : 1;
                }
                return b.title.localeCompare(a.title);
            });

            setItems(validItems);
        } catch (e) {
            console.error("Failed to load bookshelf", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadBookshelf();
        }, [loadBookshelf])
    );

    return { items, loading, refresh: loadBookshelf };
}
