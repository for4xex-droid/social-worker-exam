import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, BookOpen, Brain, ArrowRight, Lock, Trophy, PlayCircle, CheckCircle, Circle, RotateCcw } from 'lucide-react-native';
import { useBookshelf } from '../../hooks/useBookshelf';
import { THEME } from '../../constants/Config';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../db/client';
import { questions } from '../../db/schema';
import { eq, and, or, isNull, gt, asc, inArray } from 'drizzle-orm';
import { useEffect, useState } from 'react';
import { usePremium } from '../../constants/premium';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function FolderScreen() {
    const { group } = useLocalSearchParams();
    const router = useRouter();
    const { items, loading } = useBookshelf(); // Fetches ALL items. Optimized later?
    const { isPremium, loading: premiumLoading } = usePremium();

    // Selection Mode State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    // Redirect non-premium users for premium-only folders
    useEffect(() => {
        const isPremiumFolder = group === 'spec_social' || group === 'common_social';
        if (!premiumLoading && !isPremium && isPremiumFolder) {
            router.replace('/purchase');
        }
    }, [isPremium, premiumLoading, group]);

    // Filter items belonging to this group
    const groupItems = items.filter(item => {
        if (group === 'spec_social') return item.group === 'spec_social';
        if (group === 'spec_mental') return item.group === 'spec_mental';
        if (group === 'common_social') return item.group === 'common_social' || item.group === 'common';

        // Fix: Handle specific past exam groups
        if (group === 'past' || group === 'past_mental' || group === 'past_social' || group === 'past_kaigo') {
            return item.type === 'past';
        }

        return false;
    });

    if (group === 'past_social' || (group === 'past' && !String(group).includes('mental') && !String(group).includes('care'))) {
        const mockItem = {
            id: 'mock_social_all',
            title: '🏆 全国統一模擬試験 (過去3年分)',
            group: 'past',
            type: 'mock',
            isLocked: false,
            masteredCount: 0,
            questionCount: 150,
            firstQuestionId: null
        };
        groupItems.unshift(mockItem as any);
    }

    const title = group === 'spec_social' ? '専門科目 (AI予想)'
        : group === 'spec_mental' ? '専門科目 (AI予想・精神)'
            : group === 'common_social' ? '共通科目 (AI予想)'
                : (String(group).startsWith('past') ? '過去問アーカイブ' : 'フォルダ');

    const BRAND_COLOR = THEME.colors.primary;

    // Jewel Gradient Definitions
    const JEWEL_STYLES = [
        { gradient: ['#3B82F6', '#2DD4BF'], shadow: '#3B82F6' }, // Sapphire
        { gradient: ['#8B5CF6', '#D946EF'], shadow: '#8B5CF6' }, // Amethyst
        { gradient: ['#10B981', '#34D399'], shadow: '#10B981' }, // Emerald
        { gradient: ['#F59E0B', '#FBBF24'], shadow: '#F59E0B' }, // Topaz
        { gradient: ['#EF4444', '#FB7185'], shadow: '#EF4444' }, // Ruby
        { gradient: ['#6366F1', '#A5B4FC'], shadow: '#6366F1' }, // Indigo
    ];

    const getJewelStyle = (index: number) => JEWEL_STYLES[index % JEWEL_STYLES.length];

    const getResumeKey = (item: any) => {
        let key = '';
        if (item.type === 'past') {
            key = `resume_cursor_${item.group}_${item.id}_v2`; // item.id is year
            // HOTFIX for R6 consistency
            if (item.id.includes('令和6')) {
                key = 'resume_cursor_social_R6_v3';
            }
        } else if (item.id.includes('::')) {
            const [grp, label] = item.id.split('::');
            key = `resume_cursor_${grp}_${label}_v2`;
        }
        return key;
    };



    const startMockExam = async () => {
        // Reset previously selected items if any
        if (isSelectionMode) setIsSelectionMode(false);

        const runMockLogic = async () => {
            try {
                // Using explicit OR for better Web compatibility
                const allQ = await db.select({ id: questions.id }).from(questions)
                    .where(and(
                        or(
                            eq(questions.year, "令和6年度"),
                            eq(questions.year, "令和5年度"),
                            eq(questions.year, "令和4年度")
                        ),
                        eq(questions.group, 'past_social')
                    ));

                console.log(`Mock Exam: Found ${allQ.length} questions.`);

                if (allQ.length < 150) {
                    const msg = `問題データが不足しています。(Found: ${allQ.length})`;
                    if (Platform.OS === 'web') window.alert(msg);
                    else Alert.alert("エラー", msg);
                    return;
                }

                // Shuffle & Pick 150
                const shuffled = allQ.sort(() => 0.5 - Math.random());
                const selected = shuffled.slice(0, 150);
                const selectedIds = selected.map((q: any) => q.id);

                // Save Session
                const session = {
                    queue: selectedIds,
                    currentIndex: 0,
                    results: Array(150).fill(null), // null = unanswered, true/false
                    startTime: Date.now()
                };

                await AsyncStorage.setItem('mock_exam_session', JSON.stringify(session));

                // Navigate
                router.push(`/quiz/${selectedIds[0]}?mode=mock`);
            } catch (e) {
                console.error(e);
                const msg = "試験データの作成に失敗しました。";
                if (Platform.OS === 'web') window.alert(msg);
                else Alert.alert("エラー", msg);
            }
        };

        const title = "模擬試験を開始";
        const message = "過去3年間（R4-R6）の問題からランダムに150問出題されます。\n中断しても途中から再開できます。";

        if (Platform.OS === 'web') {
            if (window.confirm(`${title}\n${message}`)) {
                await runMockLogic();
            }
        } else {
            Alert.alert(
                title,
                message,
                [
                    { text: "キャンセル", style: "cancel" },
                    {
                        text: "開始する",
                        onPress: runMockLogic
                    }
                ]
            );
        }
    };

    const handlePress = async (item: any) => {
        if (item.type === 'mock') {
            await startMockExam();
            return;
        }

        if (isSelectionMode) {
            const newSelected = new Set(selectedItems);
            if (newSelected.has(item.id)) {
                newSelected.delete(item.id);
            } else {
                newSelected.add(item.id);
            }
            setSelectedItems(newSelected);
            return;
        }

        if (item.isLocked) {
            // Handle lock
            if (!isPremium) {
                router.push('/purchase');
            }
            return;
        }

        // Try Resume Logic
        try {
            const key = getResumeKey(item);
            console.log(`Checking resume key: ${key}`);

            if (key) {
                const lastId = await AsyncStorage.getItem(key);
                console.log(`Resume check for ${key}: ${lastId}`);
                if (lastId) {
                    // Resume from EXACTLY the last saved ID (because ID is saved on mount)
                    // Verify it exists first
                    const exactQ = await db.select().from(questions)
                        .where(eq(questions.id, lastId))
                        .limit(1);

                    if (exactQ.length > 0) {
                        console.log("Resuming at exact ID:", lastId);
                        router.push(`/quiz/${lastId}`);
                        return;
                    } else {
                        // If that question no longer exists, fall back to start or find next
                        console.log("Resume ID not found, falling back.");
                    }
                }
            }
        } catch (e) {
            console.error("Resume error:", e);
        }

        // Fallback: Start from beginning
        // We need to find the first question ID.
        let firstId = item.firstQuestionId;

        // If not readily available (should be from useBookshelf), query it
        if (!firstId) {
            // ... (Simple query logic if needed, but useBookshelf should provide it)
            // Just try searching DB based on item.id logic
            console.warn("No firstQuestionId found, attempting blind jump");
        }

        if (firstId) {
            router.push(`/quiz/${firstId}`);
        } else {
            // Last resort: query DB
            try {
                // Logic mirrors useBookshelf grouping
                // Spec/Common: item.id is categoryLabel (prefixed with group::)
                // Past: item.id is year
                let q = null;
                if (item.type === 'past') {
                    q = await db.select().from(questions).where(eq(questions.year, item.id)).orderBy(asc(questions.id)).limit(1);
                } else {
                    const [grp, label] = item.id.split('::');
                    q = await db.select().from(questions)
                        .where(and(eq(questions.group, grp), eq(questions.categoryLabel, label)))
                        .orderBy(asc(questions.id)).limit(1);
                }
                if (q && q.length > 0) {
                    router.push(`/quiz/${q[0].id}`);
                } else {
                    Alert.alert("Error", "No questions found for this section.");
                }
            } catch (e) {
                console.error(e);
            }
        }
    };

    const handleAudioPress = (item: any) => {
        if (item.isLocked) {
            if (!isPremium) {
                router.push('/purchase');
            }
            return;
        }

        let mode = '';
        let value = '';

        if (item.type === 'past') {
            mode = 'year';
            value = item.id;
        } else if (item.id.includes('::')) {
            const [grp, label] = item.id.split('::');
            mode = 'category';
            value = label;
        } else {
            console.warn("Unknown item ID format for audio:", item.id);
            return;
        }

        router.push({
            pathname: '/audio-player',
            params: { mode, value }
        });
    };

    const handleReset = async () => {
        Alert.alert(
            "進捗のリセット",
            "選択したブックの「続きから」データを削除し、最初から開始できるようにしますか？（学習履歴は消えません）",
            [
                { text: "キャンセル", style: "cancel" },
                {
                    text: "リセット",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const keysToRemove = [];
                            for (const itemId of selectedItems) {
                                const item = groupItems.find(i => i.id === itemId);
                                if (item) {
                                    const key = getResumeKey(item);
                                    if (key) keysToRemove.push(key);
                                }
                            }
                            if (keysToRemove.length > 0) {
                                await AsyncStorage.multiRemove(keysToRemove);
                                Alert.alert("完了", "進捗をリセットしました。");
                                setIsSelectionMode(false);
                                setSelectedItems(new Set());
                            } else {
                                Alert.alert("情報", "リセット対象が見つかりません。");
                            }
                        } catch (e) {
                            console.error("Reset failed", e);
                            Alert.alert("エラー", "リセットに失敗しました。");
                        }
                    }
                }
            ]
        );
    };

    const toggleSelectionMode = () => {
        if (isSelectionMode) {
            setIsSelectionMode(false);
            setSelectedItems(new Set());
        } else {
            setIsSelectionMode(true);
        }
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: THEME.colors.background }}>
                <ActivityIndicator size="large" color={THEME.colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: THEME.colors.background }}>
            <Stack.Screen options={{
                headerShown: false
            }} />

            {/* Header */}
            <View style={{
                paddingHorizontal: 24,
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center', // Title centered
                position: 'relative',
                marginBottom: 8
            }}>
                {/* Back Button */}
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{
                        position: 'absolute',
                        left: 24,
                        width: 40,
                        height: 40,
                        backgroundColor: 'white',
                        borderRadius: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 3,
                        zIndex: 10
                    }}
                >
                    <ArrowLeft color="#64748B" size={20} />
                </TouchableOpacity>

                {/* Title */}
                <Text style={{
                    fontSize: 18,
                    fontWeight: '900',
                    color: THEME.colors.text,
                    textAlign: 'center',
                    maxWidth: '60%'
                }} numberOfLines={1}>
                    {title}
                </Text>

                {/* Selection Button */}
                <TouchableOpacity
                    onPress={toggleSelectionMode}
                    style={{
                        position: 'absolute',
                        right: 24,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        backgroundColor: isSelectionMode ? THEME.colors.primary + '20' : 'transparent',
                        borderRadius: 20
                    }}
                >
                    <Text style={{ color: THEME.colors.primary, fontWeight: 'bold', fontSize: 14 }}>
                        {isSelectionMode ? "キャンセル" : "選択"}
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {groupItems.map((item, index) => {
                    const style = getJewelStyle(index);
                    const isSelected = selectedItems.has(item.id);

                    return (
                        <TouchableOpacity
                            key={item.id}
                            onPress={() => handlePress(item)}
                            activeOpacity={0.9}
                            style={{
                                marginBottom: 16,
                                borderRadius: 16,
                                backgroundColor: THEME.colors.card, // Fallback
                                overflow: 'hidden',
                                elevation: 4,
                                shadowColor: style.shadow,
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 8,
                                borderWidth: isSelectionMode && isSelected ? 2 : 0,
                                borderColor: THEME.colors.primary
                            }}
                        >
                            <LinearGradient
                                colors={item.isLocked ? ['#334155', '#1e293b'] : style.gradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={{ padding: 20 }}
                            >
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                            {item.type === 'past' ? <Brain color="white" size={20} style={{ marginRight: 8 }} /> : <BookOpen color="white" size={20} style={{ marginRight: 8 }} />}
                                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'white', opacity: 0.9 }}>
                                                {item.title}
                                            </Text>
                                        </View>

                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            {item.isLocked ? (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                                                    <Lock color="#fbbf24" size={12} style={{ marginRight: 4 }} />
                                                    <Text style={{ color: '#fbbf24', fontSize: 12, fontWeight: 'bold' }}>PREMIUM</Text>
                                                </View>
                                            ) : (
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Trophy color="white" size={14} style={{ marginRight: 4, opacity: 0.8 }} />
                                                    <Text style={{ color: 'white', fontSize: 13, opacity: 0.8 }}>
                                                        習熟度: {item.masteredCount}/{item.questionCount}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    {isSelectionMode ? (
                                        <View>
                                            {isSelected ? <CheckCircle color="white" size={28} /> : <Circle color="rgba(255,255,255,0.5)" size={28} />}
                                        </View>
                                    ) : (
                                        <TouchableOpacity
                                            onPress={() => handleAudioPress(item)}
                                            style={{
                                                backgroundColor: 'rgba(255,255,255,0.2)',
                                                width: 40, height: 40,
                                                borderRadius: 20,
                                                justifyContent: 'center', alignItems: 'center'
                                            }}
                                        >
                                            {item.isLocked ? <Lock color="white" size={20} /> : <PlayCircle color="white" size={24} />}
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    );
                })}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Bottom Action Bar for Selection Mode */}
            {isSelectionMode && (
                <View style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    backgroundColor: THEME.colors.card,
                    padding: 16,
                    borderTopWidth: 1,
                    borderTopColor: THEME.colors.border,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingBottom: 34, // Safe area
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 5
                }}>
                    <Text style={{ color: THEME.colors.textSecondary, fontWeight: 'bold' }}>{selectedItems.size} 件を選択中</Text>
                    <TouchableOpacity
                        onPress={handleReset}
                        disabled={selectedItems.size === 0}
                        style={{
                            backgroundColor: '#EF4444', // 鮮やかな赤
                            paddingHorizontal: 24,
                            paddingVertical: 12,
                            borderRadius: 30,
                            flexDirection: 'row',
                            alignItems: 'center',
                            opacity: selectedItems.size > 0 ? 1 : 0.5, // 非活性時は薄く
                            shadowColor: "#EF4444",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 6,
                            elevation: 4
                        }}
                    >
                        <RotateCcw color="white" size={18} style={{ marginRight: 8 }} />
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>1問目からリセット</Text>
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}
