import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { CheckCircle2, ChevronLeft, CreditCard, ShieldCheck, Zap } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export default function Purchase() {
    const router = useRouter();

    const plans = [
        {
            id: 'monthly',
            title: '月間プラン',
            price: '¥980',
            period: '/ 月',
            description: 'まずは1ヶ月、集中的に。',
            isPopular: false,
        },
        {
            id: 'yearly',
            title: '年間プラン',
            price: '¥5,800',
            period: '/ 年',
            description: '合格までじっくり。約50%OFF',
            isPopular: true,
        }
    ];

    const benefits = [
        "すべての予想問題（900問以上）が解放",
        "AIによる詳細なパーソナル解説",
        "弱点分析ダッシュボードの利用",
        "広告非表示 & オフライン対応",
        "最新の法改正対応データを即時反映"
    ];

    return (
        <SafeAreaView className="flex-1 bg-white">
            <StatusBar style="dark" />

            {/* Header */}
            <View className="px-4 py-4 flex-row items-center border-b border-slate-50">
                <TouchableOpacity onPress={() => router.back()} className="p-2">
                    <ChevronLeft size={24} color="#1e293b" />
                </TouchableOpacity>
                <Text className="text-lg font-black text-slate-800 ml-2">プレミアムプラン</Text>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Hero Section: Compacted */}
                <View className="px-6 py-8 items-center">
                    <View className="w-16 h-16 bg-orange-100 rounded-2xl items-center justify-center mb-5 shadow-sm shadow-orange-200">
                        <Zap size={32} color="#FF6B00" fill="#FF6B00" />
                    </View>
                    <Text className="text-2xl font-black text-slate-900 text-center leading-tight">
                        最短ルートで{"\n"}合格を掴み取ろう
                    </Text>
                    <Text className="text-slate-400 text-center mt-3 leading-5 text-sm">
                        合格者が絶賛する「AI予想問題」と{"\n"}詳細な分析機能がすべて利用可能に。
                    </Text>
                </View>

                <View className="px-6 gap-3">
                    {plans.map((plan) => (
                        <TouchableOpacity
                            key={plan.id}
                            activeOpacity={0.9}
                            className={`p-5 rounded-2xl border-2 ${plan.isPopular ? 'border-orange-500 bg-orange-50/30' : 'border-slate-100 bg-white'}`}
                        >
                            {plan.isPopular && (
                                <View className="absolute -top-2.5 right-6 bg-orange-500 px-2.5 py-0.5 rounded-full">
                                    <Text className="text-white text-[9px] font-black uppercase tracking-wider">Popular Choice</Text>
                                </View>
                            )}
                            <View className="flex-row justify-between items-start">
                                <View>
                                    <Text className="text-slate-900 font-black text-lg">{plan.title}</Text>
                                    <Text className="text-slate-400 text-[11px] mt-0.5">{plan.description}</Text>
                                </View>
                                <View className="items-end">
                                    <Text className="text-slate-900 font-black text-xl">{plan.price}</Text>
                                    <Text className="text-slate-400 text-[9px] uppercase font-bold">{plan.period}</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Benefits List: More compact */}
                <View className="mx-6 mt-10 p-6 bg-slate-900 rounded-[32px] relative overflow-hidden">
                    <View className="absolute -top-16 -right-16 w-32 h-32 bg-white/5 rounded-full" />

                    <Text className="text-white font-black text-lg mb-5">Premium Benefits</Text>
                    <View className="gap-4">
                        {benefits.map((benefit, i) => (
                            <View key={i} className="flex-row items-center gap-3">
                                <View className="w-5 h-5 bg-orange-500 rounded-full items-center justify-center">
                                    <CheckCircle2 size={12} color="white" />
                                </View>
                                <Text className="text-slate-300 text-xs font-medium">{benefit}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Security Proof */}
                <View className="px-6 py-10 flex-row items-center justify-center gap-2">
                    <ShieldCheck size={16} color="#64748b" />
                    <Text className="text-slate-400 text-xs font-medium">セキュアな決済システムを利用しています</Text>
                </View>
            </ScrollView>

            {/* Bottom Button */}
            <View className="p-6 border-t border-slate-50">
                <TouchableOpacity activeOpacity={0.8}>
                    <LinearGradient
                        colors={['#FF8C37', '#FF6B00']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
                        className="items-center justify-center flex-row"
                    >
                        <CreditCard size={20} color="white" />
                        <View style={{ width: 10 }} />
                        <Text className="text-white font-black text-lg">今すぐアップグレード</Text>
                    </LinearGradient>
                </TouchableOpacity>
                <Text className="text-slate-400 text-[10px] text-center mt-4">
                    いつでもキャンセル可能です。利用規約とプライバシーポリシーに同意の上、購入してください。
                </Text>
            </View>
        </SafeAreaView>
    );
}
