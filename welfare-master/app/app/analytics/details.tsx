import { View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Target, TrendingUp, CheckCircle2, Award, Search } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { db } from '../../db/client';
import { questions, userProgress } from '../../db/schema';
import { eq, count, isNotNull } from 'drizzle-orm';
import { THEME } from '../../constants/Config';
import { usePremium } from '../../constants/premium';
import { formatCategoryName } from '../../utils/categoryFormatter';

const { width } = Dimensions.get('window');

const JEWEL_STYLES = [
    { gradient: ['#3B82F6', '#2DD4BF'], shadow: '#3B82F6' },
    { gradient: ['#8B5CF6', '#D946EF'], shadow: '#8B5CF6' },
    { gradient: ['#10B981', '#34D399'], shadow: '#10B981' },
    { gradient: ['#F59E0B', '#FBBF24'], shadow: '#F59E0B' },
    { gradient: ['#EF4444', '#FB7185'], shadow: '#EF4444' },
    { gradient: ['#6366F1', '#A5B4FC'], shadow: '#6366F1' },
];

export default function AnalyticsDetailsScreen() {
    const router = useRouter();
    const brandColor = THEME.colors.primary;
    const { isPremium, loading: premiumLoading } = usePremium();

    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Redirect non-premium users
    useEffect(() => {
        if (!premiumLoading && !isPremium) {
            router.replace('/purchase');
        }
    }, [isPremium, premiumLoading]);

    useEffect(() => {
        if (!isPremium) return;

        const fetchAllCategories = async () => {
            try {
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
                        correct: data.correct,
                        style: JEWEL_STYLES[idx % JEWEL_STYLES.length]
                    }))
                    .sort((a, b) => b.progress - a.progress);

                setCategories(sortedCats);
            } catch (err) {
                console.error("Failed to fetch detailed analytics:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchAllCategories();
    }, [isPremium]);

    return (
        <SafeAreaView className="flex-1 bg-slate-50">
            {/* Custom Header */}
            <View className="px-5 py-4 bg-white flex-row items-center border-b border-slate-100">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 bg-slate-50 rounded-full items-center justify-center mr-4"
                >
                    <ChevronLeft size={24} color="#1E293B" />
                </TouchableOpacity>
                <View>
                    <Text className="text-xl font-black text-slate-900">分析詳細レポート</Text>
                    <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Category Performance</Text>
                </View>
            </View>

            <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Summary View */}
                <View className="flex-row gap-3 py-6">
                    <View className="flex-1 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                        <Text className="text-slate-400 text-[10px] font-black mb-1">対象カテゴリー数</Text>
                        <Text className="text-2xl font-black text-slate-800">{categories.length}</Text>
                    </View>
                    <View className="flex-1 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                        <Text className="text-slate-400 text-[10px] font-black mb-1">全解答数</Text>
                        <Text className="text-2xl font-black text-slate-800">
                            {categories.reduce((acc, cat) => acc + cat.total, 0).toLocaleString()} <Text className="text-xs text-slate-400">問</Text>
                        </Text>
                    </View>
                </View>

                {/* List Header */}
                <View className="flex-row items-center justify-between mb-4 px-1">
                    <Text className="text-lg font-black text-slate-800">カテゴリー別正解率</Text>
                    <View className="flex-row items-center bg-slate-200/50 px-3 py-1.5 rounded-full">
                        <TrendingUp size={14} color="#64748B" />
                        <Text className="text-[10px] font-bold text-slate-500 ml-1.5">達成度順</Text>
                    </View>
                </View>

                {loading ? (
                    <View className="py-20 items-center">
                        <Text className="text-slate-400 font-bold">データを読み込み中...</Text>
                    </View>
                ) : categories.length === 0 ? (
                    <View className="bg-white p-10 rounded-[32px] items-center">
                        <Text className="text-slate-400 font-bold">まだ学習データがありません。</Text>
                    </View>
                ) : (
                    categories.map((item, index) => (
                        <MotiView
                            key={index}
                            from={{ opacity: 0, translateY: 10 }}
                            animate={{ opacity: 1, translateY: 0 }}
                            transition={{ delay: index * 50 } as any}
                            className="bg-white p-4 rounded-[28px] mb-3 border border-slate-50 shadow-sm shadow-slate-200/50"
                        >
                            <View className="flex-row items-center mb-2">
                                <LinearGradient
                                    colors={item.style.gradient as any}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                                >
                                    <Target size={20} color="white" />
                                </LinearGradient>
                                <View className="flex-1">
                                    <View className="flex-row justify-between items-center mb-0.5">
                                        <Text className="font-black text-slate-800 text-base flex-1 mr-2" numberOfLines={2}>
                                            {formatCategoryName(item.name)}
                                        </Text>
                                        <Text className="font-black text-slate-900 text-lg">{item.progress}%</Text>
                                    </View>
                                    <Text className="text-slate-400 text-[10px] font-bold">
                                        {item.correct} 正解 / {item.total} 解答
                                    </Text>
                                </View>
                            </View>

                            {/* Progress Details */}
                            <View className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                                <LinearGradient
                                    colors={item.style.gradient as any}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    className="h-full rounded-full"
                                    style={{ width: `${item.progress}%` }}
                                />
                            </View>

                            <View className="flex-row gap-2 mt-1 pl-1">
                                <View className="bg-emerald-100 px-3 py-1 rounded-full flex-row items-center">
                                    <CheckCircle2 size={12} color="#059669" />
                                    <Text className="text-emerald-700 text-[10px] font-black ml-1.5">得意エリア</Text>
                                </View>
                                {item.progress < 60 && (
                                    <View className="bg-rose-100 px-3 py-1 rounded-full flex-row items-center">
                                        <Award size={12} color="#BE123C" />
                                        <Text className="text-rose-700 text-[10px] font-black ml-1.5">要強化</Text>
                                    </View>
                                )}
                            </View>
                        </MotiView>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
