import { View, Text, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrendingUp, CheckCircle2, Target, Calendar, Brain, Award, BarChart3, ChevronRight, Crown, Lock, Lightbulb } from 'lucide-react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import clsx from 'clsx';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { db } from '../../db/client';
import { userProgress, questions } from '../../db/schema';
import { count, eq, and, sql, desc, isNotNull, or, inArray } from 'drizzle-orm';
import { THEME } from '../../constants/Config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePremium } from '../../constants/premium';
import { formatCategoryName } from '../../utils/categoryFormatter';

const { width } = Dimensions.get('window');

// Jewel Gradient Definitions
const JEWEL_STYLES = [
    { gradient: ['#3B82F6', '#2DD4BF'], shadow: '#3B82F6' }, // Sapphire
    { gradient: ['#8B5CF6', '#D946EF'], shadow: '#8B5CF6' }, // Amethyst
    { gradient: ['#10B981', '#34D399'], shadow: '#10B981' }, // Emerald
    { gradient: ['#F59E0B', '#FBBF24'], shadow: '#F59E0B' }, // Topaz
    { gradient: ['#EF4444', '#FB7185'], shadow: '#EF4444' }, // Ruby
    { gradient: ['#6366F1', '#A5B4FC'], shadow: '#6366F1' }, // Indigo
];

