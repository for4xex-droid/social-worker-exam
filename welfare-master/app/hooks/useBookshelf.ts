import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/client';
import { questions } from '../db/schema';
import { useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import { inArray } from 'drizzle-orm';
import { Platform } from 'react-native';

export interface BookshelfItem {
    id: string; // usually year or group id
    title: string;
    type: 'past' | 'prediction';
    isLocked: boolean;
    progress: number;
    questionCount: number;
    masteredCount: number;
    firstQuestionId?: string; // Optimistic logic
    group?: string;
}

export function useBookshelf() {
    const [items, setItems] = useState<BookshelfItem[]>([]);
    const [loading, setLoading] = useState(true);

    const loadBookshelf = useCallback(async () => {
        try {
            // Web: Wait for DB initialization (sql.js loading strategy)
            if (Platform.OS === 'web' && !db) {
                console.log("Web: DB not ready, retrying useBookshelf inside hook...");
                setTimeout(loadBookshelf, 1000); // Retry after 1s
                return;
            }

            // Get variant from app config
            const variant = Constants.expoConfig?.extra?.variant || 'social';

            // Define groups based on variant
            let targetGroups: string[] = [];

            if (variant === 'care') {
                targetGroups = ['past_kaigo', 'spec_care', 'common'];
            } else if (variant === 'social') {
                targetGroups = ['common', 'common_social', 'spec_social', 'past_social', 'past_social_34', 'past_social_35', 'past_social_36', 'past_social_37'];
            } else if (variant === 'mental') {
                targetGroups = ['common', 'common_social', 'spec_mental', 'past_mental'];
            } else {
                targetGroups = ['common', 'spec_social', 'past_social'];
            }

            // Fetch questions filtered by flavor groups
            // If db is still null here (e.g. fatal error), it will crash to catch block
            if (!db) throw new Error("Database client is not initialized");

            const allQuestions = await db.select({
                id: questions.id,
                year: questions.year,
                group: questions.group,
                categoryLabel: questions.categoryLabel,
                isMastered: questions.isMastered,
            })
                .from(questions)
                .where(inArray(questions.group, targetGroups));

            // Explicitly sort in memory using numeric extraction to guarantee order (1, 2... 10)
            const getIdNum = (id: string) => {
                const match = id.match(/_(\d+)$/);
                return match ? parseInt(match[1], 10) : 99999;
            };

            allQuestions.sort((a, b) => {
                // Sort by Group first
                if (a.group !== b.group) return a.group > b.group ? 1 : -1;
                // Then by ID number
                return getIdNum(a.id) - getIdNum(b.id);
            });

            console.log(`Web/Native: Loaded ${allQuestions.length} questions for bookshelf.`);
            console.log(`DEBUG: Variant=${variant}, TargetGroups=${JSON.stringify(targetGroups)}`);

            // Aggregate in JS
            const groups: Record<string, { count: number, mastered: number, year: string | null, group?: string, label?: string, firstQuestionId?: string }> = {};

            for (const q of allQuestions) {
                const isPast = q.group.startsWith('past_');
                // Key determination
                const isPrediction = !isPast;
                const label = q.categoryLabel || '未分類'; // Fallback

                // Grouping Logic Fix: Use more robust key
                const key = isPast
                    ? (q.year || q.group)
                    : `${q.group}::${label}`;

                if (!groups[key]) {
                    groups[key] = {
                        count: 0,
                        mastered: 0,
                        year: isPast ? (q.year || null) : null,
                        group: q.group,
                        label: isPrediction ? label : undefined,
                        firstQuestionId: q.id
                    };
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
                    if (data.year) {
                        title = data.year.includes('年度') ? `過去問 (${data.year})` : `過去問 (${data.year})`;
                    } else {
                        title = '過去問 (全年度)';
                    }
                } else {
                    if (data.label && data.label !== '未分類' && data.label !== '共通' && data.label !== 'None') {
                        title = data.label;
                    } else {
                        switch (data.group) {
                            case 'common': title = '【AI予想】共通科目'; break;
                            case 'common_social': title = '【AI予想】共通科目'; break;
                            case 'spec_social': title = '【AI予想】専門科目 (社会)'; break;
                            case 'spec_mental': title = '【AI予想】専門科目 (精神)'; break;
                            case 'spec_care': title = '【AI予想】専門科目 (介護)'; break;
                            default: title = `予想問題`;
                        }
                    }
                }

                const type = isPast ? 'past' : 'prediction';

                return {
                    id: key,
                    firstQuestionId: data.firstQuestionId,
                    title: title,
                    type: type as 'past' | 'prediction',
                    isLocked: false,
                    progress: data.count > 0 ? (data.mastered / data.count) : 0,
                    questionCount: data.count,
                    masteredCount: data.mastered,
                    group: data.group
                };
            });

            // Filter
            const validItems = bookshelfItems.filter(i => i.questionCount > 0);

            // Sort
            validItems.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'prediction' ? -1 : 1;
                }
                return b.id.localeCompare(a.id);
            });

            const debugTitles = validItems.map(i => `${i.id}(${i.group}): ${i.title}`);
            console.log(`DEBUG: Generated Items (${validItems.length}):`, JSON.stringify(debugTitles, null, 2));
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
