
import { View, Text, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Check, X, RotateCw, Brain, Lightbulb } from 'lucide-react-native';
import { useState, useEffect, useRef } from 'react';
import { db, saveDb } from '../../db/client';
import { memorizationCards, cardStudyLogs } from '../../db/schema';
import { sql, eq, and, isNull, lt, isNotNull } from 'drizzle-orm';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    interpolate,
    withTiming,
    runOnJS
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

export default function FlashcardPlayer() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const mode = params.mode || 'all';

    const [cards, setCards] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isFlipped, setIsFlipped] = useState(false);
    const [sessionStats, setSessionStats] = useState({ ok: 0, ng: 0, total: 0 });
    const [finished, setFinished] = useState(false);

    // Animation values
    const flipProgress = useSharedValue(0);
    const cardScale = useSharedValue(1);
    const cardOpacity = useSharedValue(1);

    // Fetch Cards
    useEffect(() => {
        const loadCards = async () => {
            if (!db) return;
            try {
                let query = db.select().from(memorizationCards);

                // Apply Filters based on mode
                if (mode === 'new') {
                    query = query.where(isNull(memorizationCards.lastReviewed));
                } else if (mode === 'weak') {
                    // proficiency < 3 AND not mastered AND has been reviewed at least once
                    query = query.where(and(
                        lt(memorizationCards.proficiency, 3),
                        eq(memorizationCards.isMastered, false),
                        isNotNull(memorizationCards.lastReviewed)
                    ));
                } else if (mode === 'master_review') {
                    query = query.where(eq(memorizationCards.isMastered, true));
                } else if (mode === 'set') {
                    const vol = Number(params.vol || 1);
                    const limit = Number(params.limit || 30);
                    const offset = (vol - 1) * limit;
                    // For sets, use consistent ordering so it feels like a book
                    // Using ID usually works if IDs are sequential or insert order
                    // Assuming numeric-ish IDs or just consistent order
                    // SQLite default order is usually rowid, which is fine
                    query = query.limit(limit).offset(offset);

                    const result = await query;

                    let filtered = result;
                    const filterMode = params.filter;

                    if (filterMode === 'new') {
                        filtered = result.filter((c: any) => c.lastReviewed === null);
                    } else if (filterMode === 'weak') {
                        filtered = result.filter((c: any) =>
                            c.lastReviewed !== null &&
                            c.isMastered !== true &&
                            (c.proficiency || 0) < 3
                        );
                    }

                    // Shuffle
                    const shuffled = filtered.sort(() => Math.random() - 0.5);
                    setCards(shuffled);
                    setLoading(false);
                    return;
                }
                // 'all' gets everything, 'daily' logic can be added later (e.g. spaced repetition)

                // Limit increased to 100 for better usability
                const result = await query.limit(100);

                // Shuffle
                const shuffled = result.sort(() => Math.random() - 0.5);
                setCards(shuffled);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadCards();
    }, [mode]);

    // Flip Logic
    const handleFlip = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (isFlipped) {
            flipProgress.value = withSpring(0);
        } else {
            flipProgress.value = withSpring(180);
        }
        setIsFlipped(!isFlipped);
    };

    const frontAnimatedStyle = useAnimatedStyle(() => {
        const rotateY = interpolate(flipProgress.value, [0, 180], [0, 180]);
        return {
            transform: [{ rotateY: `${rotateY}deg` }],
            opacity: interpolate(flipProgress.value, [0, 90, 180], [1, 0, 0]),
            backfaceVisibility: 'hidden',
        };
    });

    const backAnimatedStyle = useAnimatedStyle(() => {
        const rotateY = interpolate(flipProgress.value, [0, 180], [180, 360]);
        return {
            transform: [{ rotateY: `${rotateY}deg` }],
            opacity: interpolate(flipProgress.value, [0, 90, 180], [0, 0, 1]),
            backfaceVisibility: 'hidden',
        };
    });

    // Rating Logic
    const handleResult = async (result: 'ok' | 'ng') => {
        Haptics.notificationAsync(
            result === 'ok' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
        );

        const currentCard = cards[currentIndex];

        // Optimistic UI Update
        const nextIndex = currentIndex + 1;

        // DB Update (Fire and forget)
        updateCardProgress(currentCard.id, result);

        setSessionStats(prev => ({
            ...prev,
            ok: prev.ok + (result === 'ok' ? 1 : 0),
            ng: prev.ng + (result === 'ng' ? 1 : 0),
            total: prev.total + 1
        }));

        // Animate out
        cardScale.value = withTiming(0.9, { duration: 100 }, () => {
            runOnJS(finalizeNextCard)(nextIndex);
        });
    };

    const finalizeNextCard = (nextIndex: number) => {
        if (nextIndex >= cards.length) {
            setFinished(true);
        } else {
            setIsFlipped(false);
            flipProgress.value = 0; // Reset flip
            cardScale.value = withSpring(1);
            setCurrentIndex(nextIndex);
        }
    };

    const updateCardProgress = async (cardId: string, result: 'ok' | 'ng') => {
        if (!db) return;
        try {
            await db.transaction(async (tx: any) => {
                // Log the study
                await tx.insert(cardStudyLogs).values({
                    cardId,
                    result,
                    timestamp: new Date()
                });

                // Update card stats
                const card = await tx.select().from(memorizationCards).where(eq(memorizationCards.id, cardId)).get();
                if (card) {
                    let newProficiency = card.proficiency || 0;
                    let isMastered = card.isMastered;

                    if (result === 'ok') {
                        // User mastered the card immediately
                        newProficiency = 5;
                        isMastered = true;
                    } else {
                        // User forgot or is weak
                        // Set to 1 so it's not "new" (0) but still weak (< 3)
                        newProficiency = 1;
                        isMastered = false;
                    }

                    await tx.update(memorizationCards)
                        .set({
                            proficiency: newProficiency,
                            isMastered: isMastered ? 1 : 0,
                            lastReviewed: new Date()
                        })
                        .where(eq(memorizationCards.id, cardId));
                }
            });
            await saveDb();
        } catch (e) {
            console.error("Failed to update card progress", e);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-slate-50">
                <ActivityIndicator size="large" color="#D97706" />
                <Text className="mt-4 text-slate-500 font-bold">カードを準備中...</Text>
            </View>
        );
    }

    if (cards.length === 0) {
        return (
            <View className="flex-1 items-center justify-center bg-slate-50 px-8">
                <Stack.Screen options={{ headerShown: false }} />
                <View className="bg-amber-100 p-6 rounded-full mb-6">
                    <Check size={48} color="#D97706" />
                </View>
                <Text className="text-xl font-black text-slate-800 mb-2 text-center">学習対象がありません</Text>
                <Text className="text-slate-500 text-center mb-8 font-medium leading-6">
                    このモードのカードはすべて学習済みか、まだ登録されていません。他のモードを試してみてください。
                </Text>
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="bg-amber-500 py-4 px-8 rounded-xl shadow-sm w-full"
                >
                    <Text className="text-white font-bold text-center text-lg">戻る</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (finished) {
        return (
            <View className="flex-1 items-center justify-center bg-slate-50 px-8">
                <Stack.Screen options={{ headerShown: false }} />
                <View className="bg-amber-100 p-6 rounded-full mb-6">
                    <Brain size={48} color="#D97706" />
                </View>
                <Text className="text-2xl font-black text-slate-800 mb-2 text-center">学習完了！</Text>
                <Text className="text-slate-500 text-center mb-8 font-medium">お疲れ様でした。</Text>

                <View className="flex-row gap-4 mb-8 w-full">
                    <View className="flex-1 bg-white p-4 rounded-2xl border border-slate-100 items-center">
                        <Text className="text-3xl font-black text-green-500">{sessionStats.ok}</Text>
                        <Text className="text-xs font-bold text-slate-400">覚えた</Text>
                    </View>
                    <View className="flex-1 bg-white p-4 rounded-2xl border border-slate-100 items-center">
                        <Text className="text-3xl font-black text-red-500">{sessionStats.ng}</Text>
                        <Text className="text-xs font-bold text-slate-400">要復習</Text>
                    </View>
                </View>

                <TouchableOpacity
                    onPress={() => router.back()}
                    className="bg-amber-500 py-4 px-8 rounded-xl shadow-lg shadow-amber-200 w-full"
                >
                    <Text className="text-white font-bold text-center text-lg">完了して戻る</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const currentCard = cards[currentIndex];

    return (
        <View className="flex-1 bg-slate-100">
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="flex-row items-center justify-between px-5 pt-2 mb-4 z-10">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="w-10 h-10 bg-white rounded-full items-center justify-center shadow-sm active:bg-slate-50"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <ArrowLeft size={24} color="#64748B" />
                    </TouchableOpacity>
                    <View>
                        <Text className="text-slate-500 font-bold text-xs text-center">PROGRESS</Text>
                        <Text className="text-slate-800 font-black text-lg text-center">
                            {currentIndex + 1} <Text className="text-sm text-slate-400">/ {cards.length}</Text>
                        </Text>
                    </View>
                    <View className="w-10 h-10" />
                </View>

                {/* Card Container */}
                <View className="flex-1 px-5 justify-center pb-20">
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={handleFlip}
                        className="w-full aspect-[3/4] max-h-[500px]"
                    >
                        {/* Front Side (Definition) */}
                        <Animated.View
                            className="absolute w-full h-full bg-white rounded-3xl shadow-sm border border-slate-200 p-8 items-center justify-center"
                            style={[frontAnimatedStyle, { transformOrigin: 'center' }]}
                        >
                            <View className="absolute top-6 left-6 bg-slate-100 px-3 py-1 rounded-lg">
                                <Text className="text-xs font-bold text-slate-500">DEFINITION</Text>
                            </View>
                            <Text className="text-xl font-bold text-slate-700 text-center leading-8">
                                {currentCard.definition}
                            </Text>
                            <View className="absolute bottom-8 flex-row items-center gap-2">
                                <RotateCw size={16} color="#94A3B8" />
                                <Text className="text-slate-400 text-xs font-bold">タップして答えを表示</Text>
                            </View>
                        </Animated.View>

                        {/* Back Side (Term - Answer) */}
                        <Animated.View
                            className="absolute w-full h-full bg-slate-800 rounded-3xl shadow-xl border border-slate-700 p-8 items-center justify-center"
                            style={[backAnimatedStyle, { transformOrigin: 'center' }]}
                        >
                            <View className="absolute top-6 left-6 bg-slate-700 px-3 py-1 rounded-lg">
                                <Text className="text-xs font-bold text-amber-400">ANSWER</Text>
                            </View>
                            <Text className="text-3xl font-black text-white text-center leading-10 shadow-lg">
                                {currentCard.term}
                            </Text>
                            <View className="absolute bottom-8 w-full px-4">
                                <View className="bg-slate-700/50 p-3 rounded-xl">
                                    <Text className="text-slate-300 text-xs font-medium text-center">
                                        {currentCard.categoryLabel || '一般用語'}
                                    </Text>
                                </View>
                            </View>
                        </Animated.View>
                    </TouchableOpacity>
                </View>

                {/* Controls */}
                <View className="absolute bottom-0 w-full px-5 pb-8 pt-4">
                    {isFlipped ? (
                        <View className="flex-row gap-4">
                            <TouchableOpacity
                                onPress={() => handleResult('ng')}
                                className="flex-1 bg-red-100 py-4 rounded-2xl items-center border border-red-200 active:bg-red-200"
                            >
                                <X size={24} color="#EF4444" className="mb-1" />
                                <Text className="text-red-700 font-bold">まだ不安</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => handleResult('ok')}
                                className="flex-1 bg-green-100 py-4 rounded-2xl items-center border border-green-200 active:bg-green-200"
                            >
                                <Check size={24} color="#22C55E" className="mb-1" />
                                <Text className="text-green-700 font-bold">覚えた！</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            onPress={handleFlip}
                            className="w-full bg-slate-800 py-4 rounded-2xl items-center shadow-lg active:bg-slate-700"
                        >
                            <Text className="text-white font-bold text-lg">答えを見る</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </SafeAreaView>
        </View>
    );
}
