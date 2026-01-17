import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Brain, Lock, ChevronRight, AlertCircle, BookOpen } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useEffect } from 'react';
import { db } from '../../db/client';
import { questions, userProgress } from '../../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { usePremium } from '../../constants/premium';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME } from '../../constants/Config';
import clsx from 'clsx';

export default function WeaknessSelectScreen() {
    const router = useRouter();
    const { isPremium, loading: premiumLoading } = usePremium();
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState<any[]>([]);

    useEffect(() => {
        loadWeaknessData();
    }, []);

    const loadWeaknessData = async () => {
        setLoading(true);
        try {
            // 1. Get IDs of questions user has attempted
            const progress = await db.select({ id: userProgress.questionId }).from(userProgress);
            const attemptedSet = new Set(progress.map((p: any) => p.id));

            if (attemptedSet.size === 0) {
                setCategories([]);
                setLoading(false);
                return;
            }

            // 2. Get unmastered questions that have been attempted
            const unmastered = await db.select({
                id: questions.id,
                group: questions.group,
                categoryLabel: questions.categoryLabel,
                year: questions.year,
                title: questions.questionText // Just to have something if needed, mainly need metadata
            }).from(questions).where(eq(questions.isMastered, false));

            // Filter in JS
            const weaknessQuestions = unmastered.filter(q => attemptedSet.has(q.id));

            // 3. Group by Category
            const groups: {
                [key: string]: {
                    id: string,
                    title: string,
                    count: number,
                    group: string,
                    year?: string,
                    categoryLabel?: string
                }
            } = {};

            weaknessQuestions.forEach(q => {
                let key = '';
                let title = '';

                if (q.year) {
                    key = `past_${q.year}`;
                    title = `過去問 ${q.year}`;
                } else if (q.categoryLabel) {
                    key = `cat_${q.group}_${q.categoryLabel}`;
                    title = q.categoryLabel;
                } else {
                    key = 'other';
                    title = '未分類';
                }

                if (!groups[key]) {
                    groups[key] = {
                        id: key,
                        title: title,
                        count: 0,
                        group: q.group,
                        year: q.year || undefined,
                        categoryLabel: q.categoryLabel || undefined
                    };
                }
                groups[key].count++;
            });

            // Convert to array and sort
            const result = Object.values(groups).sort((a, b) => {
                // Past exams first, then by count descending
                if (a.group === 'past' && b.group !== 'past') return -1;
                if (a.group !== 'past' && b.group === 'past') return 1;
                return b.count - a.count;
            });

            setCategories(result);

        } catch (e) {
            console.error("Failed to load weakness data", e);
        } finally {
            setLoading(false);
        }
    };

    const handlePress = async (item: any) => {
        // Premium Check
        const isPast = item.group === 'past' || (item.year !== undefined);
        if (!isPast && !isPremium) {
            router.push('/purchase');
            return;
        }

        const mode = 'weakness';

        // Resolve Queue
        // We need to fetch the actual IDs for this category again? 
        // Or cleaner: pass filter params to quiz logic. But current logic relies on a queue in AsyncStorage.
        // Let's refetch IDs here.

        try {
            // Re-fetch IDs for this specific target
            let targetQs;
            if (item.year) {
                targetQs = await db.select({ id: questions.id }).from(questions).where(and(eq(questions.year, item.year), eq(questions.isMastered, false)));
            } else if (item.categoryLabel) {
                targetQs = await db.select({ id: questions.id }).from(questions).where(and(eq(questions.group, item.group), eq(questions.categoryLabel, item.categoryLabel), eq(questions.isMastered, false)));
            } else {
                // Fallback
                return;
            }

            // Re-filter attempted
            const progress = await db.select({ id: userProgress.questionId }).from(userProgress);
            const attemptedSet = new Set(progress.map((p: any) => p.id));
            const finalIds = targetQs.map((q: any) => q.id).filter((id: string) => attemptedSet.has(id));

            if (finalIds.length === 0) {
                alert("復習が必要な問題はありません！");
                return;
            }

            await AsyncStorage.setItem('@quiz_queue', JSON.stringify(finalIds));
            await AsyncStorage.setItem('@quiz_mode', 'weakness');
            await AsyncStorage.setItem('@quiz_session_correct_count', '0');

            router.push(`/quiz/${finalIds[0]}?mode=weakness`);

        } catch (e) {
            console.error(e);
        }
    };

    const brandColor = THEME.colors.primary;

    return (
        <SafeAreaView className="flex-1 bg-[#F8FAFC]" edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View className="px-6 py-4 flex-row items-center justify-between bg-white shadow-sm z-10">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 bg-slate-50 rounded-full items-center justify-center border border-slate-100"
                >
                    <ArrowLeft size={20} color="#64748b" />
                </TouchableOpacity>
                <Text className="text-xl font-black text-slate-900">苦手分析・克服</Text>
                <View className="w-10" />
            </View>

            <ScrollView className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 40 }}>
                <View className="bg-red-50 p-4 rounded-2xl mb-6 flex-row items-center border border-red-100">
                    <AlertCircle size={24} color="#EF4444" className="mr-3" />
                    <View className="flex-1">
                        <Text className="text-red-800 font-bold text-sm leading-relaxed">
                            間違えた問題や、まだ定着していない問題がここに集められます。カテゴリを選んで集中特訓しましょう。
                        </Text>
                    </View>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color={brandColor} className="mt-10" />
                ) : categories.length === 0 ? (
                    <View className="items-center justify-center py-20 opacity-50">
                        <Brain size={64} color="#CBD5E1" />
                        <Text className="text-slate-400 font-bold mt-4 text-base">
                            苦手な問題は見つかりませんでした！
                        </Text>
                        <Text className="text-slate-400 text-xs mt-1">
                            素晴らしい！この調子で学習を進めましょう。
                        </Text>
                    </View>
                ) : (
                    categories.map((item, index) => {
                        const isPast = item.group === 'past' || (item.year !== undefined);
                        const isLocked = !isPast && !isPremium;

                        return (
                            <TouchableOpacity
                                key={item.id}
                                onPress={() => handlePress(item)}
                                activeOpacity={0.7}
                                className="bg-white rounded-2xl p-5 mb-3 border border-slate-100 shadow-sm flex-row items-center"
                            >
                                <View className={clsx(
                                    "w-12 h-12 rounded-xl items-center justify-center mr-4",
                                    isPast ? "bg-slate-100" : "bg-red-50"
                                )}>
                                    {isPast ? (
                                        <BookOpen size={20} color="#64748B" />
                                    ) : (
                                        <Brain size={20} color="#EF4444" />
                                    )}
                                </View>

                                <View className="flex-1">
                                    <View className="flex-row items-center mb-1">
                                        {isPast && (
                                            <View className="bg-slate-100 px-2 py-0.5 rounded text-[10px] mr-2">
                                                <Text className="text-slate-500 font-bold">過去問</Text>
                                            </View>
                                        )}
                                        <Text className="font-bold text-slate-800 text-base flex-1" numberOfLines={1}>
                                            {item.title.replace(/^PSW専\d+[ 　]*/, '')}
                                        </Text>
                                    </View>
                                    <Text className="text-slate-400 text-xs font-bold">
                                        苦手: <Text className="text-red-500 text-sm">{item.count}問</Text>
                                    </Text>
                                </View>

                                {isLocked ? (
                                    <View className="w-8 h-8 bg-slate-900 rounded-full items-center justify-center">
                                        <Lock size={14} color="white" />
                                    </View>
                                ) : (
                                    <View className="w-8 h-8 bg-slate-50 rounded-full items-center justify-center border border-slate-100">
                                        <ChevronRight size={16} color="#CBD5E1" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