const StatCardSmall = ({ title, value, unit, icon: Icon, style, delay = 0, onPress }: any) => (
    <MotiView
        from={{ opacity: 0, scale: 0.9, transform: [{ translateY: 20 }] }}
        animate={{ opacity: 1, scale: 1, transform: [{ translateY: 0 }] }}
        transition={{ delay, type: 'spring', damping: 20, stiffness: 100 } as any}
        style={{ width: (width - 56) / 2, marginBottom: 12, height: 90 }}
    >
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            className="bg-white rounded-[26px] p-2.5 shadow-xl shadow-slate-200/40 border border-slate-50 flex-row items-center h-full"
        >
            <LinearGradient
                colors={style.gradient as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="w-11 h-11 rounded-[18px] items-center justify-center mr-2.5"
                style={{
                    shadowColor: style.shadow,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 5
                }}
            >
                <Icon size={20} color="white" />
            </LinearGradient>
            <View className="flex-1 justify-center">
                <Text className="text-slate-400 text-[11px] font-black mb-0.5" numberOfLines={1}>{title}</Text>
                <View className="flex-row items-baseline">
                    <Text className="text-[19px] font-black text-slate-800 leading-tight">{value}</Text>
                    {unit && <Text className="text-slate-400 text-[10px] font-bold ml-1">{unit}</Text>}
                </View>
            </View>
        </TouchableOpacity>
    </MotiView>
);

export default function AnalyticsScreen() {
    const brandColor = THEME.colors.primary;
    const router = useRouter();

    // Premium state
    const { isPremium, loading: premiumLoading } = usePremium();

    const [stats, setStats] = useState({
        total: 0,
        correctRate: 0,
        streak: 0,
        mastered: 0
    });
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [weakestCategory, setWeakestCategory] = useState<string | null>(null);

    const fetchStats = useCallback(async () => {
        try {
            // 1. Core Stats
            const totalResult = await db.select({ val: count() }).from(userProgress);
            const total = totalResult[0]?.val || 0;

            const correctResult = await db.select({ val: count() }).from(userProgress).where(eq(userProgress.isCorrect, true));
            const correct = correctResult[0]?.val || 0;

            const rate = total > 0 ? Math.round((correct / total) * 100) : 0;

            const masteredResult = await db.select({ val: count() }).from(questions).where(eq(questions.isMastered, true));
            const masteredCount = masteredResult[0]?.val || 0;

            // 2. Streak
            const history = await db.select({ date: userProgress.timestamp }).from(userProgress).orderBy(desc(userProgress.timestamp)).limit(500);
            let streak = 0;
            if (history.length > 0) {
                const uniqueDays = new Set(history.map((h: any) => new Date(h.date as any).toDateString()));
                const sortedDays = Array.from(uniqueDays).sort((a: any, b: any) => new Date(b as any).getTime() - new Date(a as any).getTime());

                const today = new Date().toDateString();
                const yesterday = new Date(Date.now() - 86400000).toDateString();

                if (sortedDays[0] === today || sortedDays[0] === yesterday) {
                    streak = 1;
                    for (let i = 0; i < sortedDays.length - 1; i++) {
                        const current = new Date(sortedDays[i] as any);
                        const next = new Date(sortedDays[i + 1] as any);
                        const diff = (current.getTime() - next.getTime()) / 86400000;
                        if (diff <= 1.1) streak++; else break;
                    }
                }
            }

            // 3. Category Strength
            const catProgress = await db.select({
                label: questions.categoryLabel,
                isCorrect: userProgress.isCorrect,
            }).from(userProgress)
                .innerJoin(questions, eq(userProgress.questionId, questions.id))
                .where(isNotNull(questions.categoryLabel));

            const catMap: Record<string, { total: number, correct: number }> = {};
            catProgress.forEach((item: any) => {
                const label = item.label || 'その他';
                if (!catMap[label]) catMap[label] = { total: 0, correct: 0 };
                catMap[label].total++;
                if (item.isCorrect) catMap[label].correct++;
            });

            const sortedCats = Object.entries(catMap)
                .map(([name, data], idx) => ({
                    name,
                    progress: Math.round((data.correct / data.total) * 100),
                    total: data.total,
                    style: JEWEL_STYLES[idx % JEWEL_STYLES.length]
                }))
                .sort((a, b) => b.progress - a.progress);

            let displayCats: any[] = [];
            if (sortedCats.length > 0) {
                if (sortedCats.length === 1) {
                    displayCats = [{ ...sortedCats[0], tag: 'latest' }];
                } else {
                    const best = { ...sortedCats[0], tag: 'strong' };
                    const worst = { ...sortedCats[sortedCats.length - 1], tag: 'weak' };
                    displayCats = [best, worst];
                }
            }

            setCategories(displayCats);
            if (sortedCats.length > 0) {
                setWeakestCategory(sortedCats[sortedCats.length - 1].name);
            }

            setStats({
                total,
                correctRate: rate,
                streak,
                mastered: masteredCount
            });
        } catch (err) {
            console.error("Failed to fetch analytics:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchStats();
        }, [fetchStats])
    );

    const handleStartWeaknessQuest = async () => {
        if (!isPremium) {
            router.push('/purchase');
            return;
        }
        try {
            const attemptedResult = await db.select({ id: userProgress.questionId }).from(userProgress);
            const attemptedIds = new Set(attemptedResult.map((r: any) => String(r.id)));
            const query = db.select({ id: questions.id }).from(questions);
            let reviewCandidates;

            if (weakestCategory) {
                reviewCandidates = await query.where(and(
                    eq(questions.isMastered, false),
                    eq(questions.categoryLabel, weakestCategory),
                    inArray(questions.id, Array.from(attemptedIds) as string[])
                )).limit(10);
            }
            if (!reviewCandidates || reviewCandidates.length === 0) {
                reviewCandidates = await query.where(and(
                    eq(questions.isMastered, false),
                    inArray(questions.id, Array.from(attemptedIds) as string[])
                )).limit(10);
            }
            if (reviewCandidates.length === 0) return;
            const ids = reviewCandidates.map((q: any) => q.id);
            await AsyncStorage.setItem('@quiz_queue', JSON.stringify(ids));
            await AsyncStorage.setItem('@quiz_mode', 'weakness');
            await AsyncStorage.setItem('@quiz_session_correct_count', '0');
            router.push(`/quiz/${ids[0]}?mode=weakness`);
        } catch (e) { console.error(e); }
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center">
                <ActivityIndicator color={brandColor} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
            <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                <View className="pt-4 pb-4 flex-row items-center justify-between">
                    <View>
                        <Text className="text-3xl font-black text-slate-900">学習統計</Text>
                        <Text className="text-slate-500 text-xs font-bold mt-1">これまでの歩みを振り返る</Text>
                    </View>
                    <TouchableOpacity
                        className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 active:bg-slate-50"
                        onPress={() => router.push('/analytics/introduction')}
                    >
                        <Lightbulb size={24} color={brandColor} />
                    </TouchableOpacity>
                </View>

                <View className="flex-row flex-wrap justify-between mb-2">
                    <StatCardSmall
                        title="総解答数"
                        value={stats.total.toLocaleString()}
                        unit="問"
                        icon={TrendingUp}
                        style={{ gradient: ['#3B82F6', '#2DD4BF'], shadow: '#3B82F6' }}
                        delay={100}
                        onPress={() => router.push({ pathname: '/analytics/history/[type]', params: { type: 'total' } })}
                    />
                    <StatCardSmall
                        title="正解率"
                        value={stats.correctRate}
                        unit="%"
                        icon={CheckCircle2}
                        style={{ gradient: ['#10B981', '#34D399'], shadow: '#10B981' }}
                        delay={200}
                        onPress={() => router.push({ pathname: '/analytics/history/[type]', params: { type: 'rate' } })}
                    />
                    <StatCardSmall
                        title="連続学習"
                        value={stats.streak}
                        unit="日"
                        icon={Calendar}
                        style={{ gradient: ['#8B5CF6', '#D946EF'], shadow: '#8B5CF6' }}
                        delay={300}
                        onPress={() => router.push({ pathname: '/analytics/history/[type]', params: { type: 'streak' } })}
                    />
                    <StatCardSmall
                        title="マスター済"
                        value={stats.mastered}
                        unit="問"
                        icon={Award}
                        style={{ gradient: ['#F59E0B', '#FBBF24'], shadow: '#F59E0B' }}
                        delay={400}
                        onPress={() => router.push({ pathname: '/analytics/history/[type]', params: { type: 'mastered' } })}
                    />
                </View>

                <View className="mb-4 flex-1">
                    <View className="flex-row items-center justify-between mb-2 px-1">
                        <View className="flex-row items-center gap-2">
                            <Text className="text-lg font-black text-slate-800">苦手・得意分析</Text>
                            <View className="bg-orange-100 px-1.5 py-0.5 rounded-full flex-row items-center">
                                <Crown size={10} color="#FF6B00" />
                                <Text className="text-[9px] font-black text-orange-600 ml-1 uppercase">PRO</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={() => isPremium ? router.push('/analytics/details') : router.push('/purchase')}
                        >
                            <Text className="text-blue-500 font-bold text-sm">詳細</Text>
                        </TouchableOpacity>
                    </View>

                    {isPremium ? (
                        <View className="w-full">
                            {categories.length === 0 ? (
                                <View className="bg-white p-4 rounded-xl items-center w-full border border-slate-100">
                                    <Text className="text-slate-400 text-xs font-bold">データがありません</Text>
                                </View>
                            ) : (
                                categories.map((item, index) => (
                                    <View
                                        key={index}
                                        className="bg-white px-4 py-3 rounded-xl mb-2 border border-slate-100 flex-row items-center w-full"
                                    >
                                        <LinearGradient
                                            colors={item.style.gradient as any}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            className="w-8 h-8 rounded-lg items-center justify-center mr-3"
                                        >
                                            <Target size={16} color="white" />
                                        </LinearGradient>
                                        <View className="flex-1">
                                            <View className="flex-row justify-between items-center mb-1">
                                                <View className="flex-row items-center gap-2">
                                                    <Text className="font-bold text-slate-700 text-sm" numberOfLines={1}>{formatCategoryName(item.name)}</Text>
                                                    {item.tag === 'strong' && (
                                                        <View className="bg-blue-100 px-1.5 rounded">
                                                            <Text className="text-blue-600 text-[10px] font-black">得意</Text>
                                                        </View>
                                                    )}
                                                    {item.tag === 'weak' && (
                                                        <View className="bg-red-100 px-1.5 rounded">
                                                            <Text className="text-red-600 text-[10px] font-black">苦手</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text className="font-black text-slate-900 text-sm">{item.progress}%</Text>
                                            </View>
                                            <View className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <LinearGradient
                                                    colors={item.style.gradient as any}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 0 }}
                                                    className="h-full rounded-full"
                                                    style={{ width: `${item.progress}%` }}
                                                />
                                            </View>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    ) : (
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => router.push('/purchase')}
                            className="bg-slate-100 rounded-xl p-3 flex-row items-center border border-slate-200"
                        >
                            <View className="flex-1 flex-row items-center">
                                <View className="w-7 h-7 bg-slate-200 rounded-lg mr-2" />
                                <View className="flex-1">
                                    <View className="h-2.5 bg-slate-200 rounded w-2/3 mb-1.5" />
                                    <View className="h-1.5 bg-slate-200 rounded w-full" />
                                </View>
                            </View>
                            <View className="bg-slate-900 px-3 py-1.5 rounded-full flex-row items-center shadow-sm ml-3">
                                <Lock size={12} color="white" />
                                <Text className="text-white font-black text-[10px] tracking-wider ml-1.5">PREMIUM</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                </View>

                <MotiView
                    from={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 500 }}
                    className="bg-slate-900 p-5 rounded-[24px] mb-4 shadow-xl shadow-slate-200"
                >
                    <View className="flex-row items-center justify-between mb-3">
                        <View className="flex-row items-center">
                            <Image
                                source={require('../../assets/images/ai_instructor.png')}
                                className="w-10 h-10 rounded-full mr-3 border-2 border-slate-700"
                                resizeMode="cover"
                            />
                            <Text className="text-white font-black text-base">AI指導教官</Text>
                        </View>
                        <View className="bg-orange-500/20 px-2 py-0.5 rounded-full">
                            <Text className="text-[9px] font-black text-orange-400 uppercase">
                                {isPremium ? "Analysis" : "PRO"}
                            </Text>
                        </View>
                    </View>

                    {isPremium ? (
                        <>
                            <View className="min-h-[40px] justify-center">
                                <Text className="text-slate-300 leading-6 font-medium text-sm w-full" numberOfLines={4}>
                                    {weakestCategory
                                        ? `「${formatCategoryName(weakestCategory)}」の正解率が低迷しています。重点的に復習しましょう。`
                                        : "データを蓄積すれば、あなたの傾向に合わせた最適なアドバイスが表示されます。"
                                    }
                                </Text>
                            </View>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={handleStartWeaknessQuest}
                                className="mt-4 py-3 rounded-xl items-center bg-white"
                            >
                                <Text className="text-slate-900 font-black text-xs">
                                    対策を開始
                                </Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => router.push('/purchase')}
                            className="items-center py-4"
                        >
                            <Text className="text-slate-500 text-sm font-bold mb-4 text-center">
                                あなたの学習データを分析し、{'\n'}最適なアドバイスを提供します
                            </Text>
                            <View className="bg-white/10 px-4 py-2 rounded-full flex-row items-center border border-white/20">
                                <Lock size={14} color="white" />
                                <Text className="text-white font-black text-xs tracking-wider ml-2">プレミアムで解放</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                </MotiView>
            </ScrollView>
        </SafeAreaView>
    );
}
