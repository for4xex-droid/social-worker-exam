
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Brain, Sparkles, BookOpen, Target, ArrowRight, ArrowLeft } from 'lucide-react-native';
import { useState, useCallback } from 'react';
import { db } from '../../db/client';
import { memorizationCards } from '../../db/schema';
import { sql } from 'drizzle-orm';
import { LinearGradient } from 'expo-linear-gradient';
import { usePremium } from '../../constants/premium';

export default function FlashcardsHome() {
    const router = useRouter();
    const { isPremium, loading: premiumLoading } = usePremium();

    const [stats, setStats] = useState({
        total: 0,
        mastered: 0,
        weak: 0,
        new: 0
    });

    // Redirect non-premium users
    useFocusEffect(
        useCallback(() => {
            if (!premiumLoading && !isPremium) {
                router.replace('/purchase');
            }
        }, [isPremium, premiumLoading])
    );

    useFocusEffect(
        useCallback(() => {
            const fetchStats = async () => {
                if (!db) return;
                try {
                    const result = await db.select({
                        total: sql`count(*)`,
                        mastered: sql`sum(case when is_mastered = 1 then 1 else 0 end)`,
                        weak: sql`sum(case when proficiency < 3 and last_reviewed is not null and is_mastered = 0 then 1 else 0 end)`,
                        new: sql`sum(case when last_reviewed is null then 1 else 0 end)`
                    }).from(memorizationCards);

                    const data = result[0];
                    setStats({
                        total: Number(data.total || 0),
                        mastered: Number(data.mastered || 0),
                        weak: Number(data.weak || 0),
                        new: Number(data.new || 0)
                    });
                } catch (e) {
                    console.error(e);
                }
            };

            // Fetch on focus
            if (isPremium) fetchStats();
        }, [isPremium])
    );

    const modes = [
        {
            id: 'new',
            title: '新規未学習',
            subtitle: `${stats.new} 単語`,
            icon: BookOpen,
            color: '#3B82F6',
            bg: 'bg-blue-50',
            border: 'border-blue-200',
            iconBg: 'bg-blue-100'
        },
        {
            id: 'weak',
            title: '苦手克服',
            subtitle: `${stats.weak} 単語`,
            icon: Target,
            color: '#F59E0B',
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            iconBg: 'bg-amber-100'
        },
        {
            id: 'master_review',
            title: 'マスター復習',
            subtitle: `${stats.mastered} 単語`,
            icon: Sparkles,
            color: '#10B981',
            bg: 'bg-green-50',
            border: 'border-green-200',
            iconBg: 'bg-green-100'
        }
    ];

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView className="flex-1">
                {/* Header Section */}
                <LinearGradient
                    colors={['#FFF7ED', '#FFF']}
                    className="px-6 pt-12 pb-8 rounded-b-[40px] shadow-sm mb-6"
                >
                    <View className="flex-row items-center justify-center mb-4 relative">
                        <TouchableOpacity
                            onPress={() => router.back()}
                            className="absolute left-0 w-10 h-10 bg-white rounded-full items-center justify-center shadow-sm active:bg-slate-50 z-10"
                        >
                            <ArrowLeft size={20} color="#64748B" />
                        </TouchableOpacity>

                        <Text className="text-xl font-black text-slate-800 tracking-tight">単語カード</Text>
                    </View>
                    <Text className="text-slate-500 font-medium leading-6 text-center">
                        スキマ時間で効率よく暗記。{'\n'}
                        独自アルゴリズムで定着をサポートします。
                    </Text>

                    <View className="mt-6 flex-row gap-4">
                        <View className="flex-1 bg-white p-4 rounded-2xl border border-slate-100 items-center shadow-sm">
                            <Text className="text-3xl font-black text-slate-800">{stats.mastered}</Text>
                            <Text className="text-xs font-bold text-slate-400 mt-1">覚えた</Text>
                        </View>
                        <View className="flex-1 bg-white p-4 rounded-2xl border border-slate-100 items-center shadow-sm">
                            <Text className="text-3xl font-black text-slate-800">{stats.total}</Text>
                            <Text className="text-xs font-bold text-slate-400 mt-1">全単語数</Text>
                        </View>
                    </View>

                    {/* Progress Bar */}
                    <View className="mt-6 h-3 bg-slate-100 rounded-full overflow-hidden">
                        <View
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${stats.total > 0 ? (stats.mastered / stats.total) * 100 : 0}%` }}
                        />
                    </View>
                    <Text className="text-right text-xs text-amber-700/60 font-bold mt-1">
                        達成率 {stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0}%
                    </Text>
                </LinearGradient>

                <Text className="text-lg font-black text-slate-800 mb-4 px-1 ml-5">学習モード</Text>

                <View className="gap-3 mb-10 px-5">
                    {modes.map((mode) => (
                        <TouchableOpacity
                            key={mode.id}
                            activeOpacity={0.7}
                            onPress={() => {
                                if (mode.id === 'new') {
                                    router.push({
                                        pathname: '/flashcards/volume-select',
                                        params: { mode: mode.id }
                                    });
                                } else {
                                    // 'weak' or 'master_review' -> go directly to player (all volumes)
                                    // This fixes the issue where user has to select a volume and might get confused
                                    // or just wants to review all weak cards at once.
                                    router.push({
                                        pathname: '/flashcards/player',
                                        params: { mode: mode.id }
                                    });
                                }
                            }}
                            className={`p-4 rounded-2xl border ${mode.bg} ${mode.border} flex-row items-center`}
                            style={{ shadowColor: mode.color, shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { height: 2, width: 0 } }}
                        >
                            <View className={`w-12 h-12 ${mode.iconBg} rounded-xl items-center justify-center mr-4 border border-white/50`}>
                                <mode.icon size={24} color={mode.color} />
                            </View>
                            <View className="flex-1">
                                <Text className="text-base font-black text-slate-800 mb-0.5">{mode.title}</Text>
                                <Text className="text-slate-500 text-xs font-bold">{mode.subtitle}</Text>
                            </View>
                            <View className="bg-white p-2.5 rounded-full border border-slate-100">
                                <ArrowRight size={16} color={mode.color} />
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

            </ScrollView>
        </View>
    );
}
