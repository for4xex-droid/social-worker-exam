import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Zap, Target, Brain, Award, Crown, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function AnalyticsIntroductionScreen() {
    const router = useRouter();

    const sections = [
        {
            title: '苦手・得意分析',
            icon: Target,
            color: '#3b82f6',
            description: '科目ごとの正解率を可視化。自分の弱点を瞬時に把握し、効率的な学習を可能にします。',
            isPremium: true
        },
        {
            title: 'AI指導教官',
            icon: Brain,
            color: '#fbbf24',
            description: 'あなたの学習傾向をAIが分析。次に解くべき問題や、注力すべき分野を的確にアドバイスします。',
            isPremium: true
        },
        {
            title: '詳細レポート',
            icon: Zap,
            color: '#10b981',
            description: '過去の全解答データを詳細にレポート。成長の軌跡を実感し、モチベーションを高めます。',
            isPremium: false
        },
        {
            title: 'プレミアムプラン',
            icon: Sparkles,
            color: '#fbbf24',
            description: '「苦手・得意分析」と「AI指導教官」を含む全ての機能をアンロック。あなたの本気に応える最強の学習ツール。',
            isPremium: true,
            isPromo: true
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
                    <Text className="text-slate-800 font-bold text-lg">学習記録の機能紹介</Text>
                    <View className="w-10" />
                </View>

                <ScrollView className="flex-1 p-4">
                    {/* Welcome Card */}
                    <LinearGradient
                        colors={['#1e293b', '#0f172a']}
                        className="rounded-2xl p-4 mb-4 shadow-md items-center"
                    >
                        <Award size={32} color="#fbbf24" className="mb-2" />
                        <Text className="text-white font-bold text-lg mb-1 text-center">Data Analytics</Text>
                        <Text className="text-slate-300 text-xs leading-5 text-center">
                            膨大な学習データをAIが解析し、{"\n"}最短距離での合格をサポートします。
                        </Text>
                    </LinearGradient>

                    {/* Features Grid */}
                    <View className="flex-row flex-wrap justify-between pb-8">
                        {sections.map((section, index) => {
                            if (section.isPromo) {
                                return (
                                    <TouchableOpacity
                                        key={index}
                                        activeOpacity={0.9}
                                        onPress={() => router.push('/purchase')}
                                        className="w-full mb-3"
                                    >
                                        <LinearGradient
                                            colors={['#1a1a1a', '#000000']} // Black theme
                                            className="p-4 rounded-2xl border border-yellow-600/30 shadow-sm flex-row items-center"
                                        >
                                            <View className="flex-1 pr-2">
                                                <View className="flex-row items-center mb-2">
                                                    <View className="w-8 h-8 rounded-full items-center justify-center bg-yellow-500/20 border border-yellow-500/30 mr-2">
                                                        <Crown size={16} color="#fbbf24" />
                                                    </View>
                                                    <Text className="font-bold text-yellow-500 text-sm">{section.title}</Text>
                                                </View>
                                                <Text className="text-slate-300 text-[11px] leading-4">{section.description}</Text>
                                            </View>
                                            <View className="bg-yellow-500 px-3 py-1.5 rounded-full">
                                                <Text className="text-slate-900 font-black text-[10px]">詳細を見る</Text>
                                            </View>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                );
                            }

                            return (
                                <View key={index} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm w-[48%] mb-3">
                                    <View className="flex-row justify-between items-start mb-2">
                                        <View
                                            className="w-10 h-10 rounded-full items-center justify-center bg-slate-50"
                                            style={{ backgroundColor: `${section.color}15` }}
                                        >
                                            <section.icon size={20} color={section.color} />
                                        </View>
                                        {section.isPremium && (
                                            <View className="bg-orange-100 px-1.5 py-0.5 rounded-full flex-row items-center">
                                                <Crown size={8} color="#FF6B00" />
                                                <Text className="text-[8px] font-black text-orange-600 ml-0.5">PRO</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text className="font-bold text-slate-800 text-sm mb-1">{section.title}</Text>
                                    <Text className="text-slate-400 text-[10px] leading-4">{section.description}</Text>
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
