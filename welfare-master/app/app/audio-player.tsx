import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Play, Pause, SkipForward, SkipBack, X, Headphones, MoreHorizontal, Bookmark, ListMusic } from 'lucide-react-native';
import clsx from 'clsx';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, AnimatePresence } from 'moti';
import { db } from '../db/client';
import { questions } from '../db/schema';
import { eq, and, gt, asc, isNull, inArray } from 'drizzle-orm';
import Constants from 'expo-constants';

const { width } = Dimensions.get('window');

const RESUME_KEY = '@welfare_master_audio_resume';
const PLAYBACK_RATE_KEY = '@welfare_master_audio_rate';

export default function AudioPlayer() {
    const router = useRouter();
    const brandColor = Constants.expoConfig?.extra?.brandColor || '#FF6B00';

    // Playback State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [playlist, setPlaylist] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1.0);

    // Audio Phase State: 'intro' -> 'question' -> 'thinking_time' -> 'answer' -> 'explanation' -> 'next'
    const [playbackPhase, setPlaybackPhase] = useState<'intro' | 'question' | 'thinking_time' | 'answer' | 'explanation' | 'next'>('question');

    useEffect(() => {
        loadPlaylist();
        return () => {
            Speech.stop();
        };
    }, []);

    const loadPlaylist = async () => {
        setLoading(true);
        try {
            // Check resume and rate
            const resumeData = await AsyncStorage.getItem(RESUME_KEY);
            const savedRate = await AsyncStorage.getItem(PLAYBACK_RATE_KEY);
            if (savedRate) {
                setPlaybackRate(parseFloat(savedRate));
            }

            let startIndex = 0;

            // For now, simple playlist: All unmastered questions or just first 50
            const maxAudioSession = 50;
            const userLicense = await AsyncStorage.getItem('user_license');

            // Build query
            let query = db.select().from(questions);

            if (userLicense === 'care') {
                query = query.where(eq(questions.group, 'past_kaigo'));
            } else if (userLicense === 'social') {
                query = query.where(inArray(questions.group, ['common', 'spec_social', 'past_social']));
            } else if (userLicense === 'mental') {
                query = query.where(inArray(questions.group, ['common', 'spec_mental', 'past_mental']));
            }

            const result = await query.limit(maxAudioSession);

            if (result.length > 0) {
                setPlaylist(result);

                if (resumeData) {
                    const { lastIndex, lastId } = JSON.parse(resumeData);
                    // Verify if lastId matches
                    if (result[lastIndex]?.id === lastId) {
                        startIndex = lastIndex;
                    }
                }

                setCurrentIndex(startIndex);
                setCurrentQuestion(result[startIndex]);
            }
        } catch (e) {
            console.error("Failed to load audio playlist", e);
        } finally {
            setLoading(false);
        }
    };

    // Main Audio Loop Engine
    useEffect(() => {
        if (!isPlaying || !currentQuestion) {
            Speech.stop();
            return;
        }


        const speak = (text: string, onDone: () => void) => {
            Speech.speak(text, {
                language: 'ja',
                rate: playbackRate,
                pitch: 1.0,
                onDone: onDone,
                onError: (e) => console.error("Speech error", e),
            });
        };

        const playCycle = () => {
            switch (playbackPhase) {
                case 'question':
                    speak(
                        `問題。${currentQuestion.questionText}`,
                        () => setPlaybackPhase('thinking_time')
                    );
                    break;
                case 'thinking_time':
                    // Silent pause for thinking (3 seconds)
                    // Unfortunately expo-speech doesn't have silence, so we use setTimeout
                    setTimeout(() => {
                        if (isPlaying) setPlaybackPhase('answer');
                    }, 3000);
                    break;
                case 'answer':
                    // Parse correct answers safely
                    let correctAnswersData = currentQuestion.correctAnswer;
                    if (typeof correctAnswersData === 'string') {
                        try {
                            correctAnswersData = JSON.parse(correctAnswersData);
                        } catch (e) {
                            // Fallback if not JSON (e.g. single value string?) or already corrupt
                            // Assume it might just be a string literal or we wrap it
                            correctAnswersData = [correctAnswersData];
                        }
                    }
                    // Ensure it is array
                    if (!Array.isArray(correctAnswersData)) {
                        correctAnswersData = [];
                    }

                    const answerText = `正解は、選択肢${correctAnswersData.map((a: string) => a).join('と')}です。`;
                    speak(answerText, () => setPlaybackPhase('explanation'));
                    break;
                case 'explanation':
                    const cleanExp = currentQuestion.explanation.replace(/[*【】]/g, '');
                    speak(
                        `解説。${cleanExp}`,
                        () => setPlaybackPhase('next')
                    );
                    break;
                case 'next':
                    handleNext();
                    break;
            }
        };

        playCycle();

    }, [isPlaying, playbackPhase, currentQuestion, playbackRate]);

    const togglePlaybackRate = () => {
        const rates = [1.0, 1.25, 1.5, 2.0, 0.75];
        const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
        const nextRate = rates[nextIndex];
        setPlaybackRate(nextRate);
        AsyncStorage.setItem(PLAYBACK_RATE_KEY, nextRate.toString());
        // If playing, restart current speech with new rate? 
        // expo-speech doesn't support changing rate on the fly easily without restart.
        // For simple impl, wait next phrase. User can pause/play to force update if needed.
    };

    const handleNext = async () => {
        const nextIdx = currentIndex + 1;
        if (nextIdx < playlist.length) {
            Speech.stop();
            setCurrentIndex(nextIdx);
            setCurrentQuestion(playlist[nextIdx]);
            setPlaybackPhase('question');

            // Save Progress
            try {
                await AsyncStorage.setItem(RESUME_KEY, JSON.stringify({
                    lastIndex: nextIdx,
                    lastId: playlist[nextIdx].id
                }));
            } catch (e) { }

        } else {
            setIsPlaying(false);
            // End of playlist
        }
    };

    const handlePrev = () => {
        const prevIdx = currentIndex - 1;
        if (prevIdx >= 0) {
            Speech.stop();
            setCurrentIndex(prevIdx);
            setCurrentQuestion(playlist[prevIdx]);
            setPlaybackPhase('question');
        }
    };

    const togglePlay = () => {
        setIsPlaying(!isPlaying);
    };

    if (loading) return (
        <View className="flex-1 bg-slate-900 items-center justify-center">
            <ActivityIndicator color={brandColor} />
            <Text className="text-white mt-4 font-bold text-xs uppercase tracking-widest">Loading Audio...</Text>
        </View>
    );

    return (
        <View className="flex-1 bg-slate-900">
            {/* Background Gradient */}
            <LinearGradient
                colors={['#0F172A', '#1E293B']}
                className="absolute inset-0"
            />

            {/* Header */}
            <SafeAreaView className="flex-1 px-8">
                <View className="flex-row items-center justify-between py-6">
                    <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center bg-white/10 rounded-full">
                        <ChevronLeft size={20} color="white" />
                    </TouchableOpacity>
                    <Text className="text-white/50 font-black text-[10px] uppercase tracking-[3px]">Ear Study Mode</Text>
                    <TouchableOpacity onPress={togglePlaybackRate} className="h-10 px-3 items-center justify-center bg-white/10 rounded-full">
                        <Text className="text-white font-bold text-xs">{playbackRate}x</Text>
                    </TouchableOpacity>
                </View>

                {/* Cover Art Area */}
                <View className="items-center mt-8 mb-12">
                    <MotiView
                        from={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-64 h-64 bg-slate-800 rounded-[40px] shadow-2xl items-center justify-center border border-white/5 relative overflow-hidden"
                    >
                        <LinearGradient
                            colors={[brandColor, '#3b82f6']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            className="absolute inset-0 opacity-20"
                        />
                        <View className="w-32 h-32 bg-white/10 rounded-full items-center justify-center backdrop-blur-md border border-white/10">
                            <Headphones size={48} color="white" />
                        </View>
                        {isPlaying && (
                            <View className="absolute bottom-6 flex-row gap-1">
                                {[1, 2, 3, 4].map(i => (
                                    <MotiView
                                        key={i}
                                        from={{ height: 10 }}
                                        animate={{ height: [10, 30, 15, 40, 10] }}
                                        transition={{
                                            loop: true,
                                            type: 'timing',
                                            duration: 500 + (i * 100),
                                        } as any}
                                        className="w-1 bg-orange-500 rounded-full"
                                    />
                                ))}
                            </View>
                        )}
                    </MotiView>
                </View>

                {/* Track Info */}
                <View className="mb-10 items-center">
                    <Text className="text-white font-black text-2xl text-center mb-2 leading-8">
                        {currentQuestion ? currentQuestion.id : "Loading..."}
                    </Text>
                    <Text className="text-white/50 font-bold text-sm tracking-widest uppercase">
                        {currentQuestion ? (currentQuestion.categoryLabel || "General Knowledge") : ""}
                    </Text>
                </View>

                {/* Progress Bar (Mock) */}
                <View className="mb-12">
                    <View className="h-1 bg-white/10 rounded-full overflow-hidden mb-2">
                        <View className="h-full bg-orange-500 w-[30%]" />
                    </View>
                    <View className="flex-row justify-between">
                        <Text className="text-white/30 text-[10px] font-bold">0:00</Text>
                        <Text className="text-white/30 text-[10px] font-bold">-:--</Text>
                    </View>
                </View>

                {/* Controls */}
                <View className="flex-row items-center justify-center gap-8 mb-auto">
                    <TouchableOpacity onPress={handlePrev} className="p-4">
                        <SkipBack size={32} color="white" fill="white" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={togglePlay}
                        className="w-20 h-20 bg-white rounded-full items-center justify-center shadow-lg shadow-white/20"
                        activeOpacity={0.9}
                    >
                        {isPlaying ? (
                            <Pause size={32} color={brandColor} fill={brandColor} />
                        ) : (
                            <Play size={32} color={brandColor} fill={brandColor} className="ml-1" />
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleNext} className="p-4">
                        <SkipForward size={32} color="white" fill="white" />
                    </TouchableOpacity>
                </View>

                {/* Footer Controls */}
                <View className="flex-row justify-between pb-8 px-4">
                    <TouchableOpacity className="items-center">
                        <ListMusic size={20} color="#94a3b8" />
                        <Text className="text-slate-400 text-[9px] font-bold mt-1">Playlist</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="items-center">
                        <Bookmark size={20} color="#94a3b8" />
                        <Text className="text-slate-400 text-[9px] font-bold mt-1">Save</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}
