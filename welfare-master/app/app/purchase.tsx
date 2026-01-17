import { View, Text, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { CheckCircle2, ChevronLeft, CreditCard, ShieldCheck, Zap, RotateCcw } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

// ========================================
// プレミアム状態管理モジュール
// 課金システム実装時はこのモジュールを更新してください
// ========================================
import {
    unlockPremium,
    restorePurchases,
    PREMIUM_PRICE,
    PRODUCT_ID
} from '../constants/premium';

export default function Purchase() {
    const router = useRouter();

    const plans = [
        {
            id: 'lifetime',
            title: '買い切りプラン',
            price: PREMIUM_PRICE.display,
            period: '/ 一回限り',
            description: '追加課金なしで永久に利用可能',
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

    /**
     * 購入処理
     * 
     * ========================================
     * 【課金システム統合ポイント】
     * ========================================
     * 
     * 現在の実装: AsyncStorage に直接保存（開発用）
     * 
     * 本番実装時のフロー:
     * 1. 課金プロバイダーの購入処理を呼び出す
     *    例 (RevenueCat): await Purchases.purchaseProduct(PRODUCT_ID.ONE_TIME_PURCHASE)
     *    例 (Expo IAP): await InAppPurchases.purchaseItemAsync(PRODUCT_ID.ONE_TIME_PURCHASE)
     * 
     * 2. 購入成功を確認後、unlockPremium() を呼び出してローカル状態を更新
     * 
     * 3. エラーハンドリング（キャンセル、支払い失敗など）
     */
    const handlePurchase = async () => {
        try {
            // ================================================
            // TODO: ここに課金プロバイダーの購入処理を追加
            // ================================================
            // 例 (RevenueCat):
            // const { customerInfo } = await Purchases.purchaseProduct(PRODUCT_ID.ONE_TIME_PURCHASE);
            // if (customerInfo.entitlements.active['premium']) {
            //     await unlockPremium();
            // }
            // ================================================

            // 現在は直接アンロック（開発用）
            const success = await unlockPremium();

            if (success) {
                Alert.alert(
                    "購入完了",
                    "プレミアム機能が解放されました！応援ありがとうございます！",
                    [{
                        text: "さあ、始めよう",
                        onPress: () => router.back()
                    }]
                );
            }
        } catch (e) {
            console.error('[Purchase] Failed:', e);
            Alert.alert("エラー", "購入処理に失敗しました。もう一度お試しください。");
        }
    };

    /**
     * 購入履歴の復元
     */
    const handleRestore = async () => {
        try {
            // ================================================
            // TODO: ここに課金プロバイダーの復元処理を追加
            // ================================================

            const restored = await restorePurchases();

            if (restored) {
                Alert.alert(
                    "復元完了",
                    "プレミアム機能が復元されました！",
                    [{ text: "OK", onPress: () => router.back() }]
                );
            } else {
                Alert.alert(
                    "購入履歴なし",
                    "復元可能な購入履歴が見つかりませんでした。"
                );
            }
        } catch (e) {
            console.error('[Restore] Failed:', e);
            Alert.alert("エラー", "復元処理に失敗しました。");
        }
    };

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

                {/* Single Plan Card */}
                <View className="px-6">
                    <TouchableOpacity
                        activeOpacity={1}
                        className="p-6 rounded-3xl border-2 border-orange-500 bg-orange-50/30 relative overflow-hidden"
                    >
                        <View className="absolute -top-3 -right-3 bg-orange-500 w-24 h-24 rounded-full opacity-20" />

                        <View className="absolute top-0 right-0 bg-orange-500 px-4 py-1 rounded-bl-xl">
                            <Text className="text-white text-[10px] font-black uppercase tracking-wider">Early Bird</Text>
                        </View>

                        <View className="mb-4">
                            <Text className="text-slate-900 font-black text-xl">買い切りプラン</Text>
                            <Text className="text-slate-500 text-xs mt-1">追加料金なしで、ずっと使えます。</Text>
                        </View>

                        <View className="flex-row items-baseline mt-2">
                            <Text className="text-slate-900 font-black text-4xl mr-1">¥500</Text>
                            <Text className="text-slate-400 font-bold text-sm">税込</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Benefits List: More compact */}
                <View className="mx-6 mt-8 p-6 bg-slate-900 rounded-[32px] relative overflow-hidden mb-10">
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
                <View className="px-6 pb-10 flex-row items-center justify-center gap-2">
                    <ShieldCheck size={16} color="#64748b" />
                    <Text className="text-slate-400 text-xs font-medium">セキュアな決済システムを利用しています</Text>
                </View>
            </ScrollView>

            {/* Bottom Button */}
            <View className="p-6 border-t border-slate-50 bg-white">
                <TouchableOpacity activeOpacity={0.8} onPress={handlePurchase}>
                    <LinearGradient
                        colors={['#FF8C37', '#FF6B00']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
                        className="items-center justify-center flex-row shadow-lg shadow-orange-200"
                    >
                        <CreditCard size={20} color="white" />
                        <View style={{ width: 10 }} />
                        <Text className="text-white font-black text-lg">{PREMIUM_PRICE.display} で購入する</Text>
                    </LinearGradient>
                </TouchableOpacity>

                {/* Restore Button */}
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleRestore}
                    className="mt-3 py-3 flex-row items-center justify-center"
                >
                    <RotateCcw size={14} color="#64748B" />
                    <Text className="text-slate-500 text-xs font-bold ml-2">購入履歴を復元</Text>
                </TouchableOpacity>

                <Text className="text-slate-400 text-[10px] text-center mt-2">
                    利用規約とプライバシーポリシーをご確認ください。
                </Text>
            </View>
        </SafeAreaView>
    );
}
