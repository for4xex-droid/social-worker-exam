import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { BookOpen, Trophy, ArrowRight, Lock, CheckCircle, Flame, Target, Star, Bell } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState, useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { initializeDb } from '../db/client';
import { useBookshelf } from '../hooks/useBookshelf';
import { db } from '../db/client';
import { questions } from '../db/schema';
import { eq } from 'drizzle-orm';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Home() {
    const router = useRouter();
    const { items: bookshelfItems, loading: bookshelfLoading, refresh: refreshBookshelf } = useBookshelf();
    const [reviewCount, setReviewCount] = useState(0);
    const [userLicense, setUserLicense] = useState<{ label: string, emoji: string }>({ label: '受験生', emoji: '🦊' });

    useEffect(() => {
        initializeDb();
        const loadUserLicense = async () => {
            const licenseId = await AsyncStorage.getItem('user_license');
            if (licenseId) {
                const map: Record<string, { label: string, emoji: string }> = {
                    'care': { label: '介護福祉士', emoji: '👵' },
                    'social': { label: '社会福祉士', emoji: '🧑‍💼' },
                    'mental': { label: '精神保健福祉士', emoji: '🧠' },
                    'none': { label: '受験生', emoji: '🦊' }
                };
                if (map[licenseId]) setUserLicense(map[licenseId]);
            }
        };
        loadUserLicense();
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
            const result = await db.select().from(questions)
                .where(eq(questions.year, bookId))
                .limit(1);

            if (result.length > 0) {
                router.push(`/quiz/${result[0].id}`);
            } else {
                console.warn("No questions found for book:", bookId);
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
            <View className="px-6 py-6 bg-white flex-row justify-between items-center">
                <View>
                    <Text className="text-gray-400 text-xs font-bold tracking-[2px] uppercase mb-1">
                        Workspace
                    </Text>
                    <View className="flex-row items-center gap-2">
                        <Text className="text-2xl font-black text-slate-900">
                            Welfare Master
                        </Text>
                    </View>
                </View>
                <TouchableOpacity className="w-10 h-10 bg-slate-100 rounded-full items-center justify-center border border-slate-200">
                    <Bell size={20} color="#64748b" />
                    <View className="absolute top-2 right-2 w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-white" />
                </TouchableOpacity>
            </View>

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                {/* 1. User Cockpit */}
                <View className="mx-6 mt-2 mb-8 p-6 bg-white rounded-[32px] shadow-sm border border-slate-100">
                    <View className="flex-row items-center justify-between mb-6">
                        <View className="flex-row items-center gap-3">
                            <View className="w-12 h-12 bg-orange-100 rounded-full items-center justify-center shadow-inner">
                                <Text className="text-xl">{userLicense.emoji}</Text>
                            </View>
                            <View>
                                <Text className="text-slate-900 font-bold text-lg">利用者さん</Text>
                                <View className="flex-row items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                                    <Trophy size={10} color="#b45309" fill="#b45309" />
                                    <Text className="text-amber-800 text-[10px] font-bold uppercase">{userLicense.label}</Text>
                                </View>
                            </View>
                        </View>
                        <View className="flex-row items-center bg-orange-50 px-3 py-1.5 rounded-full ring-1 ring-orange-200 border border-orange-100">
                            <Flame size={14} color="#f97316" fill="#f97316" />
                            <Text className="text-orange-600 font-bold text-xs ml-1">{userData.streak} Days</Text>
                        </View>
                    </View>

                    <View className="flex-row gap-4">
                        <View className="flex-1 bg-slate-50 p-4 rounded-2xl">
                            <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Countdown</Text>
                            <View className="flex-row items-baseline gap-1">
                                <Text className="text-2xl font-black text-slate-900">{userData.daysLeft}</Text>
                                <Text className="text-slate-400 text-xs font-bold">days</Text>
                            </View>
                        </View>
                        <View className="flex-1 bg-slate-50 p-4 rounded-2xl">
                            <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Target</Text>
                            <View className="flex-row items-baseline gap-1">
                                <Text className="text-2xl font-black text-slate-900">{userData.targetPoints}</Text>
                                <Text className="text-slate-400 text-xs font-bold">%</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* 2. Today's Quest Card (Premium Gradient) */}
                <View className="mx-6 mb-10 shadow-lg shadow-orange-200" style={{ borderRadius: 32, overflow: 'hidden' }}>
                    <TouchableOpacity
                        onPress={handleQuestPress}
                        activeOpacity={0.9}
                    >
                        <LinearGradient
                            colors={['#FF8C37', '#FF6B00']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ padding: 24, minHeight: 160, position: 'relative' }}
                        >
                            {/* Glassmorphic circles */}
                            <View className="absolute -right-10 -top-10 w-44 h-44 bg-white/10 rounded-full" />
                            <View className="absolute -left-10 -bottom-10 w-32 h-32 bg-white/5 rounded-full" />

                            <View className="flex-row items-center gap-2 mb-3">
                                <Target size={14} color="white" />
                                <Text className="text-white font-bold opacity-80 text-[10px] tracking-[2px] uppercase">
                                    Today's Mission
                                </Text>
                            </View>

                            <Text className="text-white text-2xl font-black mb-1">
                                {reviewCount > 0 ? "弱点克服クエスト" : "ミッション完了"}
                            </Text>
                            <Text className="text-orange-50 text-sm font-medium leading-5 mb-4">
                                {reviewCount > 0
                                    ? `残り ${reviewCount} 問の「未習得」を撃破して、\nマスターランクを目指そう。`
                                    : "本日の学習はすべて完了しました。"}
                            </Text>

                            <View className="flex-row items-center justify-between mt-auto">
                                <View className="bg-white/20 px-4 py-2 rounded-full border border-white/30">
                                    <Text className="text-white font-bold text-xs">+150 EXP</Text>
                                </View>
                                <View className="w-12 h-12 bg-white rounded-2xl items-center justify-center shadow-sm">
                                    <ArrowRight size={20} color="#FF6B00" strokeWidth={3} />
                                </View>
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* 3. Bookshelf Section */}
                <View className="mx-6 mb-10">
                    <View className="flex-row justify-between items-center mb-6 px-1">
                        <View>
                            <Text className="text-slate-900 font-black text-xl">Study Materials</Text>
                            <Text className="text-slate-400 text-xs mt-0.5">過去問・専門別ライブラリ</Text>
                        </View>
                        <TouchableOpacity>
                            <Text className="text-orange-500 font-bold text-sm">See All</Text>
                        </TouchableOpacity>
                    </View>

                    {bookshelfLoading ? (
                        <ActivityIndicator size="large" color="#FF6B00" />
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
                                    activeOpacity={0.7}
                                    className={`bg-white p-5 rounded-[24px] border border-slate-100 flex-row items-center shadow-sm shadow-slate-200 ${item.isLocked ? 'bg-slate-50 border-dashed' : ''}`}
                                >
                                    {/* Book Icon with Depth */}
                                    <View className={`w-14 h-18 rounded-xl items-center justify-center mr-5 shadow-sm ${item.isLocked ? 'bg-slate-200' : 'bg-slate-50'}`}>
                                        <View className="absolute inset-0 border-r-4 border-slate-200/50 rounded-xl" />
                                        {item.isLocked ? (
                                            <Lock size={20} color="#64748b" />
                                        ) : (
                                            <Text className="text-3xl">📕</Text>
                                        )}
                                    </View>

                                    <View className="flex-1">
                                        <View className="flex-row justify-between items-center mb-1">
                                            <Text className="font-black text-slate-800 text-[17px] tracking-tight">{item.title}</Text>
                                            {item.isLocked && (
                                                <Star size={16} color="#fbbf24" fill="#fbbf24" opacity={0.5} />
                                            )}
                                        </View>
                                        <Text className="text-slate-400 text-xs mb-3">
                                            {item.isLocked ? "PREMIUM CONTENT" : `${item.questionCount} Questions included`}
                                        </Text>

                                        {!item.isLocked && (
                                            <View className="flex-row items-center gap-3">
                                                <View className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <View
                                                        className="h-full bg-orange-500 rounded-full"
                                                        style={{ width: `${item.progress * 100}%` }}
                                                    />
                                                </View>
                                                <Text className="text-slate-900 font-black text-[10px]">
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

                {/* 4. Rank & Stats Card */}
                <View className="mx-6 mb-12 shadow-xl shadow-slate-900/20" style={{ borderRadius: 32, overflow: 'hidden' }}>
                    <LinearGradient
                        colors={['#1E293B', '#0F172A']}
                        style={{ padding: 28, position: 'relative' }}
                    >
                        {/* Decorative background element */}
                        <View className="absolute -top-20 -right-20 w-60 h-60 bg-blue-500/10 rounded-full" />

                        <View className="flex-row justify-between items-start mb-8">
                            <View>
                                <View className="flex-row items-center gap-2 mb-2">
                                    <Trophy size={14} color="#FBBF24" fill="#FBBF24" />
                                    <Text className="text-amber-400 font-bold text-[10px] tracking-[3px] uppercase">
                                        Current Rank
                                    </Text>
                                </View>
                                <Text className="text-white text-4xl font-black tracking-tighter italic uppercase">
                                    Beginner
                                </Text>
                            </View>
                            <View className="bg-white/10 p-3 rounded-2xl border border-white/10">
                                <Trophy size={20} color="#FBBF24" />
                            </View>
                        </View>

                        <View className="h-[1px] bg-white/10 w-full mb-6" />

                        <View className="flex-row justify-between">
                            <View>
                                <Text className="text-slate-400 text-[10px] font-bold uppercase mb-1">Total Score</Text>
                                <Text className="text-white text-xl font-bold">1,250 pts</Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-slate-400 text-[10px] font-bold uppercase mb-1">Weekly Goal</Text>
                                <Text className="text-white text-xl font-bold">85%</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}
