import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions, ScrollView, Modal, Switch, LogBox, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Play, Pause, SkipForward, SkipBack, Headphones, Settings, X, RefreshCcw, Shuffle, ListMusic, Brain, BookOpen, Sparkles, PlayCircle } from 'lucide-react-native';
import clsx from 'clsx';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { db } from '../db/client';
import { questions } from '../db/schema';
import { eq, inArray, asc, desc, not } from 'drizzle-orm';
import Constants from 'expo-constants';

LogBox.ignoreAllLogs(true);

const { width } = Dimensions.get('window');

const RESUME_KEY = '@welfare_master_audio_resume';
const PLAYBACK_RATE_KEY = '@welfare_master_audio_rate';
const SETTINGS_KEY = '@welfare_master_audio_settings';

const safeJsonParse = (str: any, fallback: any) => {
    if (!str) return fallback;
    if (typeof str !== 'string') return str;
    try {
        return JSON.parse(str);
    } catch (e) {
        if (str.includes(',')) return str.split(',').map(s => s.trim());
        return fallback;
    }
};

const safeSpeechStop = () => {
    try {
        Speech.stop();
    } catch (e) {
    }
};

type CourseType = 'weakness' | 'random' | 'all' | 'custom';

export default function AudioPlayer() {
    const router = useRouter();
    const brandColor = Constants.expoConfig?.extra?.brandColor || '#6366f1'; // Indigo for audio

    // App Mode: 'setup' (menu) or 'player' (active)
    const [appMode, setAppMode] = useState<'setup' | 'player'>('setup');
    const [selectedCourse, setSelectedCourse] = useState<CourseType>('weakness');

    // Player State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);
    const [playlist, setPlaylist] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [showSettings, setShowSettings] = useState(false);
    const [readExplanation, setReadExplanation] = useState(true);

    type Phase = 'intro' | 'question' | 'options' | 'thinking_time' | 'answer' | 'explanation' | 'next';
    const [playbackPhase, setPlaybackPhase] = useState<Phase>('question');
    const [displayedText, setDisplayedText] = useState("");

    // REFS
    const cycleIdRef = useRef(0);
    const isMountedRef = useRef(true);
    const rateRef = useRef(1.0);

    // Params for direct deep linking
    const params = useLocalSearchParams();

    useEffect(() => {
        loadSettings();

        // If params provided, auto-start in custom mode
        if (params.mode || params.value) {
            setSelectedCourse('custom');
            startPlaylist('custom');
        }

        return () => {
            isMountedRef.current = false;
            safeSpeechStop();
        };
    }, []);

    useEffect(() => {
        rateRef.current = playbackRate;
    }, [playbackRate]);

    useEffect(() => {
        if (appMode === 'player' && isPlaying && currentQuestion) {
            startCycle('resume');
        } else {
            safeSpeechStop();
            cycleIdRef.current += 1;
        }
    }, [isPlaying, appMode]);

    useEffect(() => {
        if (appMode === 'player' && currentQuestion && isPlaying) {
            startCycle('start');
        }
    }, [currentQuestion]);


    const startCycle = (mode: 'start' | 'resume') => {
        cycleIdRef.current += 1;
        const myCycleId = cycleIdRef.current;

        let phaseToRun = playbackPhase;
        if (mode === 'start') {
            phaseToRun = 'question';
            setPlaybackPhase('question');
        }

        runPhase(phaseToRun, myCycleId);
    };

    const runPhase = (phase: Phase, cycleId: number) => {
        if (cycleIdRef.current !== cycleId) return;
        if (!isMountedRef.current) return;

        setPlaybackPhase(phase);
        if (!currentQuestion) return;

        switch (phase) {
            case 'question':
                setDisplayedText(currentQuestion.questionText);
                speak(`問題。${currentQuestion.questionText}`, cycleId, () => {
                    runPhase('options', cycleId);
                });
                break;

            case 'options':
                const optionsData = safeJsonParse(currentQuestion.options, []);
                let optionsText = "";
                let optionsDisplay = "";
                if (Array.isArray(optionsData) && optionsData.length > 0) {
                    optionsData.forEach((opt: string, idx: number) => {
                        const num = idx + 1;
                        optionsText += `選択肢${num}、${opt}。`;
                        optionsDisplay += `[${num}] ${opt}\n\n`;
                    });
                } else {
                    optionsDisplay = "選択肢なし";
                }
                setDisplayedText(optionsDisplay.trim());
                if (optionsText) {
                    speak(optionsText, cycleId, () => runPhase('thinking_time', cycleId));
                } else {
                    setTimeout(() => runPhase('thinking_time', cycleId), 500);
                }
                break;

            case 'thinking_time':
                setDisplayedText("Thinking Time...");
                setTimeout(() => {
                    if (cycleIdRef.current !== cycleId) return;
                    runPhase('answer', cycleId);
                }, 3000);
                break;

            case 'answer':
                let correctAnswersData = currentQuestion.correctAnswer;
                if (typeof correctAnswersData === 'string') {
                    const parsed = safeJsonParse(correctAnswersData, [correctAnswersData]);
                    correctAnswersData = Array.isArray(parsed) ? parsed : [parsed];
                } else if (!Array.isArray(correctAnswersData)) {
                    correctAnswersData = [correctAnswersData];
                }
                const validAnswers = correctAnswersData.filter((c: any) => c != null);
                const answerStr = validAnswers.join('と');
                const answerText = `正解は、選択肢${answerStr}です。`;

                setDisplayedText(`正解: ${answerStr}`);

                speak(answerText, cycleId, () => {
                    if (readExplanation) {
                        runPhase('explanation', cycleId);
                    } else {
                        performNext(cycleId);
                    }
                });
                break;

            case 'explanation':
                const cleanExp = currentQuestion.explanation?.replace(/[*【】]/g, '') || "解説はありません";
                setDisplayedText(cleanExp);
                speak(`解説。${cleanExp}`, cycleId, () => {
                    performNext(cycleId);
                });
                break;
        }
    };

    const performNext = (cycleId: number) => {
        if (cycleIdRef.current !== cycleId) return;

        const nextIdx = currentIndex + 1;
        if (nextIdx < playlist.length) {
            setCurrentIndex(nextIdx);
            setCurrentQuestion(playlist[nextIdx]);
            // UX: Slight pause before next
            setTimeout(() => {
                // Auto-start handled by useEffect on currentQuestion
            }, 500);
        } else {
            setIsPlaying(false);
            setDisplayedText("全ての再生が終了しました。お疲れ様でした。");
            speak("全ての再生が終了しました。お疲れ様でした。", cycleId, () => { });
        }
    };

    const speak = (text: string, cycleId: number, onDone: () => void) => {
        safeSpeechStop();
        const rateToUse = rateRef.current;

        Speech.speak(text, {
            language: 'ja',
            rate: rateToUse,
            pitch: 1.0,
            onDone: () => {
                if (cycleIdRef.current !== cycleId) return;
                onDone();
            },
            onError: (e) => { },
        });
    };

    const togglePlaybackRate = async () => {
        const rates = [1.0, 1.25, 1.5, 2.0, 0.75];
        const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
        const nextRate = rates[nextIndex];

        rateRef.current = nextRate;
        setPlaybackRate(nextRate);
        await AsyncStorage.setItem(PLAYBACK_RATE_KEY, nextRate.toString());

        if (isPlaying) {
            cycleIdRef.current += 1;
            safeSpeechStop();
            setTimeout(() => {
                if (isPlaying) startCycle('resume');
            }, 100);
        }
    };

    const handleNext = async () => {
        cycleIdRef.current += 1;
        safeSpeechStop();

        const nextIdx = currentIndex + 1;
        if (nextIdx < playlist.length) {
            setCurrentIndex(nextIdx);
            const nextQ = playlist[nextIdx];
            setCurrentQuestion(nextQ);
            setPlaybackPhase('question');
            setDisplayedText(nextQ.questionText);
        } else {
            setIsPlaying(false);
            setDisplayedText("終了");
        }
    };

    const handlePrev = async () => {
        cycleIdRef.current += 1;
        safeSpeechStop();

        const prevIdx = currentIndex - 1;
        if (prevIdx >= 0) {
            setCurrentIndex(prevIdx);
            const prevQ = playlist[prevIdx];
            setCurrentQuestion(prevQ);
            setPlaybackPhase('question');
            setDisplayedText(prevQ.questionText);
        }
    };

    const togglePlay = () => {
        setIsPlaying(!isPlaying);
    };

    const loadSettings = async () => {
        try {
            const savedRate = await AsyncStorage.getItem(PLAYBACK_RATE_KEY);
            if (savedRate) {
                const r = parseFloat(savedRate) || 1.0;
                setPlaybackRate(r);
                rateRef.current = r;
            }
            const savedSettings = await AsyncStorage.getItem(SETTINGS_KEY);
            if (savedSettings) {
                const parsed = safeJsonParse(savedSettings, {});
                setReadExplanation(parsed.readExplanation ?? true);
            }
        } catch (e) { }
    };

    const saveSettings = async (newReadExplanation: boolean) => {
        setReadExplanation(newReadExplanation);
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ readExplanation: newReadExplanation }));
    };

    const startPlaylist = async (course: CourseType) => {
        setLoading(true);
        setAppMode('player');

        try {
            const variant = Constants.expoConfig?.extra?.variant || 'social';
            let query = db.select().from(questions);

            // 1. Base Filter by Variant
            let targetGroups: string[] = [];
            if (variant === 'mental') targetGroups = ['common', 'common_mental', 'spec_mental', 'past_mental'];
            else if (variant === 'care') targetGroups = ['common', 'common_care', 'spec_care', 'past_kaigo'];
            else targetGroups = ['common', 'common_social', 'spec_social', 'past_social'];

            query = query.where(inArray(questions.group, targetGroups));

            // 2. Logic based on Course
            let result: any[] = [];

            if (course === 'custom') {
                // Deep link params logic
                if (params.mode === 'year' && params.value) {
                    query = query.where(eq(questions.year, params.value as string));
                } else if (params.mode === 'category' && params.value) {
                    query = query.where(eq(questions.categoryLabel, params.value as string));
                }
                result = await query.limit(100);

            } else if (course === 'weakness') {
                // Not masked or Wrong history (mock logic for now since history is complex join)
                // Just use isMastered = false for now
                query = query.where(eq(questions.isMastered, false));
                const allUnmastered = await query.limit(300); // Fetch more then shuffle
                result = allUnmastered.sort(() => 0.5 - Math.random()).slice(0, 30); // Random 30 weakness

            } else if (course === 'random') {
                // Random mix
                const all = await query.limit(500); // Fetch pool
                result = all.sort(() => 0.5 - Math.random()).slice(0, 30); // Random 30

            } else if (course === 'all') {
                result = await query.limit(100);
                // Ordered by ID by default
            }

            if (result.length > 0) {
                setPlaylist(result);
                setCurrentIndex(0);
                setCurrentQuestion(result[0]);
                setIsPlaying(true); // Auto start
            } else {
                setDisplayedText("No questions found for this course.");
            }

        } catch (e) {
            console.error(e);
            setDisplayedText("Failed to load playlist.");
        } finally {
            setLoading(false);
        }
    };


    // RENDER: SETUP SCREEN
    if (appMode === 'setup') {
        return (
            <View className="flex-1 bg-slate-900">
                <LinearGradient colors={['#1e1b4b', '#0F172A']} className="absolute inset-0" />
                <SafeAreaView className="flex-1">
                    {/* Header */}
                    <View className="px-6 py-4 flex-row items-center justify-between">
                        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center bg-white/10 rounded-full">
                            <ChevronLeft size={20} color="white" />
                        </TouchableOpacity>
                        <Text className="text-white font-bold text-lg">聞き流しプレイヤー</Text>
                        <View className="w-10" />
                    </View>

                    <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
                        <View className="items-center mb-8">
                            <View className="w-32 h-32 rounded-3xl overflow-hidden mb-4 shadow-2xl shadow-indigo-500/30">
                                <Image source={require('../assets/images/audio_learning_icon.png')} className="w-full h-full" resizeMode="cover" style={{ width: 128, height: 128 }} />
                            </View>
                            <Text className="text-white font-black text-2xl text-center mb-2">聞き流し学習</Text>
                            <Text className="text-indigo-200 text-center text-sm font-medium">
                                通勤・通学中も耳から効率学習。
                            </Text>
                        </View>

                        <Text className="text-white/40 text-xs font-bold uppercase tracking-wider mb-4 ml-1">コースを選択</Text>

                        {/* Course Cards */}
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setSelectedCourse('weakness')}
                            className={clsx(
                                "p-4 rounded-2xl mb-4 border-2 flex-row items-center transition-all",
                                selectedCourse === 'weakness' ? "bg-indigo-600/20 border-indigo-500" : "bg-slate-800 border-transparent"
                            )}
                        >
                            <View className={clsx("w-12 h-12 rounded-full items-center justify-center mr-4", selectedCourse === 'weakness' ? "bg-indigo-500" : "bg-slate-700")}>
                                <Sparkles size={20} color="white" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-white font-bold text-lg mb-1">苦手克服コース</Text>
                                <Text className="text-slate-400 text-xs">未習得の問題からランダムに30問出題</Text>
                            </View>
                            {selectedCourse === 'weakness' && <View className="w-4 h-4 rounded-full bg-indigo-400" />}
                        </TouchableOpacity>

                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setSelectedCourse('random')}
                            className={clsx(
                                "p-4 rounded-2xl mb-4 border-2 flex-row items-center transition-all",
                                selectedCourse === 'random' ? "bg-indigo-600/20 border-indigo-500" : "bg-slate-800 border-transparent"
                            )}
                        >
                            <View className={clsx("w-12 h-12 rounded-full items-center justify-center mr-4", selectedCourse === 'random' ? "bg-indigo-500" : "bg-slate-700")}>
                                <Shuffle size={20} color="white" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-white font-bold text-lg mb-1">ランダムMix</Text>
                                <Text className="text-slate-400 text-xs">全範囲からランダムに30問出題</Text>
                            </View>
                            {selectedCourse === 'random' && <View className="w-4 h-4 rounded-full bg-indigo-400" />}
                        </TouchableOpacity>

                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setSelectedCourse('all')}
                            className={clsx(
                                "p-4 rounded-2xl mb-4 border-2 flex-row items-center transition-all",
                                selectedCourse === 'all' ? "bg-indigo-600/20 border-indigo-500" : "bg-slate-800 border-transparent"
                            )}
                        >
                            <View className={clsx("w-12 h-12 rounded-full items-center justify-center mr-4", selectedCourse === 'all' ? "bg-indigo-500" : "bg-slate-700")}>
                                <ListMusic size={20} color="white" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-white font-bold text-lg mb-1">全問順次再生</Text>
                                <Text className="text-slate-400 text-xs">ID順に全問を再生します</Text>
                            </View>
                            {selectedCourse === 'all' && <View className="w-4 h-4 rounded-full bg-indigo-400" />}
                        </TouchableOpacity>
                    </ScrollView>

                    <View className="p-6">
                        <TouchableOpacity
                            onPress={() => startPlaylist(selectedCourse)}
                            className="bg-indigo-500 w-full py-4 rounded-full flex-row items-center justify-center shadow-lg shadow-indigo-500/50"
                        >
                            <PlayCircle size={24} color="white" className="mr-2" />
                            <Text className="text-white font-bold text-lg">学習を開始</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    // RENDER: PLAYER SCREEN
    if (loading) return (
        <View className="flex-1 bg-slate-900 items-center justify-center">
            <ActivityIndicator color={brandColor} size="large" />
            <Text className="text-indigo-200 mt-6 font-bold text-sm uppercase tracking-widest">プレイリストを作成中...</Text>
        </View>
    );

    let progressVal = 0;
    switch (playbackPhase) {
        case 'question': progressVal = 20; break;
        case 'options': progressVal = 40; break;
        case 'thinking_time': progressVal = 60; break;
        case 'answer': progressVal = 80; break;
        case 'explanation': progressVal = 100; break;
    }

    return (
        <View className="flex-1 bg-slate-900">
            <LinearGradient colors={['#312e81', '#0F172A']} className="absolute inset-0" />
            <SafeAreaView className="flex-1 px-6">
                <View className="flex-row items-center justify-between py-4">
                    <TouchableOpacity onPress={() => setAppMode('setup')} className="w-10 h-10 items-center justify-center bg-white/10 rounded-full">
                        <ChevronLeft size={20} color="white" />
                    </TouchableOpacity>
                    <View>
                        <Text className="text-white/70 font-bold text-[10px] uppercase tracking-[2px] text-center">再生中</Text>
                        <Text className="text-white font-bold text-sm text-center">
                            {selectedCourse === 'weakness' ? '苦手克服コース' : selectedCourse === 'random' ? 'ランダムMIX' : '全問順次コース'}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowSettings(true)} className="w-10 h-10 items-center justify-center bg-white/10 rounded-full">
                        <Settings size={20} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Album Art / Visualizer Area */}
                <View className="items-center mt-4 mb-8">
                    <View className="w-64 h-64 bg-slate-800 rounded-[40px] shadow-2xl shadow-indigo-500/20 border-4 border-white/5 items-center justify-center overflow-hidden relative">
                        {isPlaying && (
                            <MotiView
                                from={{ opacity: 0.5, scale: 1 }}
                                animate={{ opacity: 0.2, scale: 1.2 }}
                                transition={{ type: 'timing', duration: 1500, loop: true } as any}
                                className="absolute w-full h-full bg-indigo-500 rounded-full blur-xl"
                            />
                        )}
                        <Image source={require('../assets/images/audio_learning_icon.png')} className="w-48 h-48 rounded-2xl" resizeMode="contain" style={{ width: 192, height: 192 }} />
                    </View>
                </View>


                <View className="flex-1 bg-slate-800/30 rounded-3xl border border-white/5 overflow-hidden relative mb-6">
                    <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                        <Text className="text-indigo-400 font-bold text-xs uppercase mb-2 tracking-widest">
                            {playbackPhase === 'thinking_time' ? 'シンキングタイム' :
                                playbackPhase === 'explanation' ? '解説' :
                                    playbackPhase === 'answer' ? '正解発表' :
                                        playbackPhase === 'options' ? '選択肢' : '問題'}
                        </Text>
                        <Text className={clsx("text-white font-medium leading-8", playbackPhase === 'question' ? "text-xl" : "text-lg opacity-90")}>
                            {displayedText}
                        </Text>
                    </ScrollView>
                    <LinearGradient colors={['transparent', 'rgba(15,23,42,0.8)']} className="absolute bottom-0 left-0 right-0 h-12" />
                </View>

                <View className="mb-8">
                    <View className="flex-row justify-between items-end mb-2">
                        <Text className="text-white font-bold text-lg">
                            問題 {currentIndex + 1}
                        </Text>
                        <Text className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1">
                            {currentQuestion?.categoryLabel || "一般"}
                        </Text>
                    </View>
                    <View className="h-1 bg-white/10 rounded-full overflow-hidden mb-2">
                        <MotiView animate={{ width: `${progressVal}%` }} transition={{ type: 'timing', duration: 300 } as any} className="h-full bg-indigo-500" />
                    </View>
                    <View className="flex-row justify-between">
                        <Text className="text-white/30 text-[10px] font-bold">{currentIndex + 1} / {playlist.length}</Text>
                        <Text className="text-white/30 text-[10px] font-bold">速度: {playbackRate}x</Text>
                    </View>
                </View>

                <View className="flex-row items-center justify-center gap-8 mb-6">
                    <TouchableOpacity onPress={handlePrev} className="p-4 bg-white/5 rounded-full">
                        <SkipBack size={24} color="white" fill="white" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={togglePlay} className="w-20 h-20 bg-indigo-500 rounded-full items-center justify-center shadow-lg shadow-indigo-500/40" activeOpacity={0.9}>
                        {isPlaying ? <Pause size={32} color="white" fill="white" /> : <Play size={32} color="white" fill="white" className="ml-1" />}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleNext} className="p-4 bg-white/5 rounded-full">
                        <SkipForward size={24} color="white" fill="white" />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={togglePlaybackRate} className="self-center mb-4 px-4 py-2 bg-white/5 rounded-full flex-row items-center gap-2">
                    <RefreshCcw size={12} color="#94a3b8" />
                    <Text className="text-white/50 text-xs font-bold">再生速度: {playbackRate}x</Text>
                </TouchableOpacity>
            </SafeAreaView>

            <Modal visible={showSettings} transparent animationType="fade" onRequestClose={() => setShowSettings(false)}>
                <View className="flex-1 bg-black/80 items-center justify-center p-6">
                    <View className="w-full max-w-sm bg-slate-800 rounded-3xl p-6 border border-white/10">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-white font-bold text-lg">オーディオ設定</Text>
                            <TouchableOpacity onPress={() => setShowSettings(false)}><X size={24} color="white" /></TouchableOpacity>
                        </View>
                        <View className="flex-row justify-between items-center py-4 border-b border-white/5">
                            <Text className="text-slate-300 font-medium">解説の読み上げ</Text>
                            <Switch value={readExplanation} onValueChange={saveSettings} trackColor={{ false: "#334155", true: brandColor }} />
                        </View>
                        <Text className="text-slate-500 text-xs mt-6 text-center">OS標準の音声読み上げ機能（TTS）を使用しています。</Text>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
