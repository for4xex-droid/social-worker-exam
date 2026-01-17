import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Trophy, Target, BookOpen, Headphones, Brain, Flame, Layers, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function HelpScreen() {
    const router = useRouter();

    const sections = [
        {
            title: 'デイリークエスト',
            icon: Target,
            color: '#3b82f6',
            description: '1日10問の目標を達成して、学習習慣を身につけましょう。連続達成でストリークボーナスも！'
        },
        {
            title: 'ランクシステム',
            icon: Trophy,
            color: '#fbbf24',
            description: '問題を解いて経験値(XP)を獲得し、ランクアップを目指しましょう。「見習い」から「神」ランクまで用意されています。'
        },
        {
            title: '学習モード',
            icon: Layers,
            color: '#8b5cf6',
            description: '「共通科目」「専門科目」「過去問」など、目的に合わせた学習が可能です。苦手な分野は「克服モード」で集中攻略。'
        },
        {
            title: '暗記カード',
            icon: BookOpen,
            color: '#ec4899',
            description: '重要単語や頻出用語を効率よく暗記できるフラッシュカード機能です。隙間時間の学習に最適。'
        },
        {
            title: '聞き流しプレイヤー',
            icon: Headphones,
            color: '#10b981',
            description: '音声で問題を読み上げます。通勤・通学中や家事をしながらの「ながら学習」に活用してください。'
        },
        {
            title: 'プレミアムプラン',
            icon: Sparkles,
            color: '#fbbf24',
            description: '広告非表示、専門科目の解放、AI教官の利用など、合格を加速させる特典が満載。'
        }
    ];

    return (
        <View className="flex-1 bg-slate-50">
            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="px-6 py-4 flex-row items-center justify-between bg-white border-b border-slate-100">
                    <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center bg-slate-50 rounded-full">
                        <ChevronLeft size={24} color="#64748b" />
                    </TouchableOpacity>
                    <Text className="text-slate-800 font-bold text-lg">アプリの使い方</Text>
                    <View className="w-10" />
                </View>

                <ScrollView className="flex-1 p-4">
                    {/* Welcome Card */}
                    <LinearGradient
                        colors={['#1e293b', '#0f172a']}
                        className="rounded-2xl p-4 mb-4 shadow-md"
                    >
                        <Text className="text-white font-bold text-lg mb-1">Social Worker Exam Support</Text>
                        <Text className="text-slate-300 text-xs leading-5">
                            毎日の学習を効率的にサポートする機能が満載です。
                            まずは1日10問の「デイリークエスト」から！
                        </Text>
                    </LinearGradient>

                    {/* Features Grid */}
                    <View className="flex-row flex-wrap justify-between pb-8">
                        {sections.map((section, index) => {
                            const isPremiumCard = section.title === 'プレミアムプラン';

                            if (isPremiumCard) {
                                return (
                                    <LinearGradient
                                        key={index}
                                        colors={['#1a1a1a', '#000000']} // Black theme
                                        className="p-3 rounded-2xl border border-yellow-600/30 shadow-sm w-[48%] mb-3"
                                    >
                                        <View
                                            className="w-10 h-10 rounded-full items-center justify-center bg-yellow-500/20 mb-2 border border-yellow-500/30"
                                        >
                                            <section.icon size={20} color="#fbbf24" />
                                        </View>
                                        <Text className="font-bold text-yellow-500 text-sm mb-1">{section.title}</Text>
                                        <Text className="text-slate-300 text-[10px] leading-4">{section.description}</Text>
                                    </LinearGradient>
                                );
                            }

                            return (
                                <View key={index} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm w-[48%] mb-3">
                                    <View
                                        className="w-10 h-10 rounded-full items-center justify-center bg-slate-50 mb-2"
                                        style={{ backgroundColor: `${section.color}15` }}
                                    >
                                        <section.icon size={20} color={section.color} />
                                    </View>
                                    <Text className="font-bold text-slate-800 text-sm mb-1">{section.title}</Text>
                                    <Text className="text-slate-500 text-[10px] leading-4">{section.description}</Text>
                                </View>
                            );
                        })}
                    </View>

                    <View className="items-center py-4 mb-4">
                        <Text className="text-slate-400 text-xs">Version 1.0.0</Text>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
