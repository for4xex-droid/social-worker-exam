import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { Trophy, ArrowRight, Lock, Flame, Target, Star, Bell } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState, useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { initializeDb, db } from '../db/client';
import { useBookshelf } from '../hooks/useBookshelf';
import { questions } from '../db/schema';
import { eq } from 'drizzle-orm';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export default function Home() {
    const router = useRouter();
    const { items: bookshelfItems, loading: bookshelfLoading, refresh: refreshBookshelf } = useBookshelf();
    const [reviewCount, setReviewCount] = useState(0);

    // Get flavor config
    const flavor = Constants.expoConfig?.extra?.flavor || 'social';
    const flavorTitle = Constants.expoConfig?.extra?.title || '社会福祉士';
    const brandColor = Constants.expoConfig?.extra?.brandColor || '#FF6B00';
    const flavorEmoji = Constants.expoConfig?.extra?.iconEmoji || '🧑‍💼';

    useEffect(() => {
        initializeDb();
    }, []);

    useFocusEffect(
        useCallback(() => {
            refreshBookshelf();

            const checkReview = async () => {
                try {
                    const result = await db.select({
                        id: questions.id
                    })
                        .from(questions)
                        .where(eq(questions.isMastered, false));

                    setReviewCount(result.length);
                } catch (e) {
                    console.error("Failed to check review", e);
                }
            };
            checkReview();
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
            // Find any question with this year/group to jump into
            const result = await db.select().from(questions)
                .where(eq(questions.year, bookId))
                .limit(1);

            if (result.length > 0) {
                router.push(`/quiz/${result[0].id}`);
            } else {
                // Try group if year check fails
                const resultGroup = await db.select().from(questions)
                    .where(eq(questions.group, bookId))
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
        <SafeAreaView className="flex-1 bg-[#F8FAFC]">
            <StatusBar style="dark" />

            {/* Header Area */}
            <View className="px-6 py-6 bg-white flex-row justify-between items-center shadow-sm z-10">
                <View>
                    <Text className="text-gray-400 text-[10px] font-bold tracking-[2px] uppercase mb-0.5">
                        Qualified Learning System
                    </Text>
                    <View className="flex-row items-center gap-2">
                        <Text className="text-2xl font-black text-slate-900 tracking-tighter">
                            Welfare Master
                        </Text>
                    </View>
                </View>
                <TouchableOpacity className="w-10 h-10 bg-slate-50 rounded-full items-center justify-center border border-slate-100 shadow-sm">
                    <Bell size={20} color="#64748b" />
                    <View className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-white" />
                </TouchableOpacity>
            </View>

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                {/* 1. User Cockpit */}
                <View className="mx-6 mt-6 mb-8 p-6 bg-white rounded-[32px] shadow-sm border border-slate-100">
                    <View className="flex-row items-center justify-between mb-8">
                        <View className="flex-row items-center gap-4">
                            <View className="w-14 h-14 bg-slate-50 rounded-2xl items-center justify-center shadow-inner border border-slate-100">
                                <Text className="text-2xl">{flavorEmoji}</Text>
                            </View>
                            <View>
                                <Text className="text-slate-900 font-extrabold text-lg">合格マスター</Text>
                                <View
                                    className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg border mt-1"
                                    style={{ backgroundColor: `${brandColor}11`, borderColor: `${brandColor}33` }}
                                >
                                    <Trophy size={12} color={brandColor} fill={brandColor} />
                                    <Text className="text-[10px] font-black uppercase tracking-wider" style={{ color: brandColor }}>{flavorTitle}</Text>
                                </View>
                                {/* DEBUG BUTTON: Safely re-added */}
                                <TouchableOpacity
                                    onPress={() => router.push('/quiz/102')}
                                    className="mt-2 bg-slate-900 px-3 py-1.5 rounded-lg self-start"
                                >
                                    <Text className="text-white text-[10px] font-bold">DEBUG: ID 102</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View
                            className="flex-row items-center px-4 py-2 rounded-2xl border"
                            style={{ backgroundColor: `${brandColor}11`, borderColor: `${brandColor}22` }}
                        >
                            <Flame size={16} color={brandColor} fill={brandColor} />
                            <Text className="font-black text-sm ml-1.5" style={{ color: brandColor }}>{userData.streak} Days</Text>
                        </View>
                    </View>

                    <View className="flex-row gap-4">
                        <View className="flex-1 bg-slate-50 p-5 rounded-[24px]">
                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px] mb-2">Exam Date</Text>
                            <View className="flex-row items-baseline gap-1.5">
                                <Text className="text-3xl font-black text-slate-900 tracking-tighter">{userData.daysLeft}</Text>
                                <Text className="text-slate-400 text-xs font-black uppercase">Days</Text>
                            </View>
                        </View>
                        <View className="flex-1 bg-slate-50 p-5 rounded-[24px]">
                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px] mb-2">Target Score</Text>
                            <View className="flex-row items-baseline gap-1.5">
                                <Text className="text-3xl font-black text-slate-900 tracking-tighter">{userData.targetPoints}</Text>
                                <Text className="text-slate-400 text-xs font-black uppercase">%</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* 2. Today's Quest Card */}
                <View className="mx-6 mb-10 shadow-xl shadow-orange-200" style={{ borderRadius: 32, overflow: 'hidden' }}>
                    <TouchableOpacity
                        onPress={handleQuestPress}
                        activeOpacity={0.9}
                    >
                        <LinearGradient
                            colors={[brandColor, brandColor]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ padding: 28, minHeight: 180, position: 'relative' }}
                        >
                            <View className="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full" />
                            <View className="absolute -left-10 -bottom-10 w-36 h-36 bg-white/5 rounded-full" />

                            <View className="flex-row items-center gap-2 mb-4">
                                <View className="bg-white/20 p-1.5 rounded-lg border border-white/30">
                                    <Target size={14} color="white" />
                                </View>
                                <Text className="text-white font-black opacity-80 text-[11px] tracking-[3px] uppercase">
                                    Today's Challenge
                                </Text>
                            </View>

                            <Text className="text-white text-3xl font-black mb-1.5 tracking-tight">
                                {reviewCount > 0 ? "弱点克服クエスト" : "ミッション完了"}
                            </Text>
                            <Text className="text-orange-50 text-sm font-bold leading-6 mb-6 opacity-90">
                                {reviewCount > 0
                                    ? `残り ${reviewCount} 問の「未習得」を効率よく撃破して、\nマスターランクを目指しましょう。`
                                    : "本日の学習予定はすべて完了しました。"}
                            </Text>

                            <View className="flex-row items-center justify-between mt-auto">
                                <View className="bg-white/20 px-5 py-2.5 rounded-full border border-white/30 backdrop-blur-md">
                                    <Text className="text-white font-black text-xs tracking-widest">+150 EXP</Text>
                                </View>
                                <View className="w-14 h-14 bg-white rounded-[20px] items-center justify-center shadow-lg">
                                    <ArrowRight size={24} color={brandColor} strokeWidth={4} />
                                </View>
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* 3. Bookshelf Section */}
                <View className="mx-6 mb-12">
                    <View className="flex-row justify-between items-center mb-8 px-2">
                        <View>
                            <Text className="text-slate-900 font-black text-2xl tracking-tighter">Study Materials</Text>
                            <Text className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mt-1">過去問・専門別ライブラリ</Text>
                        </View>
                        <TouchableOpacity>
                            <Text className="font-black text-sm uppercase tracking-widest" style={{ color: brandColor }}>See All</Text>
                        </TouchableOpacity>
                    </View>

                    {bookshelfLoading ? (
                        <View className="py-20">
                            <ActivityIndicator size="large" color={brandColor} />
                        </View>
                    ) : (
                        <View className="gap-5">
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
                                    className={`bg-white p-6 rounded-[32px] border border-slate-100 flex-row items-center shadow-lg shadow-slate-200/50 ${item.isLocked ? 'bg-slate-50/50 border-dashed' : ''}`}
                                >
                                    <View className={`w-16 h-20 rounded-2xl items-center justify-center mr-6 shadow-sm ${item.isLocked ? 'bg-slate-200' : 'bg-[#FFF8F3]'}`}>
                                        <View className="absolute inset-0 border-r-4 border-slate-100/30 rounded-2xl" />
                                        {item.isLocked ? (
                                            <Lock size={24} color="#64748b" />
                                        ) : (
                                            <Text className="text-4xl shadow-sm">📕</Text>
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

                {/* 4. Rank Card (Bonus) */}
                <View className="mx-6 mb-12 shadow-2xl shadow-slate-900/10" style={{ borderRadius: 32, overflow: 'hidden' }}>
                    <LinearGradient
                        colors={['#1E293B', '#0F172A']}
                        style={{ padding: 32, position: 'relative' }}
                    >
                        <View className="absolute -top-16 -right-16 w-56 h-56 bg-blue-500/10 rounded-full" />

                        <View className="flex-row justify-between items-start mb-10">
                            <View>
                                <View className="flex-row items-center gap-2 mb-3">
                                    <View className="bg-amber-400/20 p-1.5 rounded-lg border border-amber-400/30">
                                        <Trophy size={14} color="#FBBF24" fill="#FBBF24" />
                                    </View>
                                    <Text className="text-amber-400 font-black text-[11px] tracking-[4px] uppercase">
                                        Current Rank
                                    </Text>
                                </View>
                                <Text className="text-white text-5xl font-black tracking-tighter italic uppercase underline decoration-amber-400/30">
                                    Beginner
                                </Text>
                            </View>
                            <View className="bg-white/10 p-4 rounded-3xl border border-white/10 backdrop-blur-xl">
                                <Trophy size={28} color="#FBBF24" />
                            </View>
                        </View>

                        <View className="h-[1px] bg-white/10 w-full mb-8" />

                        <View className="flex-row justify-between">
                            <View>
                                <Text className="text-slate-400 text-[11px] font-black uppercase tracking-[2px] mb-2">Total Score</Text>
                                <Text className="text-white text-2xl font-black">1,250 pts</Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-slate-400 text-[11px] font-black uppercase tracking-[2px] mb-2">Weekly Goal</Text>
                                <Text className="text-white text-2xl font-black tracking-widest">85%</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
