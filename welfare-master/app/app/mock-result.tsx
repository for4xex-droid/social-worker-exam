import { View, Text, TouchableOpacity, ScrollView, Alert, Dimensions, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Home, Share2, Download, Award, XCircle, CheckCircle2, RefreshCcw } from 'lucide-react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import Constants from 'expo-constants';

export default function MockResult() {
    const router = useRouter();
    const viewShotRef = useRef<any>(null);
    const [loading, setLoading] = useState(true);
    const [score, setScore] = useState(0);
    const [isPass, setIsPass] = useState(false);

    // Results analysis
    const [results, setResults] = useState<boolean[]>([]);

    useEffect(() => {
        loadResult();
    }, []);

    const loadResult = async () => {
        try {
            const sessionStr = await AsyncStorage.getItem('mock_exam_session');
            if (sessionStr) {
                const session = JSON.parse(sessionStr);
                const res = session.results;
                const correctCount = res.filter((r: any) => r === true).length;
                setScore(correctCount);
                setResults(res);
                setIsPass(correctCount >= 90);
                setLoading(false);
            } else {
                Alert.alert("エラー", "試験結果が見つかりませんでした。");
                router.replace('/');
            }
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    };

    const handleShare = async () => {
        try {
            if (viewShotRef.current && viewShotRef.current.capture) {
                const uri = await viewShotRef.current.capture();
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri);
                } else {
                    Alert.alert("エラー", "共有機能が利用できません。");
                }
            }
        } catch (e) {
            console.error("Share failed", e);
            Alert.alert("エラー", "共有に失敗しました。");
        }
    };

    const handleSave = async () => {
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("権限エラー", "画像を保存するにはカメラロールへのアクセス権限が必要です。");
                return;
            }

            if (viewShotRef.current && viewShotRef.current.capture) {
                const uri = await viewShotRef.current.capture();
                await MediaLibrary.saveToLibraryAsync(uri);
                Alert.alert("完了", "画像を保存しました！");
            }
        } catch (e) {
            console.error("Save failed", e);
            Alert.alert("エラー", "保存に失敗しました。");
        }
    };

    const handleRetry = () => {
        Alert.alert(
            "再挑戦",
            "ホームに戻って新しい模擬試験を開始しますか？",
            [
                { text: "キャンセル", style: "cancel" },
                { text: "はい", onPress: () => router.push('/') }
            ]
        );
    };

    const fullHeight = Dimensions.get('window').height;

    if (loading) {
        return (
            <View className="flex-1 bg-slate-900 justify-center items-center">
                <ActivityIndicator size="large" color="#10B981" />
                <Text className="text-white mt-4 font-bold">結果を集計中...</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-slate-900">
            {/* ViewShot captures this area */}
            <ViewShot ref={viewShotRef} options={{ format: "png", quality: 0.9 }}>
                <LinearGradient
                    colors={isPass ? ['#065f46', '#042f2e'] : ['#450a0a', '#1a0505']}
                    className="h-full w-full absolute"
                />

                <SafeAreaView className="flex-1 items-center justify-center p-6">
                    {/* Header */}
                    <Text className="text-white/70 font-bold uppercase tracking-[4px] mb-8">
                        全国統一模擬試験 結果
                    </Text>

                    {/* Result Card */}
                    <View className="bg-white/10 backdrop-blur-md p-8 rounded-3xl w-full max-w-sm items-center border border-white/20 shadow-xl mb-8">

                        {/* Status Icon */}
                        <View className="mb-6">
                            {isPass ? (
                                <View className="w-24 h-24 bg-emerald-500 rounded-full items-center justify-center shadow-lg shadow-emerald-500/50">
                                    <Award size={48} color="white" />
                                </View>
                            ) : (
                                <View className="w-24 h-24 bg-red-500 rounded-full items-center justify-center shadow-lg shadow-red-500/50">
                                    <XCircle size={48} color="white" />
                                </View>
                            )}
                        </View>

                        {/* Pass/Fail Text */}
                        <Text className="text-4xl font-black text-white mb-2 shadow-sm">
                            {isPass ? "合格！" : "不合格..."}
                        </Text>
                        <Text className="text-white/80 font-bold text-sm mb-6">
                            {isPass ? "素晴らしい！合格ライン突破です！" : "あと少し！次回は合格を目指しましょう！"}
                        </Text>

                        {/* Score Display */}
                        <View className="flex-row items-end gap-2 mb-2">
                            <Text className="text-6xl font-black text-white leading-none">
                                {score}
                            </Text>
                            <Text className="text-xl font-bold text-white/60 mb-2">
                                / 150
                            </Text>
                        </View>

                        <View className="w-full bg-black/20 h-2 rounded-full overflow-hidden mb-4">
                            <View
                                style={{ width: `${(score / 150) * 100}%` }}
                                className={`h-full ${isPass ? 'bg-emerald-400' : 'bg-red-400'}`}
                            />
                        </View>

                        <Text className="text-white/50 font-bold text-xs">
                            正答率: {Math.round((score / 150) * 100)}% (合格基準: 60% / 90問)
                        </Text>
                    </View>

                    {/* Footer Info (Only visible in screenshot mostly) */}
                    <Text className="text-white/30 text-[10px] font-bold mt-auto mb-4">
                        Powered by 介護福祉・社会福祉士国家試験対策マスター
                    </Text>
                </SafeAreaView>
            </ViewShot>

            {/* Action Buttons (Overlay) */}
            <SafeAreaView className="absolute bottom-0 left-0 right-0 p-6 flex-row justify-center gap-4">
                <TouchableOpacity
                    onPress={() => router.push('/')}
                    className="w-14 h-14 bg-white/10 rounded-full items-center justify-center border border-white/20 backdrop-blur-md"
                >
                    <Home size={24} color="white" />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleShare}
                    className="flex-1 bg-emerald-500 h-14 rounded-full flex-row items-center justify-center shadow-lg shadow-emerald-500/30"
                >
                    <Share2 size={24} color="white" className="mr-2" />
                    <Text className="text-white font-bold text-lg">結果をシェア</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleSave}
                    className="w-14 h-14 bg-white/10 rounded-full items-center justify-center border border-white/20 backdrop-blur-md"
                >
                    <Download size={24} color="white" />
                </TouchableOpacity>
            </SafeAreaView>
        </View>
    );
}
