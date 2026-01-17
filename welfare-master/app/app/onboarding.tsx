import { View, Text, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ChevronRight, CheckCircle2, Trophy, Clock, Train, Heart, Users, Brain, Sparkles } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

type Step = 'welcome' | 'license' | 'style' | 'finish';

export default function Onboarding() {
    const router = useRouter();
    const [step, setStep] = useState<Step>('welcome');
    const [selectedLicense, setSelectedLicense] = useState<string | null>(null);
    const [selectedStyle, setSelectedStyle] = useState<string | null>(null);

    const licenses = [
        { id: 'care', label: '介護福祉士', icon: Heart, color: '#10B981' },
        { id: 'social', label: '社会福祉士', icon: Users, color: '#F97316' },
        { id: 'mental', label: '精神保健福祉士', icon: Brain, color: '#EC4899' },
        { id: 'none', label: '取得予定 / なし', icon: Sparkles, color: '#64748B' },
    ];

    const styles = [
        { id: 'commute', label: 'スキマ時間派', desc: '通勤中や休憩時に集中', icon: Train },
        { id: 'home', label: 'じっくり派', desc: '自宅で腰を据えて学習', icon: Clock },
    ];

    const handleFinish = async () => {
        try {
            await AsyncStorage.setItem('onboarding_completed_v2', 'true');
            if (selectedLicense) {
                await AsyncStorage.setItem('user_license', selectedLicense);
            }
            router.replace('/');
        } catch (e) {
            console.error(e);
        }
    };

    const renderStep = () => {
        switch (step) {
            case 'welcome':
                return (
                    <View
                        className="flex-1 items-center justify-center px-8"
                    >
                        <View className="w-24 h-24 bg-orange-500 rounded-[32px] items-center justify-center mb-8 shadow-xl shadow-orange-200">
                            <Text className="text-4xl">🎓</Text>
                        </View>
                        <Text className="text-3xl font-black text-slate-900 text-center leading-tight">
                            Welfare Masterへ{"\n"}ようこそ
                        </Text>
                        <Text className="text-slate-400 text-center mt-4 leading-6 text-sm">
                            あなたの国家試験合格を{"\n"}最短ルートでサポートします。
                        </Text>
                        <TouchableOpacity
                            onPress={() => setStep('license')}
                            className="mt-12 w-full bg-slate-900 h-16 rounded-2xl items-center justify-center flex-row"
                        >
                            <Text className="text-white font-bold text-lg mr-2">はじめる</Text>
                            <ChevronRight size={20} color="white" />
                        </TouchableOpacity>
                    </View>
                );

            case 'license':
                return (
                    <View
                        className="flex-1 px-8 pt-12"
                    >
                        <Text className="text-2xl font-black text-slate-900 mb-2">保有資格を教えてください</Text>
                        <Text className="text-slate-400 text-sm mb-8">選択した資格はゴールドバッジとして{"\n"}プロフィールに表示されます。</Text>

                        <View className="gap-2.5">
                            {licenses.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        onPress={() => setSelectedLicense(item.id)}
                                        className={`p-4 rounded-xl border-2 flex-row items-center justify-between ${selectedLicense === item.id ? 'border-orange-500 bg-orange-50' : 'border-slate-100 bg-white'}`}
                                    >
                                        <View className="flex-row items-center gap-3.5">
                                            <View className={`w-10 h-10 rounded-lg items-center justify-center ${selectedLicense === item.id ? 'bg-orange-500/10' : 'bg-slate-50'}`}>
                                                <Icon size={20} color={selectedLicense === item.id ? '#f97316' : '#64748b'} />
                                            </View>
                                            <Text className="text-slate-800 font-bold text-base">{item.label}</Text>
                                        </View>
                                        {selectedLicense === item.id && <CheckCircle2 size={20} color="#f97316" />}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <TouchableOpacity
                            disabled={!selectedLicense}
                            onPress={() => setStep('style')}
                            className={`mt-10 h-16 rounded-2xl items-center justify-center ${selectedLicense ? 'bg-slate-900' : 'bg-slate-200'}`}
                        >
                            <Text className="text-white font-bold text-lg">次へ</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 'style':
                return (
                    <View
                        className="flex-1 px-8 pt-12"
                    >
                        <Text className="text-2xl font-black text-slate-900 mb-2">学習スタイルは？</Text>
                        <Text className="text-slate-400 text-sm mb-8">ライフスタイルに合わせて、{"\n"}最適な通知タイミングを提案します。</Text>

                        <View className="gap-3.5">
                            {styles.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        onPress={() => setSelectedStyle(item.id)}
                                        className={`p-5 rounded-2xl border-2 ${selectedStyle === item.id ? 'border-orange-500 bg-orange-50' : 'border-slate-100 bg-white'}`}
                                    >
                                        <View className="flex-row items-center gap-4">
                                            <View className={`p-2.5 rounded-xl ${selectedStyle === item.id ? 'bg-orange-500' : 'bg-slate-100'}`}>
                                                <Icon size={20} color={selectedStyle === item.id ? 'white' : '#64748b'} />
                                            </View>
                                            <View>
                                                <Text className="text-slate-800 font-black text-base">{item.label}</Text>
                                                <Text className="text-slate-400 text-[11px]">{item.desc}</Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <TouchableOpacity
                            disabled={!selectedStyle}
                            onPress={() => setStep('finish')}
                            className={`mt-10 h-16 rounded-2xl items-center justify-center ${selectedStyle ? 'bg-slate-900' : 'bg-slate-200'}`}
                        >
                            <Text className="text-white font-bold text-lg">診断を完了する</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 'finish':
                return (
                    <View
                        className="flex-1 items-center justify-center px-8"
                    >
                        <View className="w-24 h-24 bg-orange-500 rounded-[32px] items-center justify-center mb-10 shadow-lg shadow-orange-300">
                            <Trophy size={48} color="white" />
                        </View>

                        <Text className="text-3xl font-black text-slate-900 text-center mb-4">準備完了です！</Text>

                        <View className="bg-orange-50 px-6 py-4 rounded-2xl border border-orange-100 mb-8">
                            <Text className="text-orange-600 font-bold text-center">
                                ゴールドバッジ「{licenses.find(l => l.id === selectedLicense)?.label}」を獲得しました。
                            </Text>
                        </View>

                        <Text className="text-slate-400 text-center mb-12 leading-6">
                            ホーム画面にあなたの本棚を用意しました。{"\n"}今日から合格への一歩を踏み出しましょう。
                        </Text>

                        <TouchableOpacity
                            onPress={handleFinish}
                            className="w-full bg-slate-900 h-16 rounded-2xl items-center justify-center shadow-lg shadow-slate-300"
                        >
                            <Text className="text-white font-bold text-lg">学習をはじめる</Text>
                        </TouchableOpacity>
                    </View>
                );
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white" style={Platform.OS === 'web' ? { height: '100vh', overflow: 'hidden' } as any : {}}>
            {Platform.OS !== 'web' && <StatusBar style="dark" />}
            <View className="flex-1">
                {renderStep()}
            </View>

            {/* Progress indicators (dots) */}
            {step !== 'welcome' && step !== 'finish' && (
                <View className="flex-row justify-center gap-2 mb-10">
                    <View className={`h-1.5 rounded-full ${step === 'license' ? 'w-8 bg-orange-500' : 'w-2 bg-slate-200'}`} />
                    <View className={`h-1.5 rounded-full ${step === 'style' ? 'w-8 bg-orange-500' : 'w-2 bg-slate-200'}`} />
                </View>
            )}
        </SafeAreaView>
    );
}
