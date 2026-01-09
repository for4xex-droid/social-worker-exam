import { View, Text, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    User,
    Bell,
    ShieldCheck,
    CircleHelp,
    LogOut,
    ChevronRight,
    Award,
    Type,
    Database,
    ExternalLink,
    Crown
} from 'lucide-react-native';
import { useState, useEffect } from 'react';
import clsx from 'clsx';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';

const SettingItem = ({ icon: Icon, title, subtitle, value, type = 'link', color = 'bg-slate-100', iconColor = '#64748b', onPress }: any) => {
    const [isEnabled, setIsEnabled] = useState(false);
    const toggleSwitch = () => setIsEnabled(previousState => !previousState);

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            className="flex-row items-center p-5 bg-white mb-[1px]"
            onPress={type === 'switch' ? toggleSwitch : onPress}
        >
            <View className={clsx("w-10 h-10 rounded-xl items-center justify-center mr-4", color)}>
                <Icon size={20} color={iconColor} />
            </View>
            <View className="flex-1">
                <Text className="text-slate-900 font-bold text-base">{title}</Text>
                {subtitle && <Text className="text-slate-400 text-xs mt-0.5">{subtitle}</Text>}
            </View>

            {type === 'link' && <ChevronRight size={18} color="#cbd5e1" />}
            {type === 'switch' && (
                <Switch
                    trackColor={{ false: '#e2e8f0', true: '#FF6B0033' }}
                    thumbColor={isEnabled ? '#FF6B00' : '#f4f3f4'}
                    ios_backgroundColor="#e2e8f0"
                    onValueChange={toggleSwitch}
                    value={isEnabled}
                />
            )}
            {type === 'text' && <Text className="text-slate-400 font-bold text-sm">{value}</Text>}
        </TouchableOpacity>
    );
};

const SectionHeader = ({ title }: { title: string }) => (
    <View className="px-6 pt-8 pb-3 bg-slate-50">
        <Text className="text-[10px] font-black text-slate-400 uppercase tracking-[2px]">{title}</Text>
    </View>
);

export default function SettingsScreen() {
    const brandColor = Constants.expoConfig?.extra?.brandColor || '#FF6B00';
    const [licenseLabel, setLicenseLabel] = useState('...');

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const l = await AsyncStorage.getItem('user_license');
        const label = l === 'care' ? '介護福祉士' : l === 'mental' ? '精神保健福祉士' : '社会福祉士';
        setLicenseLabel(label);
    };

    const handleReset = async () => {
        Alert.alert(
            "初期化",
            "オンボーディングを含めて初期化しますか？",
            [
                { text: "キャンセル", style: "cancel" },
                {
                    text: "初期化する",
                    style: "destructive",
                    onPress: async () => {
                        await AsyncStorage.clear();
                        await Updates.reloadAsync();
                    }
                }
            ]
        );
    };

    const handleChangeLicense = () => {
        Alert.alert(
            "資格の変更",
            "学習する資格を変更しますか？（アプリが再起動します）",
            [
                { text: '社会福祉士', onPress: () => setLicense('social') },
                { text: '精神保健福祉士', onPress: () => setLicense('mental') },
                { text: '介護福祉士', onPress: () => setLicense('care') },
                { text: 'キャンセル', style: 'cancel' }
            ]
        )
    };

    const setLicense = async (l: string) => {
        await AsyncStorage.setItem('user_license', l);
        await Updates.reloadAsync();
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-50">
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View className="px-6 py-8 bg-white">
                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-[3px] mb-1">Application</Text>
                    <Text className="text-3xl font-black text-slate-900 italic">Settings</Text>
                </View>

                {/* Premium Banner */}
                <TouchableOpacity
                    className="mx-6 mt-4 p-6 rounded-[32px] overflow-hidden flex-row items-center border border-orange-100"
                    style={{ backgroundColor: `${brandColor}08` }}
                >
                    <View className="w-12 h-12 bg-orange-500 rounded-2xl items-center justify-center mr-4 shadow-sm shadow-orange-200">
                        <Crown size={24} color="white" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-slate-900 font-black text-lg">PROパックにアップグレード</Text>
                        <Text className="text-slate-500 text-xs font-medium">すべての機能と問題をアンロック</Text>
                    </View>
                    <View className="bg-orange-500 px-4 py-2 rounded-full">
                        <Text className="text-white font-black text-[10px] uppercase">Join</Text>
                    </View>
                </TouchableOpacity>

                <SectionHeader title="Account & Profile" />
                <View className="rounded-[32px] overflow-hidden mx-6 border border-slate-100 bg-white">
                    <SettingItem
                        icon={User}
                        title="ユーザー情報"
                        subtitle="ニックネーム・合格目標日"
                        color="bg-blue-50"
                        iconColor="#3b82f6"
                    />
                    <SettingItem
                        icon={Award}
                        title="保有資格・学習コース"
                        value={licenseLabel}
                        type="text"
                        color="bg-yellow-50"
                        iconColor="#eab308"
                        onPress={handleChangeLicense}
                        subtitle="タップして変更"
                    />
                </View>

                <SectionHeader title="Study Preferences" />
                <View className="rounded-[32px] overflow-hidden mx-6 border border-slate-100 bg-white">
                    <SettingItem
                        icon={Bell}
                        title="学習リマインダー"
                        subtitle="毎日の通知設定"
                        type="switch"
                        color="bg-orange-50"
                        iconColor="#f97316"
                    />
                    <SettingItem
                        icon={Type}
                        title="文字サイズ"
                        value="標準"
                        type="text"
                        color="bg-indigo-50"
                        iconColor="#6366f1"
                    />
                </View>

                <SectionHeader title="Data & Security" />
                <View className="rounded-[32px] overflow-hidden mx-6 border border-slate-100 bg-white">
                    <SettingItem
                        icon={Database}
                        title="学習データの同期"
                        subtitle="最終同期: 今日 12:30"
                        color="bg-emerald-50"
                        iconColor="#10b981"
                    />
                    <SettingItem
                        icon={ShieldCheck}
                        title="プライバシーポリシー"
                        color="bg-slate-50"
                        iconColor="#64748b"
                    />
                </View>

                <SectionHeader title="Support" />
                <View className="rounded-[32px] overflow-hidden mx-6 border border-slate-100 bg-white">
                    <SettingItem
                        icon={CircleHelp}
                        title="ヘルプ ＆ お問い合わせ"
                        color="bg-slate-50"
                        iconColor="#64748b"
                    />
                    <SettingItem
                        icon={ExternalLink}
                        title="公式サイト"
                        color="bg-slate-50"
                        iconColor="#64748b"
                    />
                </View>

                <TouchableOpacity
                    onPress={handleReset}
                    className="mx-6 my-10 p-5 rounded-[24px] bg-rose-50 border border-rose-100 items-center flex-row justify-center"
                >
                    <LogOut size={18} color="#e11d48" className="mr-2" />
                    <Text className="text-rose-600 font-bold text-base">アプリを初期化（デバッグ用）</Text>
                </TouchableOpacity>

                <View className="items-center pb-12">
                    <Text className="text-slate-300 font-bold text-[10px] tracking-widest uppercase">Welfare Master Ver 1.0.0</Text>
                    <Text className="text-slate-300 font-bold text-[8px] mt-1">Made with Love in Japan</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
