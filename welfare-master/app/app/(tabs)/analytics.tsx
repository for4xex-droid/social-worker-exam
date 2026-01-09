import { View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrendingUp, CheckCircle2, Target, Calendar, ChevronRight, Brain } from 'lucide-react-native';
import { MotiView } from 'moti';
import clsx from 'clsx';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { db } from '../../db/client';
import { userProgress, questions } from '../../db/schema';
import { count, eq, sql } from 'drizzle-orm';

const { width } = Dimensions.get('window');

const StatCard = ({ title, value, unit, icon: Icon, color, delay = 0 }: any) => (
    <MotiView
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay, type: 'timing', duration: 400 }}
        className="bg-white p-5 rounded-[28px] shadow-sm mb-4 border border-slate-50 flex-row items-center"
        style={{ width: (width - 48) }}
    >
        <View className={clsx("w-12 h-12 rounded-2xl items-center justify-center mr-4", color)}>
            <Icon size={24} color="white" />
        </View>
        <View>
            <Text className="text-slate-400 text-xs font-bold uppercase tracking-widest">{title}</Text>
            <View className="flex-row items-baseline">
                <Text className="text-2xl font-black text-slate-800">{value}</Text>
                {unit && <Text className="text-slate-400 text-sm font-bold ml-1">{unit}</Text>}
            </View>
        </View>
    </MotiView>
);

export default function AnalyticsScreen() {
    const brandColor = Constants.expoConfig?.extra?.brandColor || '#FF6B00';

    const [stats, setStats] = useState({
        total: 0,
        correctRate: 0,
        streak: 0,
        categories: [
            { name: "社会の理解", progress: 0, color: "bg-blue-400" },
            { name: "人体の構造", progress: 0, color: "bg-purple-400" },
            { name: "生活支援", progress: 0, color: "bg-emerald-400" },
            { name: "介護の基本", progress: 0, color: "bg-rose-400" },
        ]
    });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Total solved
                const totalResult = await db.select({ val: count() }).from(userProgress);
                const total = totalResult[0]?.val || 0;

                // Correct ones
                const correctResult = await db.select({ val: count() }).from(userProgress).where(eq(userProgress.isCorrect, true));
                const correct = correctResult[0]?.val || 0;

                const rate = total > 0 ? Math.round((correct / total) * 100) : 0;

                // Simple Category Match (Mocking category names for now since we haven't filtered all yet)
                // Real implementation would group by categoryLabel
                setStats(prev => ({
                    ...prev,
                    total,
                    correctRate: rate,
                    // Streak logic would be more complex (date diffs), keeping mock for now
                    streak: 12
                }));
            } catch (err) {
                console.error("Failed to fetch analytics:", err);
            }
        };

        fetchStats();
    }, []);

    return (
        <SafeAreaView className="flex-1 bg-slate-50">
            <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View className="py-8">
                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-[3px] mb-1">Activity Tracking</Text>
                    <Text className="text-3xl font-black text-slate-900 italic">Analysis</Text>
                </View>

                {/* Main Stats */}
                <StatCard
                    title="Total Solved"
                    value={stats.total.toLocaleString()}
                    unit="questions"
                    icon={TrendingUp}
                    color="bg-blue-500"
                    delay={100}
                />
                <StatCard
                    title="Correct Rate"
                    value={stats.correctRate}
                    unit="%"
                    icon={CheckCircle2}
                    color="bg-green-500"
                    delay={200}
                />
                <StatCard
                    title="Study Streak"
                    value={stats.streak}
                    unit="days"
                    icon={Calendar}
                    color="bg-orange-500"
                    delay={300}
                />

                {/* Category Strength */}
                <View className="mt-6 mb-10">
                    <View className="flex-row items-center justify-between mb-6">
                        <View>
                            <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Knowledge Map</Text>
                            <Text className="text-xl font-black text-slate-900">カテゴリ別分析</Text>
                        </View>
                        <TouchableOpacity>
                            <Text className="text-orange-500 font-bold text-xs">詳細を見る</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Simple Bar Chart UI */}
                    {[
                        { name: "社会の理解", progress: 85, color: "bg-blue-400" },
                        { name: "人体の構造と機能", progress: 62, color: "bg-purple-400" },
                        { name: "生活支援技術", progress: 92, color: "bg-emerald-400" },
                        { name: "介護の基本", progress: 45, color: "bg-rose-400" },
                    ].map((item, index) => (
                        <View key={index} className="bg-white p-5 rounded-[24px] mb-3 border border-slate-50">
                            <View className="flex-row justify-between items-center mb-3">
                                <Text className="font-bold text-slate-700">{item.name}</Text>
                                <Text className="font-black text-slate-900">{item.progress}%</Text>
                            </View>
                            <View className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <MotiView
                                    from={{ width: '0%' }}
                                    animate={{ width: `${item.progress}%` }}
                                    transition={{ delay: 500 + (index * 100), type: 'timing', duration: 1000 }}
                                    className={clsx("h-full rounded-full", item.color)}
                                />
                            </View>
                        </View>
                    ))}
                </View>

                {/* AI Advice Card */}
                <MotiView
                    from={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1000 }}
                    className="bg-slate-900 p-6 rounded-[32px] mb-12"
                >
                    <View className="flex-row items-center mb-4">
                        <View className="w-8 h-8 bg-orange-500 rounded-full items-center justify-center mr-3">
                            <Brain size={16} color="white" />
                        </View>
                        <Text className="text-white font-black text-lg">AIからのアドバイス</Text>
                    </View>
                    <Text className="text-slate-400 leading-6 font-medium">
                        「介護の基本」の正解率が少し低下しています。ここを30分重点的に復習することで、合格可能性が【12%】向上します。
                    </Text>
                    <TouchableOpacity
                        className="mt-6 bg-white/10 py-4 rounded-2xl items-center border border-white/5"
                    >
                        <Text className="text-white font-bold">弱点克服クエストを開始</Text>
                    </TouchableOpacity>
                </MotiView>
            </ScrollView>
        </SafeAreaView>
    );
}
