import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import Constants from 'expo-constants';

export default function PrivacyPolicyScreen() {
    const router = useRouter();
    const brandColor = Constants.expoConfig?.extra?.brandColor || '#FF6B00';

    const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
        <View className="mb-6">
            <Text className="text-lg font-bold text-slate-900 mb-2">{title}</Text>
            <View className="bg-white p-4 rounded-2xl border border-slate-100">
                {children}
            </View>
        </View>
    );

    const P = ({ children }: { children: React.ReactNode }) => (
        <Text className="text-slate-600 leading-6 text-sm mb-2">{children}</Text>
    );

    const Li = ({ children }: { children: React.ReactNode }) => (
        <View className="flex-row items-start mb-1">
            <Text className="text-slate-400 mr-2">•</Text>
            <Text className="text-slate-600 leading-6 text-sm flex-1">{children}</Text>
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
            {/* Header */}
            <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate-100">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="p-2 rounded-full bg-slate-50 mr-2"
                >
                    <ChevronLeft size={24} color="#64748B" />
                </TouchableOpacity>
                <Text className="text-lg font-black text-slate-800">プライバシーポリシー</Text>
            </View>

            <ScrollView className="flex-1 px-5 pt-6" contentContainerStyle={{ paddingBottom: 50 }}>
                <Text className="text-xs font-bold text-slate-400 mb-6 text-right">最終更新日: 2025年1月1日</Text>

                <Section title="1. はじめに">
                    <P>
                        本アプリケーション（以下「本アプリ」）は、ユーザーのプライバシーを尊重し、個人情報の保護に努めます。
                        本プライバシーポリシーでは、本アプリが収集するその他の情報およびその使用方法について説明します。
                    </P>
                </Section>

                <Section title="2. 収集する情報">
                    <P>本アプリは、以下の情報を収集・保存する場合があります：</P>
                    <Li>学習の進捗状況、正答率、学習時間などの利用データ</Li>
                    <Li>ユーザーが設定した目標日やニックネームなどのプロフィール情報</Li>
                    <Li>お気に入り登録した問題や付箋データ</Li>
                    <P>これらの情報は、すべてユーザーの端末内（ローカルストレージ）に保存され、明示的な操作がない限り外部サーバーへ送信されることはありません。</P>
                </Section>

                <Section title="3. 情報の利用目的">
                    <P>収集した情報は、以下の目的で利用されます：</P>
                    <Li>ユーザーの学習効率を最大化するための統計分析</Li>
                    <Li>学習リマインダー通知の配信</Li>
                    <Li>アプリの機能改善および不具合の修正</Li>
                </Section>

                <Section title="4. 第三者への提供">
                    <P>
                        本アプリは、ユーザーの同意がある場合や法令に基づく場合を除き、個人情報を第三者に提供することはありません。
                        ただし、アプリの利用状況解析のために、個人を特定できない形式で統計データを利用する場合があります（Google Analytics等）。
                    </P>
                </Section>

                <Section title="5. 免責事項">
                    <P>
                        本アプリは、国家試験の合格を保証するものではありません。
                        本アプリの利用により生じた損害について、開発者は一切の責任を負わないものとします。
                        問題の内容には万全を期していますが、法改正等により最新の情報と異なる場合があります。
                    </P>
                </Section>

                <Section title="6. お問い合わせ">
                    <P>
                        本ポリシーに関するご質問や、アプリに関するお問い合わせは、設定画面の「ヘルプ＆お問い合わせ」よりご連絡ください。
                    </P>
                </Section>

                <View className="items-center py-8">
                    <Text className="text-slate-300 font-bold text-xs">Welfare Master</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
