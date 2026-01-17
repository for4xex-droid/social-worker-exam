import { View, Text, ScrollView, TouchableOpacity, Switch, Alert, Modal, TextInput, Linking } from 'react-native';
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
    Crown,
    X,
    Save
} from 'lucide-react-native';
import { useState, useEffect } from 'react';
import clsx from 'clsx';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { useRouter } from 'expo-router';

interface SettingItemProps {
    icon: any;
    title: string;
    subtitle?: string;
    value?: string;
    type?: 'link' | 'switch' | 'text';
    color?: string;
    iconColor?: string;
    onPress?: () => void;
    isSwitchOn?: boolean;
    onToggle?: (val: boolean) => void;
}

const SettingItem = ({ icon: Icon, title, subtitle, value, type = 'link', color = 'bg-slate-100', iconColor = '#64748b', onPress, isSwitchOn, onToggle }: SettingItemProps) => {
    return (
        <TouchableOpacity
            activeOpacity={0.7}
            className="flex-row items-center p-5 bg-white mb-[1px]"
            onPress={type === 'switch' ? () => onToggle && onToggle(!isSwitchOn) : onPress}
            disabled={type === 'switch'} // Switch handles its own touch, but we wrap it for consistency
        >
            <View className={clsx("w-10 h-10 rounded-xl items-center justify-center mr-4", color)}>
                <Icon size={20} color={iconColor} />
            </View>
            <View className="flex-1">
                <Text className="text-slate-900 font-bold text-base">{title}</Text>
                {subtitle && <Text className="text-slate-400 text-xs mt-0.5">{subtitle}</Text>}
            </View>

            {type === 'link' && <ChevronRight size={18} color="#cbd5e1" />}
            {type === 'switch' && onToggle && (
                <Switch
                    trackColor={{ false: '#e2e8f0', true: '#FF6B0033' }}
                    thumbColor={isSwitchOn ? '#FF6B00' : '#f4f3f4'}
                    ios_backgroundColor="#e2e8f0"
                    onValueChange={onToggle}
                    value={isSwitchOn}
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
    const router = useRouter();
    const brandColor = Constants.expoConfig?.extra?.brandColor || '#FF6B00';
    const [licenseLabel, setLicenseLabel] = useState('...');

    // Settings State
    const [reminderEnabled, setReminderEnabled] = useState(false);
    const [fontSize, setFontSize] = useState('標準');
    const [nickname, setNickname] = useState('ゲスト');
    const [targetDate, setTargetDate] = useState('2025-02-01');

    // Modal State
    const [isProfileModalVisible, setProfileModalVisible] = useState(false);
    const [editNickname, setEditNickname] = useState('');
    const [editTargetDate, setEditTargetDate] = useState('');

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            // Load License
            const l = await AsyncStorage.getItem('user_license');
            const label = l === 'care' ? '介護福祉士' : l === 'mental' ? '精神保健福祉士' : '社会福祉士';
            setLicenseLabel(label);

            // Load Other Settings
            const reminder = await AsyncStorage.getItem('setting_reminder');
            setReminderEnabled(reminder === 'true');

            const fs = await AsyncStorage.getItem('setting_font_size');
            if (fs) setFontSize(fs);

            const userProfile = await AsyncStorage.getItem('user_profile');
            if (userProfile) {
                const profile = JSON.parse(userProfile);
                setNickname(profile.nickname || 'ゲスト');
                setTargetDate(profile.targetDate || '2025-02-01');
            }
        } catch (e) {
            console.error(e);
        }
    };

    const toggleReminder = async (val: boolean) => {
        setReminderEnabled(val);
        await AsyncStorage.setItem('setting_reminder', val.toString());
        // Here you would integrate with notification permissions/scheduling logic
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

    const openProfileModal = () => {
        setEditNickname(nickname);
        setEditTargetDate(targetDate);
        setProfileModalVisible(true);
    };

    const saveProfile = async () => {
        const newProfile = { nickname: editNickname, targetDate: editTargetDate };
        await AsyncStorage.setItem('user_profile', JSON.stringify(newProfile));
        setNickname(editNickname);
        setTargetDate(editTargetDate);
        setProfileModalVisible(false);
    };

    const handleChangeFontSize = () => {
        Alert.alert(
            "文字サイズ",
            "アプリ全体の文字サイズ設定（現在は設定のみ保存されます）",
            [
                { text: '小', onPress: () => saveFontSize('小') },
                { text: '標準', onPress: () => saveFontSize('標準') },
                { text: '大', onPress: () => saveFontSize('大') },
                { text: 'キャンセル', style: 'cancel' }
            ]
        );
    };

    const saveFontSize = async (size: string) => {
        setFontSize(size);
        await AsyncStorage.setItem('setting_font_size', size);
    };

    const openLink = (url: string) => {
        Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
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
                        <Text className="text-slate-500 text-xs font-medium">¥500 (買い切り) で完全版をアンロック</Text>
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
                        subtitle={`${nickname} / 目標: ${targetDate}`}
                        color="bg-blue-50"
                        iconColor="#3b82f6"
                        onPress={openProfileModal}
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
                        subtitle={reminderEnabled ? "毎日通知します" : "通知はオフです"}
                        type="switch"
                        color="bg-orange-50"
                        iconColor="#f97316"
                        isSwitchOn={reminderEnabled}
                        onToggle={toggleReminder}
                    />
                    <SettingItem
                        icon={Type}
                        title="文字サイズ"
                        value={fontSize}
                        type="text"
                        color="bg-indigo-50"
                        iconColor="#6366f1"
                        onPress={handleChangeFontSize}
                        subtitle="タップして変更"
                    />
                </View>

                <SectionHeader title="Data & Security" />
                <View className="rounded-[32px] overflow-hidden mx-6 border border-slate-100 bg-white">
                    <SettingItem
                        icon={Database}
                        title="学習データの同期"
                        subtitle="最終同期: 未同期"
                        color="bg-emerald-50"
                        iconColor="#10b981"
                        onPress={() => Alert.alert("データ同期", "サーバーとの同期機能は現在開発中です。")}
                    />
                    <SettingItem
                        icon={ShieldCheck}
                        title="プライバシーポリシー"
                        color="bg-slate-50"
                        iconColor="#64748b"
                        onPress={() => router.push('/privacy')}
                    />
                </View>

                <SectionHeader title="Support" />
                <View className="rounded-[32px] overflow-hidden mx-6 border border-slate-100 bg-white">
                    <SettingItem
                        icon={CircleHelp}
                        title="ヘルプ ＆ お問い合わせ"
                        color="bg-slate-50"
                        iconColor="#64748b"
                        onPress={() => router.push('/help')}
                    />
                    <SettingItem
                        icon={ExternalLink}
                        title="公式サイト"
                        color="bg-slate-50"
                        iconColor="#64748b"
                        onPress={() => openLink('https://www.sssc.or.jp/')}
                    />
                </View>

                <TouchableOpacity
                    onPress={handleReset}
                    className="mx-6 my-10 p-5 rounded-[24px] bg-rose-50 border border-rose-100 items-center flex-row justify-center"
                    activeOpacity={0.8}
                >
                    <LogOut size={18} color="#e11d48" className="mr-2" />
                    <Text className="text-rose-600 font-bold text-base">アプリを初期化（デバッグ用）</Text>
                </TouchableOpacity>

                <View className="items-center pb-12">
                    <Text className="text-slate-300 font-bold text-[10px] tracking-widest uppercase">Welfare Master Ver 1.0.0</Text>
                    <Text className="text-slate-300 font-bold text-[8px] mt-1">Made with Love in Japan</Text>
                </View>
            </ScrollView>

            {/* Profile Edit Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={isProfileModalVisible}
                onRequestClose={() => setProfileModalVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-[32px] p-8 h-2/3">
                        <View className="flex-row items-center justify-between mb-8">
                            <Text className="text-2xl font-black text-slate-900">プロフィール編集</Text>
                            <TouchableOpacity onPress={() => setProfileModalVisible(false)} className="p-2 bg-slate-100 rounded-full">
                                <X size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <Text className="text-sm font-bold text-slate-400 mb-2 ml-1">ニックネーム</Text>
                        <TextInput
                            value={editNickname}
                            onChangeText={setEditNickname}
                            className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-lg font-bold text-slate-900 mb-6"
                            placeholder="ニックネームを入力"
                        />

                        <Text className="text-sm font-bold text-slate-400 mb-2 ml-1">合格目標日（YYYY-MM-DD）</Text>
                        <TextInput
                            value={editTargetDate}
                            onChangeText={setEditTargetDate}
                            className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-lg font-bold text-slate-900 mb-8"
                            placeholder="例: 2025-02-01"
                        />

                        <TouchableOpacity
                            onPress={saveProfile}
                            className="bg-slate-900 rounded-2xl p-5 flex-row items-center justify-center shadow-lg shadow-slate-300"
                        >
                            <Save size={20} color="white" className="mr-2" />
                            <Text className="text-white font-black text-lg">保存する</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
