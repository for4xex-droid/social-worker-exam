import { View, Text, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, TrendingUp, Calendar, CheckCircle2, Award, ListFilter, BarChart3 } from 'lucide-react-native';
import { useEffect, useState, useMemo } from 'react';
import { db } from '../../../db/client';
import { userProgress, questions } from '../../../db/schema';
import { sql, desc, eq, and, isNotNull } from 'drizzle-orm';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { formatCategoryName } from '../../../utils/categoryFormatter';

const { width } = Dimensions.get('window');

type HistoryData = {
    date: string;
    count: number;
    correct: number;
};

type CategoryData = {
    name: string;
    count: number;
    correct: number;
    mastered?: number;
};

type TabType = 'timeline' | 'category';

export default function AnalyticsHistoryScreen() {
    const { type } = useLocalSearchParams(); // total, rate, streak, mastered
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<HistoryData[]>([]);
    const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
    const [masteredList, setMasteredList] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>('timeline');

    const config = useMemo(() => {
        switch (type) {
            case 'total':
                return {
                    title: '総解答数データ',
                    subtitle: '日々の努力と分野別学習量',
                    color: '#3B82F6',
                    icon: TrendingUp,
                    gradient: ['#3B82F6', '#2DD4BF']
                };
            case 'rate':
                return {
                    title: '正解率データ',
                    subtitle: '理解度の推移と得意・不得意',
                    color: '#10B981',
                    icon: CheckCircle2,
                    gradient: ['#10B981', '#34D399']
                };
            case 'streak':
                return {
                    title: '学習カレンダー',
                    subtitle: '学習習慣の記録',
                    color: '#8B5CF6',
                    icon: Calendar,
                    gradient: ['#8B5CF6', '#D946EF']
                };
            case 'mastered':
                return {
                    title: 'マスター済みデータ',
                    subtitle: '完全習得した問題と分野',
                    color: '#F59E0B',
                    icon: Award,
                    gradient: ['#F59E0B', '#FBBF24']
                };
            default:
                return {
                    title: '詳細データ',
                    subtitle: '',
                    color: '#64748B',
                    icon: TrendingUp,
                    gradient: ['#64748B', '#94A3B8']
                };
        }
    }, [type]);

    useEffect(() => {
        loadData();
    }, [type]);

    const loadData = async () => {
        try {
            setLoading(true);

            // 1. Fetch Timeline Data (Common)
            const progressRaw = await db.select({
                timestamp: userProgress.timestamp,
                isCorrect: userProgress.isCorrect,
                questionId: userProgress.questionId
            })
                .from(userProgress)
                .orderBy(desc(userProgress.timestamp))
                .limit(2000);

            const aggHistory: Record<string, { count: number, correct: number }> = {};
            progressRaw.forEach((row: any) => {
                const date = new Date(row.timestamp).toLocaleDateString('ja-JP');
                if (!aggHistory[date]) aggHistory[date] = { count: 0, correct: 0 };
                aggHistory[date].count++;
                if (row.isCorrect) aggHistory[date].correct++;
            });

            const sortedHistory = Object.entries(aggHistory).map(([date, data]) => ({
                date,
                count: data.count,
                correct: data.correct
            })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            setHistory(sortedHistory);

            // 2. Fetch Category Breakdown Data
            const categoryMap: Record<string, { count: number, correct: number, mastered: number }> = {};

            if (type === 'mastered') {
                // For mastered, we query the questions table directly
                const masteredRes = await db.select({
                    id: questions.id,
                    text: questions.questionText,
                    category: questions.categoryLabel,
                })
                    .from(questions)
                    .where(eq(questions.isMastered, true));

                setMasteredList(masteredRes);

                masteredRes.forEach((q: any) => {
                    const cat = q.category || '未分類';
                    if (!categoryMap[cat]) categoryMap[cat] = { count: 0, correct: 0, mastered: 0 };
                    categoryMap[cat].mastered++;
                });

                setActiveTab('category'); // Default to category for mastered if list is long
            } else {
                // For other metrics, join progress with questions
                const catStats = await db.select({
                    category: questions.categoryLabel,
                    isCorrect: userProgress.isCorrect
                })
                    .from(userProgress)
                    .innerJoin(questions, eq(userProgress.questionId, questions.id))
                    .where(isNotNull(questions.categoryLabel));

                catStats.forEach((row: any) => {
                    const cat = row.category || '未分類';
                    if (!categoryMap[cat]) categoryMap[cat] = { count: 0, correct: 0, mastered: 0 };
                    categoryMap[cat].count++;
                    if (row.isCorrect) categoryMap[cat].correct++;
                });
            }

            const sortedCats = Object.entries(categoryMap).map(([name, data]) => ({
                name,
                count: data.count,
                correct: data.correct,
                mastered: data.mastered
            })).sort((a, b) => {
                if (type === 'rate') {
                    // Sort by rate descending, then count
                    const rateA = a.count > 0 ? a.correct / a.count : 0;
                    const rateB = b.count > 0 ? b.correct / b.count : 0;
                    return rateB - rateA;
                } else if (type === 'mastered') {
                    return (b.mastered || 0) - (a.mastered || 0);
                }
                return b.count - a.count;
            });

            setCategoryData(sortedCats);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const renderChart = () => {
        if (history.length === 0) return <Text className="text-slate-400 text-center py-10">データがありません</Text>;

        const maxVal = Math.max(...history.map(d => type === 'rate' ? 100 : d.count));

        return (
            <View className="flex-row items-end justify-between h-48 pt-4 pb-2 px-2">
                {history.slice(-7).map((d, i) => {
                    const val = type === 'rate' ? Math.round((d.correct / d.count) * 100) : d.count;
                    const heightPct = maxVal > 0 ? (val / maxVal) * 100 : 0;

                    return (
                        <View key={i} className="items-center w-[12%]">
                            <Text className="text-[9px] text-slate-400 mb-1 font-bold">{val}{type === 'rate' ? '%' : ''}</Text>
                            <View className="w-full bg-slate-100 rounded-t-lg relative overflow-hidden h-full justify-end">
                                <LinearGradient
                                    colors={config.gradient as any}
                                    style={{ height: `${Math.max(10, heightPct)}%`, width: '100%', borderRadius: 4 }}
                                />
                            </View>
                            <Text className="text-[9px] text-slate-400 mt-1 font-bold">
                                {d.date.split('/')[1]}/{d.date.split('/')[2]}
                            </Text>
                        </View>
                    );
                })}
            </View>
        );
    };

    const renderCategoryList = () => {
        if (categoryData.length === 0) return <Text className="text-slate-400 text-center py-10">カテゴリデータがありません</Text>;

        return (
            <View className="gap-2">
                {categoryData.map((cat, i) => {
                    const rate = cat.count > 0 ? Math.round((cat.correct / cat.count) * 100) : 0;

                    let mainValue = '';
                    let subValue = '';

                    if (type === 'total') {
                        mainValue = `${cat.count}問`;
                        subValue = `正解率 ${rate}%`;
                    } else if (type === 'rate') {
                        mainValue = `${rate}%`;
                        subValue = `${cat.correct}/${cat.count}問`;
                    } else if (type === 'mastered') {
                        mainValue = `${cat.mastered}問`;
                        subValue = 'マスター済';
                    } else {
                        mainValue = `${cat.count}回`;
                    }

                    return (
                        <View key={i} className="bg-white p-4 rounded-xl border border-slate-100 flex-row items-center justify-between">
                            <View className="flex-1 mr-4">
                                <Text className="font-bold text-slate-700 text-sm mb-1">{formatCategoryName(cat.name)}</Text>
                                <View className="h-1.5 bg-slate-100 rounded-full w-full overflow-hidden">
                                    <LinearGradient
                                        colors={config.gradient as any}
                                        style={{ width: type === 'rate' ? `${rate}%` : '100%', height: '100%' }}
                                    />
                                </View>
                            </View>
                            <View className="items-end">
                                <Text className="font-black text-slate-800 text-lg">{mainValue}</Text>
                                {subValue !== '' && <Text className="text-xs text-slate-400 font-bold">{subValue}</Text>}
                            </View>
                        </View>
                    );
                })}
            </View>
        );
    };

    return (
        <View className="flex-1 bg-white">
            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="px-5 py-4 flex-row items-center border-b border-slate-100 bg-white z-10">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="w-10 h-10 bg-slate-50 rounded-full items-center justify-center mr-4"
                    >
                        <ChevronLeft size={24} color="#1E293B" />
                    </TouchableOpacity>
                    <View>
                        <Text className="text-lg font-black text-slate-900">{config.title}</Text>
                        <Text className="text-xs text-slate-400 font-bold">{config.subtitle}</Text>
                    </View>
                </View>

                {/* Tabs */}
                {type !== 'streak' && (
                    <View className="flex-row mx-5 mt-4 bg-slate-100 p-1 rounded-xl">
                        <TouchableOpacity
                            onPress={() => setActiveTab('timeline')}
                            className={`flex-1 flex-row items-center justify-center py-2 rounded-lg ${activeTab === 'timeline' ? 'bg-white shadow-sm' : ''}`}
                        >
                            <BarChart3 size={16} color={activeTab === 'timeline' ? config.color : '#94A3B8'} />
                            <Text className={`ml-2 text-xs font-bold ${activeTab === 'timeline' ? 'text-slate-800' : 'text-slate-400'}`}>推移グラフ</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setActiveTab('category')}
                            className={`flex-1 flex-row items-center justify-center py-2 rounded-lg ${activeTab === 'category' ? 'bg-white shadow-sm' : ''}`}
                        >
                            <ListFilter size={16} color={activeTab === 'category' ? config.color : '#94A3B8'} />
                            <Text className={`ml-2 text-xs font-bold ${activeTab === 'category' ? 'text-slate-800' : 'text-slate-400'}`}>カテゴリ別</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <ScrollView className="flex-1 p-5">
                    {loading ? (
                        <ActivityIndicator color={config.color} className="mt-10" />
                    ) : (
                        <>
                            {type === 'streak' ? (
                                // Streak Special View (Calendar-like list)
                                <View className="gap-2">
                                    {history.slice().reverse().map((d, i) => (
                                        <View key={i} className="flex-row items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <View className="flex-row items-center gap-3">
                                                <View className="w-10 h-10 bg-white rounded-full items-center justify-center shadow-sm">
                                                    <Calendar size={20} color={config.color} />
                                                </View>
                                                <Text className="font-bold text-slate-800">{d.date}</Text>
                                            </View>
                                            <View className="flex-row items-center bg-green-100 px-2 py-1 rounded">
                                                <CheckCircle2 size={12} color="#166534" />
                                                <Text className="text-xs font-bold text-green-700 ml-1">学習完了</Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <>
                                    {activeTab === 'timeline' ? (
                                        <>
                                            <View className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm mb-6">
                                                <Text className="text-base font-black text-slate-800 mb-4 ml-1">週間推移</Text>
                                                {renderChart()}
                                            </View>
                                            <Text className="text-base font-black text-slate-800 mb-3 ml-1">履歴ログ</Text>
                                            <View className="gap-2">
                                                {history.slice().reverse().slice(0, 20).map((d, i) => ( // limit log
                                                    <View key={i} className="flex-row items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                        <Text className="font-bold text-slate-800">{d.date}</Text>
                                                        <Text className="font-black text-slate-800">
                                                            {type === 'rate' ? `${Math.round((d.correct / d.count) * 100)}%` : `${d.count}問`}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </>
                                    ) : (
                                        <>
                                            {/* Category List */}
                                            {type === 'mastered' && masteredList.length > 0 ? (
                                                <View className="gap-3">
                                                    {masteredList.slice(0, 50).map((q, i) => (
                                                        <TouchableOpacity key={i} className="bg-white p-4 rounded-xl border border-slate-100" onPress={() => router.push(`/quiz/${q.id}`)}>
                                                            <Text className="text-[10px] text-orange-500 font-bold mb-1">{formatCategoryName(q.category)}</Text>
                                                            <Text className="font-bold text-slate-700" numberOfLines={2}>{q.text}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            ) : (
                                                renderCategoryList()
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
