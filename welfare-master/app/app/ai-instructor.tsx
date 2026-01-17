import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Send, Sparkles, Brain, GraduationCap } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import Constants from 'expo-constants';
import { db } from '../db/client';
import { questions } from '../db/schema';
import { like } from 'drizzle-orm';

export default function AIInstructorScreen() {
    const router = useRouter();
    const brandColor = Constants.expoConfig?.extra?.brandColor || '#ec4899'; // Pink/Rose for Tutor
    const [message, setMessage] = useState('');
    const [chatLog, setChatLog] = useState([
        { id: 1, text: 'こんにちは！AI指導教官です。あなたの学習進捗に基づき、最適なアドバイスを提供します。今日はどの科目を重点的に学習しますか？', sender: 'ai' }
    ]);

    const handleSend = async () => {
        if (!message.trim()) return;

        const userText = message.trim();
        const newMsg = { id: Date.now(), text: userText, sender: 'user' };
        setChatLog(prev => [...prev, newMsg as any]);
        setMessage('');

        // Define keywords for logic
        const lowerText = userText.toLowerCase();

        // 1. Progress / Advice Logic
        const adviceKeywords = ['おすすめ', '次', '進捗', 'どう', '不安', 'できない', '疲れた', 'コツ', '覚え方', 'やった', '正解', '終わった'];
        if (adviceKeywords.some(k => userText.includes(k))) {
            setTimeout(() => {
                const adviceRaw = [
                    // Standard Progress Advice
                    "あなたの学習履歴を見ると、『共通科目』の正答率が安定してきています。次は『専門科目』の新しい年度に挑戦してみましょう。",
                    "最近、学習ペースが良いですね！この調子で1日15分を継続しましょう。",
                    "少し『現代社会と福祉』の分野で間違いが目立ちます。苦手克服モードでこの分野を重点的に解くのが近道です。",
                    "勉強の調子はどうですか？疲れたら『聞き流しプレイヤー』でリラックスしながら学習するのもおすすめです。",
                    "継続は力なり、です。毎日少しずつ積み重ねていきましょう！",
                    "まずは得意な科目から始めて、学習のリズムを作るのも良い作戦ですよ。",

                    // 1. Anxiety / Slump
                    "焦る必要はありません。忘れることは脳が情報を整理している証拠でもあります。何度も繰り返せば必ず定着しますよ。",
                    "今日は調子が出ない日かもしれませんね。そんな時は『1問だけ』解いて終わりにしましょう。ゼロでなければ前進です。",
                    "誰でもスランプはあります。今はしゃがむ時期かもしれませんが、それは次また高く飛ぶための準備期間ですよ。",
                    "一気に全部覚えようとせず、今日は「この用語だけ」と決めて取り組むのも効果的です。",

                    // 2. Praise / Motivation
                    "素晴らしい！その積み重ねが合格への最短ルートです。私まで嬉しくなってきました！",
                    "天才ですか！？その調子なら本番も怖くありませんね。",
                    "良いペースですね！このままいけば、目標達成も夢ではありません。",
                    "完璧です！今の感覚を忘れないうちに、もう1問だけ挑戦してみますか？",

                    // 3. Study Techniques
                    "『ポモドーロ・テクニック』をご存知ですか？25分勉強して5分休む。これを繰り返すと驚くほど集中力が続きますよ。",
                    "寝る前の暗記が最強です。今夜はスマホを見る代わりに、単語帳をパラパラめくってから眠りにつきませんか？",
                    "人に教えるつもりで声に出して読んでみると、記憶の定着率が劇的に上がりますよ（エア授業おすすめです）。",
                    "間違えた問題こそが宝の山です。なぜ間違えたかを理解することが、スコアアップへの一番の近道です。"
                ];

                // Context-aware selection (Simple version)
                let filteredAdvice = adviceRaw;

                // If user seems negative
                if (userText.includes('不安') || userText.includes('できない') || userText.includes('疲れた')) {
                    filteredAdvice = adviceRaw.slice(6, 10); // Anxiety/Slump section
                }
                // If user seems positive
                else if (userText.includes('やった') || userText.includes('正解') || userText.includes('終わった')) {
                    filteredAdvice = adviceRaw.slice(10, 14); // Praise section
                }
                // If user asks for tips
                else if (userText.includes('コツ') || userText.includes('覚え方')) {
                    filteredAdvice = adviceRaw.slice(14, 18); // Tips section
                }

                const advice = filteredAdvice[Math.floor(Math.random() * filteredAdvice.length)];

                setChatLog(prev => [...prev, {
                    id: Date.now(),
                    text: advice,
                    sender: 'ai'
                }]);
            }, 600);
            return;
        }

        // 2. Short Conversation / Filler Logic (New)
        // Handle short responses naturally without DB search
        if (userText.length <= 3 || ['え？', 'うん', 'はい', 'ありがとう', 'なるほど'].some(w => userText.includes(w))) {
            setTimeout(() => {
                let reply = "何か気になることがあれば、具体的なキーワード（例：「更生保護」「権利擁護」）で聞いてくださいね。";

                if (userText.includes('え？') || userText.includes('ええ')) {
                    reply = "説明が分かりにくかったでしょうか？\nもし用語の意味を知りたい場合は、その単語のみを入力してみてください。";
                } else if (userText.includes('ありがとう')) {
                    reply = "どういたしまして！一緒に頑張りましょう。";
                } else if (userText.includes('はい') || userText.includes('うん')) {
                    reply = "やる気があって素晴らしいですね！次の質問もお待ちしています。";
                }

                setChatLog(prev => [...prev, {
                    id: Date.now(),
                    text: reply,
                    sender: 'ai'
                }]);
            }, 500);
            return;
        }

        // 3. Database Search Logic (RAG-lite)
        try {
            // Search in explanation or question text
            // Using a simple LIKE query for exact keyword match
            // Creating keywords array from spaces
            const keywords = userText.split(/\s+/).filter(k => k.length > 1);

            if (keywords.length === 0) {
                // Should be caught by short conversation logic usually, but just in case
                setTimeout(() => {
                    setChatLog(prev => [...prev, {
                        id: Date.now(),
                        text: '検索キーワードを「障害者総合支援法」のように具体的に入力してみてください。',
                        sender: 'ai'
                    }]);
                }, 500);
                return;
            }

            // Find questions that contain the keyword in explanation
            // Note: Expo SQLite usually doesn't strictly support standard LIKE with user input binding easily in some ORMs, 
            // but we will try a simple fetching approach. 
            // For safety and simplicity, we fetch a chunk and filter in JS if the DB is small, 
            // OR use the 'like' operator from drizzle properly.

            // Using Drizzle's like queries
            // We search for the first keyword
            const searchTerm = `%${keywords[0]}%`;

            const results = await db.select({
                explanation: questions.explanation,
                question: questions.questionText,
                year: questions.year,
                categoryLabel: questions.categoryLabel
            })
                .from(questions)
                .where(like(questions.explanation, searchTerm))
                .limit(1);

            if (results.length > 0) {
                const result = results[0];

                let sourceInfo = '参考問題';
                if (result.year) {
                    sourceInfo = `過去問（${result.year}）`;
                } else if (result.categoryLabel) {
                    sourceInfo = `参考テキスト（${result.categoryLabel}）`;
                }

                const aiResponse = `「${keywords[0]}」についてですね。${sourceInfo}の解説に以下の記述があります。\n\n問題: ${result.question}\n\n解説: ${result.explanation.substring(0, 200)}...`;
                setChatLog(prev => [...prev, { id: Date.now(), text: aiResponse, sender: 'ai' }]);
            } else {
                // Not found fallback
                setChatLog(prev => [...prev, {
                    id: Date.now(),
                    text: `「${keywords[0]}」についての解説は見つかりませんでした。\n\nキーワードを変えるか（例：「${keywords[0].slice(0, 2)}」など）、別の単語で検索してみてください。\nもちろん、学習方法の相談も受け付けていますよ！`,
                    sender: 'ai'
                }]);
            }

        } catch (e) {
            console.error("Database search error:", e);
            setChatLog(prev => [...prev, { id: Date.now(), text: 'すみません、データベースへの接続でエラーが発生しました。', sender: 'ai' }]);
        }
    };

    return (
        <View className="flex-1 bg-slate-50">
            <SafeAreaView className="flex-1">
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1"
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    {/* Header */}
                    <View className="px-6 py-4 flex-row items-center justify-between bg-white border-b border-slate-100">
                        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center bg-slate-50 rounded-full">
                            <ChevronLeft size={24} color="#64748b" />
                        </TouchableOpacity>
                        <View className="items-center">
                            <Text className="text-slate-800 font-bold text-lg">AI指導教官</Text>
                            <Text className="text-slate-400 text-xs font-bold">Personal Tutor</Text>
                        </View>
                        <View className="w-10" />
                    </View>

                    {/* Chat Area */}
                    <ScrollView
                        className="flex-1 px-4 py-6"
                        contentContainerStyle={{ paddingBottom: 20 }}
                        ref={(ref) => { ref?.scrollToEnd({ animated: true }) }}
                        onContentSizeChange={(w, h) => { /* Auto scroll logic usually handled by ref */ }}
                    >
                        {/* Intro Card */}
                        <LinearGradient
                            colors={['#ec4899', '#db2777']}
                            className="rounded-2xl p-6 mb-8 shadow-lg shadow-pink-200"
                        >
                            <View className="flex-row items-center mb-4">
                                <View className="w-12 h-12 bg-white/20 rounded-full items-center justify-center mr-4 border border-white/30">
                                    <GraduationCap size={24} color="white" />
                                </View>
                                <View>
                                    <Text className="text-white font-bold text-lg">学習分析レポート</Text>
                                    <Text className="text-pink-100 text-xs">Updated just now</Text>
                                </View>
                            </View>
                            <Text className="text-white font-medium leading-6">
                                現在、あなたは「共通科目」の進捗が順調です。次は「専門科目」の基礎固めに移るのに良いタイミングです。
                            </Text>
                        </LinearGradient>

                        {/* Chat Messages */}
                        {chatLog.map((msg) => (
                            <View
                                key={msg.id}
                                className={`flex-row mb-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {msg.sender === 'ai' && (
                                    <View className="w-8 h-8 rounded-full overflow-hidden mr-2 border border-slate-100">
                                        <Image
                                            source={require('../assets/images/ai_instructor.png')}
                                            className="w-full h-full"
                                            resizeMode="cover"
                                        />
                                    </View>
                                )}
                                <View
                                    className={`px-4 py-3 rounded-2xl max-w-[80%] ${msg.sender === 'user'
                                        ? 'bg-slate-800 rounded-tr-none'
                                        : 'bg-white border border-slate-100 rounded-tl-none shadow-sm'
                                        }`}
                                >
                                    <Text className={msg.sender === 'user' ? 'text-white' : 'text-slate-700'}>
                                        {msg.text}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>

                    {/* Input Area */}
                    <View className="p-4 bg-white border-t border-slate-100">
                        <View className="flex-row items-center bg-slate-50 rounded-full px-4 border border-slate-200">
                            <TextInput
                                className="flex-1 py-3 text-slate-800 font-medium h-12"
                                placeholder="学習の悩みを相談..."
                                placeholderTextColor="#94a3b8"
                                style={{ color: '#1e293b' }} // Explicit color
                                value={message}
                                onChangeText={setMessage}
                                returnKeyType="send"
                                onSubmitEditing={handleSend}
                            />
                            <TouchableOpacity
                                onPress={handleSend}
                                className="w-8 h-8 bg-pink-500 rounded-full items-center justify-center ml-2"
                            >
                                <Send size={16} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}
