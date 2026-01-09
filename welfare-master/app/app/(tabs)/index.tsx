import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { Trophy, ArrowRight, Lock, Flame, Target, Star, Bell, Brain, Heart, Users, BookOpen, Headphones } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState, useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { initializeDb, db } from '../../db/client';
import { useBookshelf } from '../../hooks/useBookshelf';
import { questions } from '../../db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME } from '../../constants/Config'; // Use centralized config

import { MotiView } from 'moti';

export default function Home() {
    const router = useRouter();
    const { items: bookshelfItems, loading: bookshelfLoading, refresh: refreshBookshelf } = useBookshelf();
    const [reviewCount, setReviewCount] = useState(0);
    const [dailyQuests, setDailyQuests] = useState<any[]>([]);
    const [loadingQuests, setLoadingQuests] = useState(true);

    // Get flavor config using centralized THEME
    const flavorTitle = THEME.labels.appName;
    const brandColor = THEME.colors.primary;

    // Replace emojis with Lucide Icons for more premium feel
    const FlavorIcon = THEME.variant === 'care' ? Heart : THEME.variant === 'mental' ? Brain : Users;

    // initializeDb is handled in root _layout.tsx
    // useEffect(() => {
    //     initializeDb();
    // }, []);

    useFocusEffect(
        useCallback(() => {
            refreshBookshelf();

            const loadData = async () => {
                setLoadingQuests(true);
                try {
                    // Check total unmastered for the count
                    // Use THEME.variant instead of unreliable AsyncStorage key
                    const variant = THEME.variant || 'social';

                    // Filter logic using helper
                    const getTargetGroups = () => {
                        if (variant === 'care') return ['past_kaigo', 'spec_care', 'common'];
                        if (variant === 'mental') return ['common', 'spec_mental', 'past_mental'];
                        return ['common', 'spec_social', 'past_social'];
                    };
                    const targetGroups = getTargetGroups();

                    const filterByVariant = (q: any) => {
                        return q.where(inArray(questions.group, targetGroups));
                    };

                    const result = await filterByVariant(db.select({ id: questions.id }).from(questions).where(eq(questions.isMastered, false)));
                    setReviewCount(result.length);

                    // Fetch 3 specific questions for "Today's Quest"
                    const questResult = await filterByVariant(db.select().from(questions).where(eq(questions.isMastered, false))).limit(3);
                    setDailyQuests(questResult);
                } catch (e) {
                    console.error("Failed to load home data", e);
                } finally {
                    setLoadingQuests(false);
                }
            };
            loadData();
        }, [])
    );

    // Mock data for UI development
    const userData = {
        daysLeft: 390,
        streak: 5,
        targetPoints: 85,
    };

    const handleBookPress = async (bookId: string) => {
        try {
            // Determine groups based on current theme variant
            const variant = THEME.variant || 'social';
            const getTargetGroups = () => {
                if (variant === 'care') return ['past_kaigo', 'spec_care', 'common'];
                if (variant === 'mental') return ['common', 'spec_mental', 'past_mental'];
                return ['common', 'spec_social', 'past_social'];
            };
            const targetGroups = getTargetGroups();

            const result = await db.select().from(questions)
                .where(and(
                    eq(questions.year, bookId),
                    inArray(questions.group, targetGroups)
                ))
                .limit(1);

            if (result.length > 0) {
                router.push(`/quiz/${result[0].id}`);
            } else {
                const resultGroup = await db.select().from(questions)
                    .where(and(
                        eq(questions.group, bookId),
                        inArray(questions.group, targetGroups)
                    ))
                    .limit(1);
                if (resultGroup.length > 0) {
                    router.push(`/quiz/${resultGroup[0].id}`);
                }
            }
        } catch (e) {
            console.error("Error starting quiz", e);
        }
    };

    const handleQuestPress = async () => {
        try {
            const result = await db.select().from(questions)
                .where(eq(questions.isMastered, false))
                .limit(1);

            if (result.length > 0) {
                router.push(`/quiz/${result[0].id}?mode=review`);
            }
        } catch (e) {
            console.error("Error starting quest", e);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-[#F8FAFC]" edges={['top', 'left', 'right']}>
            <StatusBar style="dark" />

            {/* Header Area: Reduced padding */}
            <View className="px-6 py-4 bg-white flex-row justify-between items-center shadow-sm z-10">
                <View>
                    <Text className="text-gray-400 text-[10px] font-bold tracking-[2px] uppercase mb-0.5">
                        Professional LMS
                    </Text>
                    <View className="flex-row items-center gap-2">
                        <Text className="text-xl font-black text-slate-900 tracking-tighter">
                            Welfare Master
                        </Text>
                    </View>
                </View>
                <View className="flex-row items-center gap-3">
                    <TouchableOpacity
                        onPress={() => router.push('/audio-player')}
                        className="w-10 h-10 bg-slate-50 rounded-full items-center justify-center border border-slate-100"
                    >
                        <Headphones size={18} color="#64748b" />
                    </TouchableOpacity>
                    <TouchableOpacity className="w-10 h-10 bg-slate-50 rounded-full items-center justify-center border border-slate-100">
                        <Bell size={18} color="#64748b" />
                        <View className="absolute top-2.5 right-2.5 w-2 h-2 bg-orange-500 rounded-full border-2 border-white" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                {/* 1. User Cockpit: More compact padding and replaced emoji */}
                <MotiView
                    from={{ opacity: 0, translateY: 10 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    className="mx-6 mt-4 mb-5 p-5 bg-white rounded-[28px] shadow-sm border border-slate-100"
                >
                    <View className="flex-row items-center justify-between mb-6">
                        <View className="flex-row items-center gap-4">
                            <View className="w-12 h-12 bg-slate-50 rounded-xl items-center justify-center border border-slate-100 shadow-sm">
                                <FlavorIcon size={24} color={brandColor} />
                            </View>
                            <View>
                                <Text className="text-slate-900 font-extrabold text-base">合格マスター</Text>
                                <View
                                    className="flex-row items-center gap-1.5 px-2 py-0.5 rounded-md border mt-0.5"
                                    style={{ backgroundColor: `${brandColor}11`, borderColor: `${brandColor}33` }}
                                >
                                    <Trophy size={10} color={brandColor} fill={brandColor} />
                                    <Text className="text-[9px] font-black uppercase tracking-wider" style={{ color: brandColor }}>{flavorTitle}</Text>
                                </View>
                            </View>
                        </View>
                        <View
                            className="flex-row items-center px-3 py-1.5 rounded-xl border"
                            style={{ backgroundColor: `${brandColor}11`, borderColor: `${brandColor}22` }}
                        >
                            <Flame size={14} color={brandColor} fill={brandColor} />
                            <Text className="font-black text-xs ml-1.5" style={{ color: brandColor }}>{userData.streak} Days</Text>
                        </View>
                    </View>

                    <View className="flex-row gap-3">
                        <View className="flex-1 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-[1px] mb-1">Exam Date</Text>
                            <View className="flex-row items-baseline gap-1">
                                <Text className="text-2xl font-black text-slate-900 tracking-tighter">{userData.daysLeft}</Text>
                                <Text className="text-slate-400 text-[10px] font-black uppercase">Days</Text>
                            </View>
                        </View>
                        <View className="flex-1 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-[1px] mb-1">Target Score</Text>
                            <View className="flex-row items-baseline gap-1">
                                <Text className="text-2xl font-black text-slate-900 tracking-tighter">{userData.targetPoints}</Text>
                                <Text className="text-slate-400 text-[10px] font-black uppercase">%</Text>
                            </View>
                        </View>
                    </View>
                </MotiView>

                {/* 2. Today's Quest Card */}
                <View className="mx-6 mb-8">
                    <MotiView
                        from={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="shadow-lg shadow-orange-200"
                        style={{ borderRadius: 28, overflow: 'hidden', marginBottom: 16 }}
                    >
                        <TouchableOpacity
                            onPress={handleQuestPress}
                            activeOpacity={0.9}
                        >
                            <LinearGradient
                                colors={[brandColor, brandColor]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={{ padding: 22, minHeight: 140, position: 'relative' }}
                            >
                                <View className="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full" />
                                <View className="absolute -left-10 -bottom-10 w-36 h-36 bg-white/5 rounded-full" />

                                <View className="flex-row items-center gap-2 mb-2">
                                    <View className="bg-white/20 p-1 rounded-md border border-white/30">
                                        <Target size={12} color="white" />
                                    </View>
                                    <Text className="text-white font-black opacity-80 text-[10px] tracking-[2px] uppercase">
                                        Daily Mission
                                    </Text>
                                </View>

                                <Text className="text-white text-2xl font-black mb-1 tracking-tight">
                                    {dailyQuests.length > 0 ? "今日のクエスト" : "ミッション完了"}
                                </Text>
                                <Text className="text-orange-50 text-xs font-bold leading-5 opacity-90">
                                    {dailyQuests.length > 0
                                        ? `本日は ${dailyQuests.length} 個の重要ミッションがあります。\n全クリアで追加ポイントを獲得！`
                                        : "本日の学習予定はすべて完了しました。"}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </MotiView>

                    {/* Quest Items List */}
                    {dailyQuests.map((quest, idx) => (
                        <MotiView
                            key={quest.id}
                            from={{ opacity: 0, translateX: -20 }}
                            animate={{ opacity: 1, translateX: 0 }}
                            transition={{ delay: 200 + (idx * 100) }}
                        >
                            <TouchableOpacity
                                onPress={() => router.push(`/quiz/${quest.id}`)}
                                className="bg-white p-4 rounded-2xl mb-2 flex-row items-center border border-slate-100 shadow-sm"
                            >
                                <View className="w-8 h-8 rounded-full bg-slate-50 items-center justify-center mr-3 border border-slate-100">
                                    <Text className="text-slate-400 font-black text-xs">{idx + 1}</Text>
                                </View>
                                <View className="flex-1">
                                    <Text className="text-slate-900 font-bold text-sm" numberOfLines={1}>
                                        {quest.questionText}
                                    </Text>
                                    <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-0.5">
                                        {quest.categoryLabel || "一般知識"}
                                    </Text>
                                </View>
                                <ArrowRight size={16} color="#cbd5e1" />
                            </TouchableOpacity>
                        </MotiView>
                    ))}
                </View>

                {/* 3. Bookshelf Section: More compact */}
                <View className="mx-6 mb-8">
                    <View className="flex-row justify-between items-center mb-6 px-1">
                        <View>
                            <Text className="text-slate-900 font-black text-xl tracking-tighter">Study Materials</Text>
                            <Text className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mt-0.5">過去問・専門別ライブラリ</Text>
                        </View>
                        <TouchableOpacity>
                            <Text className="font-black text-xs uppercase tracking-widest" style={{ color: brandColor }}>See All</Text>
                        </TouchableOpacity>
                    </View>

                    {bookshelfLoading ? (
                        <View className="py-20">
                            <ActivityIndicator size="large" color={brandColor} />
                        </View>
                    ) : (
                        <View className="gap-4">
                            {bookshelfItems.map((item, index) => (
                                <TouchableOpacity
                                    key={index}
                                    onPress={() => {
                                        if (!item.isLocked) {
                                            handleBookPress(item.id);
                                        } else {
                                            router.push('/purchase');
                                        }
                                    }}
                                    activeOpacity={0.75}
                                    className={`bg-white p-5 rounded-[28px] border border-slate-100 flex-row items-center shadow-md shadow-slate-200/50 ${item.isLocked ? 'bg-slate-50/50 border-dashed' : ''}`}
                                >
                                    <View className={`w-14 h-18 rounded-2xl items-center justify-center mr-5 shadow-sm ${item.isLocked ? 'bg-slate-200' : 'bg-[#FFF8F3]'}`}>
                                        <View className="absolute inset-0 border-r-4 border-slate-100/30 rounded-2xl" />
                                        {item.isLocked ? (
                                            <Lock size={20} color="#64748b" />
                                        ) : (
                                            <BookOpen size={28} color={brandColor} />
                                        )}
                                    </View>

                                    <View className="flex-1">
                                        <View className="flex-row justify-between items-center mb-2">
                                            <Text className="font-black text-slate-800 text-lg tracking-tight">{item.title}</Text>
                                            {item.isLocked && (
                                                <View className="w-6 h-6 bg-amber-50 rounded-full items-center justify-center border border-amber-100">
                                                    <Star size={12} color="#fbbf24" fill="#fbbf24" />
                                                </View>
                                            )}
                                        </View>
                                        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">
                                            {item.isLocked ? "PREMIUM CONTENT" : `${item.questionCount} Questions included`}
                                        </Text>

                                        {!item.isLocked && (
                                            <View className="flex-row items-center gap-4">
                                                <View className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                                    <View
                                                        className="h-full rounded-full"
                                                        style={{ width: `${item.progress * 100}%`, backgroundColor: brandColor }}
                                                    />
                                                </View>
                                                <Text className="text-slate-900 font-black text-xs">
                                                    {Math.round(item.progress * 100)}%
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* 4. Rank Card (Bonus): Compact version */}
                <View className="mx-6 mb-10 shadow-xl shadow-slate-900/10" style={{ borderRadius: 28, overflow: 'hidden' }}>
                    <LinearGradient
                        colors={['#1E293B', '#0F172A']}
                        style={{ padding: 24, position: 'relative' }}
                    >
                        <View className="absolute -top-16 -right-16 w-56 h-56 bg-blue-500/10 rounded-full" />

                        <View className="flex-row justify-between items-start mb-6">
                            <View>
                                <View className="flex-row items-center gap-2 mb-2">
                                    <View className="bg-amber-400/10 p-1 rounded-md border border-amber-400/20">
                                        <Trophy size={12} color="#FBBF24" fill="#FBBF24" />
                                    </View>
                                    <Text className="text-amber-400 font-black text-[9px] tracking-[3px] uppercase">
                                        Current Rank
                                    </Text>
                                </View>
                                <Text className="text-white text-3xl font-black tracking-tighter italic uppercase underline decoration-amber-400/30">
                                    Beginner
                                </Text>
                            </View>
                            <View className="bg-white/5 p-3 rounded-2xl border border-white/5 backdrop-blur-xl">
                                <Trophy size={20} color="#FBBF24" />
                            </View>
                        </View>

                        <View className="h-[1px] bg-white/5 w-full mb-6" />

                        <View className="flex-row justify-between">
                            <View>
                                <Text className="text-slate-400 text-[9px] font-black uppercase tracking-[1px] mb-1">Total Score</Text>
                                <Text className="text-white text-xl font-black">1,250 pts</Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-slate-400 text-[9px] font-black uppercase tracking-[1px] mb-1">Weekly Goal</Text>
                                <Text className="text-white text-xl font-black tracking-widest">85%</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </View>
            </ScrollView>
        </SafeAreaView >
    );
}
