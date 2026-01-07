import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/client';
import { questions } from '../db/schema';
import { useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import { and, or, eq, inArray } from 'drizzle-orm';

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

    const flavor = Constants.expoConfig?.extra?.flavor || 'social';

    const loadBookshelf = useCallback(async () => {
        try {
            // Define groups relevant to current flavor
            // common is always included
            const targetGroups = ['common'];
            if (flavor === 'social') targetGroups.push('spec_social', 'past_social');
            if (flavor === 'mental') targetGroups.push('spec_mental', 'past_mental');
            if (flavor === 'care') targetGroups.push('spec_care', 'past_care');

            // Fetch questions filtered by flavor groups
            const allQuestions = await db.select({
                year: questions.year,
                group: questions.group,
                isMastered: questions.isMastered,
            })
                .from(questions)
                .where(inArray(questions.group, targetGroups));

            // Aggregate in JS
            const groups: Record<string, { count: number, mastered: number, year: string | null }> = {};

            for (const q of allQuestions) {
                // Determine if this is a past question: either by group prefix or existence of year
                const isPast = !!q.year || q.group.startsWith('past_');

                // For past questions, use the year as key. If year is missing, use group.
                // For prediction, use group.
                const key = isPast ? (q.year || q.group) : q.group;

                if (!groups[key]) {
                    groups[key] = { count: 0, mastered: 0, year: isPast ? (q.year || q.group) : null };
                }
                groups[key].count++;
                if (q.isMastered) {
                    groups[key].mastered++;
                }
            }

            const bookshelfItems: BookshelfItem[] = Object.entries(groups).map(([key, data]) => {
                const isPast = !!data.year;

                let title = '';
                if (isPast) {
                    // Try to format the title nicely if it's a year string
                    title = data.year?.includes('年度') ? `過去問 (${data.year})` : `過去問 (${key})`;
                } else {
                    switch (key) {
                        case 'common': title = '【AI予想】共通科目'; break;
                        case 'spec_social': title = '【AI予想】専門科目 (社会)'; break;
                        case 'spec_mental': title = '【AI予想】専門科目 (精神)'; break;
                        case 'spec_care': title = '【AI予想】専門科目 (介護)'; break;
                        default: title = `予想問題 (${key})`;
                    }
                }

                const type = isPast ? 'past' : 'prediction';

                return {
                    id: key,
                    title: title,
                    type: type as 'past' | 'prediction',
                    isLocked: !isPast, // Lock prediction questions (paid content)
                    progress: data.count > 0 ? (data.mastered / data.count) : 0,
                    questionCount: data.count,
                    masteredCount: data.mastered
                };
            });

            // Filter
            const validItems = bookshelfItems.filter(i => i.questionCount > 0);

            // Sort: Prediction questions first, then Past exams by year desc
            validItems.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'prediction' ? -1 : 1;
                }
                return b.id.localeCompare(a.id); // Simple sort for now
            });

            setItems(validItems);
        } catch (e) {
            console.error("Failed to load bookshelf", e);
        } finally {
            setLoading(false);
        }
    }, [flavor]);

    useFocusEffect(
        useCallback(() => {
            loadBookshelf();
        }, [loadBookshelf])
    );

    return { items, loading, refresh: loadBookshelf };
}
