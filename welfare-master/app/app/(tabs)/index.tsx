import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Pressable, Image, useWindowDimensions, FlatList, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { Trophy, ArrowRight, Lock, Flame, Target, Star, Bell, Brain, Heart, Users, BookOpen, Headphones, X, Settings, HelpCircle, CheckCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { db } from '../../db/client';
import { useBookshelf } from '../../hooks/useBookshelf';
import { questions, userProgress, memorizationCards } from '../../db/schema';
import { count, eq, inArray, and, isNull, or, sql } from 'drizzle-orm';
import { THEME } from '../../constants/Config';
import { AnimatePresence } from 'moti';
import { Link } from 'expo-router';
import { usePremium } from '../../constants/premium';
import clsx from 'clsx';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Rank configuration
const RANKS = [
    { name: '見習い', threshold: 0, color: '#94a3b8', image: require('../../assets/images/ranks/rank_novice.png') },
    { name: '駆け出し', threshold: 200, color: '#60a5fa', image: require('../../assets/images/ranks/rank_beginner.png') },
    { name: 'ベテラン', threshold: 1000, color: '#34d399', image: require('../../assets/images/ranks/rank_inter.png') },
    { name: 'マスター', threshold: 3000, color: '#fbbf24', image: require('../../assets/images/ranks/rank_expert.png') },
    { name: 'レジェンド', threshold: 10000, color: '#8b5cf6', image: require('../../assets/images/ranks/rank_master.png') },
    { name: '神', threshold: 30000, color: '#f43f5e', image: require('../../assets/images/ranks/rank_gold.png') },
];

import Constants from 'expo-constants';

export default function HomeScreen() {
    const { width } = useWindowDimensions();
    const router = useRouter();
    const { items: bookshelfItems, loading: loadingBookshelf, refresh: refreshBookshelf } = useBookshelf();
    const { isPremium, loading: premiumLoading } = usePremium();
    const variant = Constants.expoConfig?.extra?.variant || 'social';

    const [loadingQuests, setLoadingQuests] = useState(true);
    const [dailyTotal, setDailyTotal] = useState(0);
    const [todayCompletedCount, setTodayCompletedCount] = useState(0);
    const [streak, setStreak] = useState(0);
    const [totalXP, setTotalXP] = useState(0);
    const [userRank, setUserRank] = useState(RANKS[0]);
    const [nextRank, setNextRank] = useState(RANKS[1]);
    const [progressToNextRank, setProgressToNextRank] = useState(0);

    const [currentMissionIndex, setCurrentMissionIndex] = useState(0);
    const [isRankModalVisible, setRankModalVisible] = useState(false);
    const [nickname, setNickname] = useState('ゲスト');

    // For flashcards (simplified count)
    const [flashcardCount, setFlashcardCount] = useState(0);

    const itemGroups = useMemo(() => {
        // Simple grouping logic based on BookshelfItem properties
        const commonItems = bookshelfItems.filter(i => i.group === 'common' || i.title.includes('共通'));
        const specItems = bookshelfItems.filter(i =>
            (i.group?.startsWith('spec_') || (!i.group?.startsWith('past') && !i.title.includes('共通') && i.group !== 'common'))
        );
        const pastItems = bookshelfItems.filter(i => i.type === 'past');

        return [
            { title: '共通科目', items: commonItems, isSpecial: false, isFree: true },
            { title: '専門科目', items: specItems, isSpecial: true, isFree: false }, // Premium Locked
            { title: '過去問', items: pastItems, isSpecial: false, isFree: true }
        ].filter(g => g.items.length > 0);
    }, [bookshelfItems]);

    useFocusEffect(
        useCallback(() => {
            loadUserData();
            refreshBookshelf();
        }, [])
    );

    const loadUserData = async () => {
        if (!db) {
            console.log("DB yet not ready, retry in 500ms");
            setTimeout(loadUserData, 500);
            return;
        }
        try {
            // 1. Calculate XP and Rank
            // Simple XP logic: 10 XP per correct answer in history
            const progress = await db.select().from(userProgress);
            const totalCorrect = progress.filter(p => p.isCorrect).length;
            const currentXP = totalCorrect * 10;
            setTotalXP(currentXP);

            // Determine Rank
            let rank = RANKS[0];
            let next = RANKS[1];
            for (let i = 0; i < RANKS.length; i++) {
                if (currentXP >= RANKS[i].threshold) {
                    rank = RANKS[i];
                    next = RANKS[i + 1] || RANKS[i];
                }
            }
            setUserRank(rank);
            setNextRank(next);

            if (rank.name === next.name) {
                setProgressToNextRank(100);
            } else {
                const range = next.threshold - rank.threshold;
                const progressInLevel = currentXP - rank.threshold;
                setProgressToNextRank(Math.min(100, Math.max(0, (progressInLevel / range) * 100)));
            }

            // Load Nickname
            const userProfile = await AsyncStorage.getItem('user_profile');
            if (userProfile) {
                const profile = JSON.parse(userProfile);
                setNickname(profile.nickname || 'ゲスト');
            }

            // 2. Daily Quests Logic (Reset at 4:00 AM)
            const getBusinessDate = (ts?: number) => {
                const d = ts ? new Date(ts) : new Date();
                d.setHours(d.getHours() - 4);
                return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            };

            const today = getBusinessDate();

            const todayProgress = progress.filter((p: any) => {
                if (!p.timestamp) return false;
                try {
                    return getBusinessDate(p.timestamp) === today;
                } catch { return false; }
            });
            setTodayCompletedCount(todayProgress.length);
            setDailyTotal(5); // Target: 5 questions per day

            // Streak Logic (Simplified)
            // In a real app, we would query the DB for consecutive days
            // Here we just mock or use simple logic
            setStreak(prev => prev > 0 ? prev : 1);

            // Flashcards count
            const cards = await db.select({ count: count() }).from(memorizationCards);
            setFlashcardCount(cards[0].count);

            setLoadingQuests(false);

        } catch (e) {
            console.error(e);
            setLoadingQuests(false);
        }
    };

    const handleStartDailyQuiz = async () => {
        // Find 10 random unmastered questions from Common Subjects (group='common')
        // This includes uncategorized/implemented questions as a fallback/benefit for free users.
        try {
            // 1. Get IDs of mastered questions to exclude
            const masteredIds = (await db.select({ id: questions.id }).from(questions).where(eq(questions.isMastered, true))).map(q => q.id);

            // 2. Get all questions to filter in memory (safer for varying group names)
            const allQuestions = await db.select({ id: questions.id, group: questions.group }).from(questions);

            // Filter: Common subjects ONLY (exclude past and spec)
            let candidateIds = allQuestions
                .filter(q => {
                    const g = q.group || '';
                    return g === 'common' || g.startsWith('common');
                })
                .map(q => q.id);

            // Filter mastered
            const masteredSet = new Set(masteredIds);
            candidateIds = candidateIds.filter(id => !masteredSet.has(id));

            if (candidateIds.length === 0) {
                // If everything is mastered, fallback to all candidates
                candidateIds = allQuestions
                    .filter(q => {
                        const g = q.group || '';
                        return g === 'common' || g.startsWith('common') || g.startsWith('past');
                    })
                    .map(q => q.id);
            }

            // Shuffle
            for (let i = candidateIds.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [candidateIds[i], candidateIds[j]] = [candidateIds[j], candidateIds[i]];
            }

            const selectedIds = candidateIds.slice(0, 5);

            // Store queue
            await AsyncStorage.setItem('@quiz_queue', JSON.stringify(selectedIds));
            await AsyncStorage.setItem('@quiz_mode', 'daily');
            await AsyncStorage.setItem('@quiz_session_correct_count', '0');

            if (selectedIds.length > 0) {
                router.push(`/quiz/${selectedIds[0]}`);
            } else {
                alert("出題可能な問題が見つかりませんでした。");
                console.warn("No questions found (checked common/past).");
            }

        } catch (e) {
            console.error(e);
        }
    };

    // Start Weakness Review (New implementation)
    const handleStartWeakness = () => {
        router.push('/weakness');
    };

    const handleLockedContent = (path: any) => {
        if (!isPremium) {
            router.push('/purchase');
        } else {
            if (path) router.push(path);
        }
    };

    const missions = [
        {
            id: 'daily',
            title: '今日のミッション',
            subtitle: '毎日コツコツ続けよう',
            mainText: `${todayCompletedCount}/${dailyTotal}`,
            progress: `${Math.round((todayCompletedCount / dailyTotal) * 100)}%`,
            percent: Math.min(100, (todayCompletedCount / dailyTotal) * 100),
            colors: ['#3b82f6', '#2563eb'],
            icon: Target,
            handler: handleStartDailyQuiz,
            category: 'DAILY'
        },
        {
            id: 'weakness',
            title: '苦手克服モード',
            subtitle: '間違えた問題を集中的に',
            mainText: '弱点撲滅',
            progress: 'Start',
            percent: 0,
            colors: ['#ef4444', '#dc2626'],
            icon: Flame,
            handler: handleStartWeakness,
            category: 'REVIEW'
        }
    ];

    const isAllQuestsCompleted = todayCompletedCount >= dailyTotal;

    return (
        <SafeAreaView className="flex-1 bg-[#F8FAFC]" edges={['top']}>
            <StatusBar style="dark" />

            {/* Header */}
            <View className="px-6 py-1 flex-row justify-between items-center bg-white shadow-sm z-10">
                <View>
                    <Text className="text-slate-400 font-bold text-sm uppercase tracking-wider mb-0.5">Welcome back</Text>
                    <Text className="text-2xl font-black text-slate-800">
                        {loadingQuests ? 'Loading...' : `Lv.${RANKS.indexOf(userRank) + 1} ${nickname}`}
                    </Text>
                </View>
                <View className="flex-row items-center gap-3">
                    <TouchableOpacity
                        className="bg-slate-50 p-2 rounded-full border border-slate-100"
                        onPress={() => router.push('/notifications')}
                    >
                        <Bell size={20} color="#64748b" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        className="bg-slate-50 p-2 rounded-full border border-slate-100"
                        onPress={() => router.push('/help')}
                    >
                        <HelpCircle size={20} color="#64748b" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                className={Platform.OS === 'web' ? "" : "flex-1"}
                contentContainerStyle={{ paddingBottom: 40 }}
                // @ts-ignore: Web specific style
                style={Platform.OS === 'web' ? { height: '75vh', overflowY: 'scroll' } : undefined}
            >

                {/* 1. Rank & Status Card */}
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setRankModalVisible(true)}
                    className="mx-4 mt-4 mb-4"
                >
                    <LinearGradient
                        colors={['#1e293b', '#0f172a']}
                        className="p-3 rounded-2xl shadow-xl shadow-slate-300 relative overflow-hidden"
                    >
                        {/* Background Decor */}
                        <View className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10" />

                        <View className="flex-row items-center">
                            {/* Icon */}
                            <View className="w-12 h-12 mr-3 items-center justify-center bg-white/5 rounded-full border border-white/10">
                                <Image
                                    source={userRank.image}
                                    className="w-9 h-9 rounded-full"
                                    resizeMode="contain"
                                    style={{ width: 36, height: 36 }}
                                />
                            </View>

                            {/* Info Area */}
                            <View className="flex-1 justify-center">
                                {/* Top: Rank Name & Total XP */}
                                <View className="flex-row justify-between items-baseline mb-1.5">
                                    <View className="flex-row items-baseline gap-2">
                                        <Text className="text-white font-bold text-lg">{userRank.name}</Text>
                                        <Text className="text-slate-400 text-xs font-bold">Lv.{RANKS.indexOf(userRank) + 1}</Text>
                                    </View>
                                    <Text className="text-white font-black text-lg tracking-tighter">
                                        {totalXP.toLocaleString()} <Text className="text-xs font-normal text-slate-400">XP</Text>
                                    </Text>
                                </View>

                                {/* Middle: Progress Bar */}
                                <View className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                                    <MotiView
                                        from={{ width: '0%' }}
                                        animate={{ width: `${progressToNextRank}%` }}
                                        transition={{ type: 'timing', duration: 1000 } as any}
                                        className="h-full bg-yellow-400 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.5)]"
                                    />
                                </View>

                                {/* Bottom: Next Check */}
                                <View className="items-end mt-1">
                                    <Text className="text-slate-400 text-[9px]">
                                        Next: <Text className="text-white font-bold">{nextRank.threshold - totalXP} XP</Text>
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

                {/* Rank Modal */}
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={isRankModalVisible}
                    onRequestClose={() => setRankModalVisible(false)}
                >
                    <View className="flex-1 bg-black/50 justify-end">
                        <View className="bg-white rounded-t-3xl h-[80%] p-6">
                            <View className="flex-row justify-between items-center mb-6">
                                <Text className="text-2xl font-black text-slate-800">ランクシステム</Text>
                                <TouchableOpacity
                                    onPress={() => setRankModalVisible(false)}
                                    className="w-8 h-8 bg-slate-100 rounded-full items-center justify-center"
                                >
                                    <X size={20} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View className="bg-slate-50 p-6 rounded-2xl items-center mb-8 border border-slate-100">
                                    <View className="w-24 h-24 mb-4">
                                        <Image
                                            source={userRank.image}
                                            className="w-full h-full rounded-full"
                                            resizeMode="contain"
                                            style={{ width: 96, height: 96 }}
                                        />
                                    </View>
                                    <Text className="text-3xl font-black text-slate-800 mb-1">{userRank.name}</Text>
                                    <Text className="text-slate-500 font-bold mb-4">現在のランク</Text>
                                    <View className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-2">
                                        <View
                                            style={{ width: `${progressToNextRank}%` }}
                                            className="h-full bg-yellow-400 rounded-full"
                                        />
                                    </View>
                                    <Text className="text-xs text-slate-400 font-bold">
                                        次のランク「{nextRank.name}」まであと {nextRank.threshold - totalXP} XP
                                    </Text>
                                </View>

                                <Text className="text-lg font-bold text-slate-800 mb-4 ml-1">ランク一覧</Text>
                                {RANKS.map((rank, index) => {
                                    const isAchieved = totalXP >= rank.threshold;
                                    const isCurrent = userRank.name === rank.name;

                                    return (
                                        <View
                                            key={rank.name}
                                            className={clsx(
                                                "flex-row items-center p-4 rounded-xl mb-3 border",
                                                isCurrent ? "bg-blue-50 border-blue-200" : "bg-white border-slate-100",
                                                !isAchieved && !isCurrent && "opacity-60"
                                            )}
                                        >
                                            <View className={clsx(
                                                "w-12 h-12 rounded-full items-center justify-center mr-4",
                                                isAchieved ? "bg-yellow-100" : "bg-slate-100"
                                            )}>
                                                <Image
                                                    source={rank.image}
                                                    className="w-full h-full rounded-full"
                                                    resizeMode="contain"
                                                    style={{ width: 48, height: 48, opacity: isAchieved ? 1 : 0.5 }}
                                                />
                                            </View>
                                            <View className="flex-1">
                                                <Text className="font-bold text-slate-800 text-base">{rank.name}</Text>
                                                <Text className="text-slate-400 text-xs font-bold">{rank.threshold} XP</Text>
                                            </View>
                                            {isCurrent && (
                                                <View className="bg-blue-500 px-3 py-1 rounded-full">
                                                    <Text className="text-white text-xs font-bold">Current</Text>
                                                </View>
                                            )}
                                        </View>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>

                {/* 2. Daily Quest & Weakness Carousel (Swipeable) */}
                <View className="mb-4">
                    <FlatList
                        data={missions}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(item) => item.id}
                        onMomentumScrollEnd={(e) => {
                            const newIndex = Math.round(e.nativeEvent.contentOffset.x / (width - 32));
                            setCurrentMissionIndex(newIndex);
                        }}
                        contentContainerStyle={{ paddingHorizontal: 16 }}
                        snapToInterval={width - 32}
                        decelerationRate="fast"
                        renderItem={({ item, index }) => {
                            const ActiveIcon = item.icon;

                            // Celebration Animation for Daily Mission Completion
                            const isCompletedDaily = item.id === 'daily' && isAllQuestsCompleted;

                            // Web optimization: Cap width
                            const cardWidth = Platform.OS === 'web' ? Math.min(width - 32, 400) : width - 32;

                            return (
                                <View style={{ width: cardWidth, height: 80, marginRight: index === missions.length - 1 ? 0 : 8 }}>
                                    <TouchableOpacity
                                        activeOpacity={isCompletedDaily ? 1 : 0.9}
                                        onPress={isCompletedDaily ? undefined : item.handler}
                                        style={{ flex: 1 }}
                                    >
                                        <LinearGradient
                                            colors={isCompletedDaily ? ['#10b981', '#059669'] : item.colors as any}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={{ padding: 12, flex: 1, borderRadius: 20, position: 'relative', overflow: 'hidden', justifyContent: 'center' }}
                                        >
                                            {/* Decorative Elements */}
                                            <View className="absolute -right-4 -top-10 w-32 h-32 bg-white/10 rounded-full" />
                                            <View className="absolute -left-12 -bottom-16 w-40 h-40 bg-black/5 rounded-full" />

                                            {item.id === 'daily' ? (
                                                <View className="flex-1 justify-center">
                                                    {isCompletedDaily ? (
                                                        <View className="flex-row items-center justify-between">
                                                            <View className="flex-row items-center gap-3">
                                                                <View className="w-10 h-10 bg-white/20 rounded-full items-center justify-center border border-white/20">
                                                                    <Trophy size={20} color="white" fill="white" />
                                                                </View>
                                                                <View>
                                                                    <Text className="text-white font-black text-lg tracking-tight">MISSION COMPLETE</Text>
                                                                    <Text className="text-white/90 text-xs font-bold">本日のミッション達成！</Text>
                                                                </View>
                                                            </View>
                                                            <View className="bg-white/20 px-3 py-1 rounded-full">
                                                                <CheckCircle size={16} color="white" />
                                                            </View>
                                                        </View>
                                                    ) : (
                                                        <>
                                                            {/* Top Row: Icon/Title & Progress Text */}
                                                            <View className="flex-row justify-between items-center mb-2">
                                                                <View className="flex-row items-center gap-2">
                                                                    <MotiView
                                                                        animate={{ scale: [1, 1.2, 1], rotate: ['0deg', '10deg', '-10deg', '0deg'] }}
                                                                        transition={{ loop: true, type: 'timing', duration: 3000 } as any}
                                                                        className="w-6 h-6 bg-white/20 rounded-lg items-center justify-center"
                                                                    >
                                                                        <ActiveIcon size={12} color="white" />
                                                                    </MotiView>
                                                                    <View>
                                                                        <Text className="text-white font-black text-sm shadow-sm">{item.title}</Text>
                                                                        <Text className="text-white/90 font-bold text-xs">
                                                                            ランダム問題に挑戦
                                                                        </Text>
                                                                    </View>
                                                                </View>

                                                                <View className="items-end">
                                                                    <View className="flex-row items-baseline">
                                                                        <Text className="text-white text-xl font-black tracking-tighter shadow-sm mr-1">
                                                                            {item.mainText}
                                                                        </Text>
                                                                    </View>
                                                                </View>
                                                            </View>

                                                            {/* Bottom: Full Width Progress Bar */}
                                                            <View className="w-full h-1.5 bg-black/10 rounded-full overflow-hidden">
                                                                <View
                                                                    style={{ width: `${(item as any).percent || 0}%` }}
                                                                    className="h-full bg-white rounded-full shadow-sm"
                                                                />
                                                            </View>
                                                        </>
                                                    )}
                                                </View>
                                            ) : (
                                                <View className="flex-row items-center h-full justify-between">
                                                    <View className="flex-row items-center">
                                                        <View className="w-10 h-10 bg-white/20 rounded-xl items-center justify-center mr-3 border border-white/10 shadow-lg">
                                                            <Flame size={20} color="white" fill="white" />
                                                        </View>
                                                        <View>
                                                            <Text className="text-white font-black text-base tracking-tight">{item.title}</Text>
                                                            <Text className="text-white/80 text-xs font-bold mt-0.5">{item.subtitle}</Text>
                                                        </View>
                                                    </View>

                                                    <View className="bg-white/90 px-4 py-2 rounded-xl shadow-sm">
                                                        <Text className="text-red-600 font-black text-sm">開始</Text>
                                                    </View>
                                                </View>
                                            )}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            );
                        }}
                    />

                    {/* Pagination Dots */}
                    <View className="flex-row justify-center gap-2 mt-3">
                        {missions.map((_, i) => (
                            <View
                                key={i}
                                className={clsx(
                                    "h-1 rounded-full transition-all duration-300",
                                    i === currentMissionIndex ? "w-8 bg-slate-300" : "w-1.5 bg-slate-100"
                                )}
                            />
                        ))}
                    </View>
                </View>

                {/* 3. Main Actions */}
                <View className="px-4 mb-1">
                    {/* Premium Banner (if not premium) */}
                    {!isPremium && !premiumLoading && (
                        <TouchableOpacity
                            onPress={() => router.push('/purchase')}
                            className="bg-slate-900 p-5 rounded-3xl mb-4 flex-row items-center overflow-hidden relative shadow-lg"
                        >
                            <LinearGradient
                                colors={['rgba(255,255,255,0.1)', 'transparent']}
                                className="absolute top-0 right-0 left-0 h-1/2"
                            />
                            <View className="w-12 h-12 bg-yellow-400 items-center justify-center rounded-2xl mr-4 shadow-sm">
                                <Star size={24} color="#1e293b" fill="#1e293b" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-white font-black text-base">PREMIUM PLAN</Text>
                                <Text className="text-slate-400 text-sm font-bold leading-5">
                                    すべての機能が無制限で使い放題になります。
                                </Text>
                            </View>
                            <ArrowRight size={20} color="#cbd5e1" />
                        </TouchableOpacity>
                    )}

                    <Text className="text-slate-800 font-black text-xl mb-1 ml-1">Bookshelf</Text>

                    <View className="flex-row gap-2 mb-2">
                        {/* Common Subjects */}
                        <TouchableOpacity
                            onPress={() => router.push(`/folders/${variant === 'care' ? 'common' : 'common_social'}`)}
                            activeOpacity={0.7}
                            className="flex-1 bg-white rounded-2xl p-3 border border-slate-100 shadow-sm flex-row items-center"
                        >
                            <View className="w-12 h-12 mr-3 rounded-xl overflow-hidden shadow-sm">
                                <Image
                                    source={require('../../assets/images/menu/common.png')}
                                    className="w-full h-full"
                                    resizeMode="cover"
                                    style={{ width: 48, height: 48 }}
                                />
                            </View>
                            <View className="flex-1 justify-center">
                                <Text className="font-bold text-slate-800 text-base mb-0.5">共通科目</Text>
                                <Text className="text-slate-400 text-xs font-bold" numberOfLines={1}>全ての基礎</Text>
                            </View>
                        </TouchableOpacity>

                        {/* Specialized Subjects (Premium) */}
                        <TouchableOpacity
                            onPress={() => handleLockedContent(`/folders/${variant === 'mental' ? 'spec_mental' :
                                variant === 'care' ? 'spec_care' : 'spec_social'
                                }`)}
                            activeOpacity={0.7}
                            className="flex-1 bg-white rounded-2xl p-3 border border-slate-100 shadow-sm flex-row items-center relative overflow-hidden"
                        >
                            <View className="w-12 h-12 mr-3 rounded-xl overflow-hidden shadow-sm relative">
                                <Image
                                    source={require('../../assets/images/menu/special.png')}
                                    className="w-full h-full"
                                    resizeMode="cover"
                                    style={{ width: 48, height: 48 }}
                                />
                                {!isPremium && (
                                    <View className="absolute inset-0 bg-black/40 items-center justify-center">
                                        <Lock size={14} color="white" />
                                    </View>
                                )}
                            </View>
                            <View className="flex-1 justify-center">
                                <Text className={clsx("font-bold text-base mb-0.5", !isPremium && "text-slate-400")}>専門科目</Text>
                                <Text className="text-slate-400 text-xs font-bold" numberOfLines={1}>
                                    {variant === 'mental' ? '精神専門' : variant === 'care' ? '介護専門' : '社会専門'}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Past Exams */}
                    <TouchableOpacity
                        onPress={() => router.push(`/folders/${variant === 'mental' ? 'past_mental' :
                            variant === 'care' ? 'past_kaigo' : 'past_social'
                            }`)}
                        activeOpacity={0.7}
                        className="bg-white rounded-2xl p-3 mb-2 border border-slate-100 shadow-sm flex-row items-center"
                    >
                        <View className="w-12 h-12 mr-3 rounded-xl overflow-hidden shadow-sm">
                            <Image
                                source={require('../../assets/images/menu/past.png')}
                                className="w-full h-full"
                                resizeMode="cover"
                                style={{ width: 48, height: 48 }}
                            />
                        </View>
                        <View className="flex-1 justify-center">
                            <Text className="font-bold text-slate-800 text-base mb-0.5">過去問</Text>
                            <Text className="text-slate-400 text-xs font-bold">過去の試験問題に挑戦</Text>
                        </View>
                        {/* Audio icon removed as requested */}
                    </TouchableOpacity>

                    {/* Other Tools */}
                    <Text className="text-slate-800 font-black text-xl mt-2 mb-1 ml-1">Tools</Text>

                    {/* Flashcards (Memorization) */}
                    <TouchableOpacity
                        onPress={() => handleLockedContent('/flashcards')}
                        activeOpacity={0.7}
                        className="bg-white rounded-2xl p-3 mb-2 border border-slate-100 shadow-sm flex-row items-center relative overflow-hidden"
                    >
                        <View className="w-12 h-12 mr-3 rounded-xl overflow-hidden shadow-sm relative">
                            <Image
                                source={require('../../assets/images/flashcards_icon.png')}
                                className="w-full h-full"
                                resizeMode="cover"
                                style={{ width: 48, height: 48 }}
                            />
                            {!isPremium && (
                                <View className="absolute inset-0 bg-black/40 items-center justify-center">
                                    <Lock size={16} color="white" />
                                </View>
                            )}
                        </View>
                        <View className="flex-1 justify-center">
                            <Text className={clsx("font-bold text-lg mb-0.5", !isPremium && "text-slate-400")}>頻出単語暗記カード</Text>
                            <Text className="text-slate-400 text-xs font-bold" numberOfLines={1}>頻出単語を暗記</Text>
                        </View>
                    </TouchableOpacity>

                    {/* Audio Player */}
                    <TouchableOpacity
                        onPress={() => handleLockedContent('/audio-player')}
                        activeOpacity={0.7}
                        className="bg-white rounded-2xl p-3 mb-0 border border-slate-100 shadow-sm flex-row items-center relative overflow-hidden"
                    >
                        <View className="w-12 h-12 mr-3 rounded-xl overflow-hidden shadow-sm relative">
                            <Image
                                source={require('../../assets/images/audio_learning_icon.png')}
                                className="w-full h-full"
                                resizeMode="cover"
                                style={{ width: 48, height: 48 }}
                            />
                            {!isPremium && (
                                <View className="absolute inset-0 bg-black/40 items-center justify-center">
                                    <Lock size={16} color="white" />
                                </View>
                            )}
                        </View>
                        <View className="flex-1 justify-center">
                            <Text className={clsx("font-bold text-lg mb-0.5", !isPremium && "text-slate-400")}>聞き流しプレイヤー</Text>
                            <Text className="text-slate-400 text-xs font-bold" numberOfLines={1}>音声で効率学習</Text>
                        </View>
                    </TouchableOpacity>

                </View>
            </ScrollView>
        </SafeAreaView >
    );
}
