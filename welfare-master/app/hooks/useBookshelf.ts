import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/client';
import { questions } from '../db/schema';
import { useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import { and, or, eq, inArray } from 'drizzle-orm';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
            // Get variant from app config
            // Use extra.variant (defined in app.json/app.config.ts)
            const variant = Constants.expoConfig?.extra?.variant || 'social';

            // Define groups based on variant
            let targetGroups: string[] = [];

            if (variant === 'care') {
                targetGroups = ['past_kaigo', 'spec_care', 'common'];
            } else if (variant === 'social') {
                // Social: common + spec_social + past_social
                targetGroups = ['common', 'spec_social', 'past_social'];
            } else if (variant === 'mental') {
                // Mental: common + spec_mental + past_mental
                targetGroups = ['common', 'spec_mental', 'past_mental'];
            } else {
                targetGroups = ['common', 'spec_social', 'past_social'];
            }

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
                const isPast = q.group.startsWith('past_');

                // Key determination:
                // - Past exams: Group by YEAR (e.g. "令和4年度")
                // - Prediction: Group by GROUP_ID (e.g. "spec_social")
                // Since we filtered strictly by targetGroups, we won't mix Mental R4 with Social R4.
                const key = isPast ? (q.year || q.group) : q.group;

                if (!groups[key]) {
                    groups[key] = { count: 0, mastered: 0, year: isPast ? (q.year || null) : null };
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
                    // Ensure we handle the "全年度" case if key is just a group name
                    if (data.year) {
                        title = data.year.includes('年度') ? `過去問 (${data.year})` : `過去問 (${data.year}年度)`;
                    } else {
                        // Fallback for aggregate without year
                        title = '過去問 (全年度)';
                    }
                } else {
                    switch (key) {
                        case 'common': title = '【AI予想】共通科目'; break;
                        case 'spec_social': title = '【AI予想】専門科目 (社会)'; break;
                        case 'spec_mental': title = '【AI予想】専門科目 (精神)'; break;
                        case 'spec_care': title = '【AI予想】専門科目 (介護)'; break;
                        case 'past_kaigo': title = '介護福祉士 過去問'; break; // Fallback if year is missing
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
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadBookshelf();
        }, [loadBookshelf])
    );

    return { items, loading, refresh: loadBookshelf };
}
