import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, CheckCircle, XCircle, Type, Info, Star } from 'lucide-react-native';
import clsx from 'clsx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../../db/client';
import { questions, userProgress } from '../../db/schema';
import { eq, and, gt, asc, isNull } from 'drizzle-orm';
import Constants from 'expo-constants';

interface QuestionData {
    id: string;
    text: string;
    options: string[];
    correct_answers: number[]; // Converted from string[] to indices
    explanation: string;
    year: string | null;
    group: string;
}

/**
 * A simple component to render text with basic markdown-like support
 * Supports: **bold**, 【highlight】
 */
const RichText = ({ text, className, baseSize }: { text: string; className?: string; baseSize: number }) => {
    const brandColor = Constants.expoConfig?.extra?.brandColor || '#FF6B00';
    const parts = text.split(/(\*\*.*?\*\*|【.*?】)/);
    return (
        <Text style={{ fontSize: baseSize }} className={clsx("leading-relaxed text-slate-700", className)}>
            {parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return (
                        <Text key={i} className="font-extrabold text-slate-900">
                            {part.slice(2, -2)}
                        </Text>
                    );
                }
                if (part.startsWith('【') && part.endsWith('】')) {
                    return (
                        <Text key={i} className="font-bold" style={{ color: brandColor }}>
                            {part}
                        </Text>
                    );
                }
                return <Text key={i}>{part}</Text>;
            })}
        </Text>
    );
};

export default function QuizPlayer() {
    const { id, mode } = useLocalSearchParams();
    const router = useRouter();

    const [question, setQuestion] = useState<QuestionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [textSizeMode, setTextSizeMode] = useState<number>(1); // 0: Small, 1: Normal, 2: Large, 3: XL
    const [correctCount, setCorrectCount] = useState(0);
    const [questionsAnswered, setQuestionsAnswered] = useState(0);

    const TEXT_SIZE_KEY = '@welfare_master_text_size';

    const isReviewMode = mode === 'review';
    const brandColor = Constants.expoConfig?.extra?.brandColor || '#FF6B00';

    useEffect(() => {
        const loadQuestion = async () => {
            if (!id || typeof id !== 'string') return;
            // Reset state for new question
            setIsSubmitted(false);
            setSelectedIndices([]);
            setLoading(true);

            try {
                const result = await db.select().from(questions).where(eq(questions.id, id));
                if (result.length > 0) {
                    const q = result[0];
                    // Convert correct answers (strings) to indices
                    // Robust answer matching strategy
                    let correctIndices: number[] = [];

                    // Strategy 1: Exact Match (with simple trim)
                    // Strategy 1: Exact Match (with simple trim)
                    const cleanAnswers = q.correctAnswer.map((a: string) => a.trim());
                    correctIndices = q.options.reduce<number[]>((acc, opt, idx) => {
                        if (cleanAnswers.includes(opt.trim())) {
                            acc.push(idx);
                        }
                        return acc;
                    }, []);

                    // Strategy 2: Fuzzy Match (ignore punctuation like trailing periods)
                    if (correctIndices.length === 0) {
                        correctIndices = q.options.reduce<number[]>((acc, opt, idx) => {
                            const cleanOpt = opt.trim().replace(/[.,。、]+$/, '');
                            const isMatch = cleanAnswers.some((ans: string) => {
                                const cleanAns = ans.trim().replace(/[.,。、]+$/, '');
                                return cleanAns === cleanOpt || cleanOpt.includes(cleanAns) || cleanAns.includes(cleanOpt);
                            });
                            if (isMatch) acc.push(idx);
                            return acc;
                        }, []);
                    }

                    // Strategy 3: Numeric Indices (Backup for raw index data)
                    if (correctIndices.length === 0) {
                        const numericAnswers = cleanAnswers.map((a: string) => parseInt(a)).filter((n: number) => !isNaN(n));
                        if (numericAnswers.length > 0) {
                            // Assuming 1-based index in data
                            correctIndices = numericAnswers.map((n: number) => n - 1).filter((i: number) => i >= 0 && i < q.options.length);
                        }
                    }

                    // Deduplicate
                    correctIndices = Array.from(new Set(correctIndices));


                    setQuestion({
                        id: q.id,
                        text: q.questionText,
                        options: q.options,
                        correct_answers: correctIndices,
                        explanation: q.explanation,
                        year: q.year,
                        group: q.group
                    });
                }
            } catch (e) {
                console.error("Failed to load question", e);
            } finally {
                setLoading(false);
            }
        };
        loadQuestion();
    }, [id]);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const savedSize = await AsyncStorage.getItem(TEXT_SIZE_KEY);
                if (savedSize !== null) {
                    setTextSizeMode(parseInt(savedSize));
                }
            } catch (e) {
                console.error("Failed to load settings", e);
            }
        };
        loadSettings();
    }, []);

    // Text size load only

    const toggleSelection = (index: number) => {
        if (isSubmitted) return;
        if (selectedIndices.includes(index)) {
            setSelectedIndices(prev => prev.filter(i => i !== index));
        } else {
            setSelectedIndices(prev => [...prev, index]);
        }
    };

    const isCorrect = (index: number) => question ? question.correct_answers.includes(index) : false;
    const isSelected = (index: number) => selectedIndices.includes(index);

    const checkAnswer = () => {
        if (!question) return false;
        // Check if selected indices match correct answer indices exactly
        if (selectedIndices.length !== question.correct_answers.length) return false;
        return selectedIndices.every(i => question.correct_answers.includes(i));
    };

    const submitAnswer = async () => {
        if (!question) return;
        setIsSubmitted(true);

        const correct = checkAnswer();
        if (correct) setCorrectCount(prev => prev + 1);
        setQuestionsAnswered(prev => prev + 1);

        try {
            await db.insert(userProgress).values({
                questionId: question.id,
                isCorrect: correct,
                timestamp: new Date()
            });

            // Update mastery status (simple logic: instant mastery on correct for now)
            if (correct) {
                await db.update(questions)
                    .set({ isMastered: true, correctStreak: 1 }) // Increment logic requires read, simplify for now
                    .where(eq(questions.id, question.id));
            }
        } catch (e) {
            console.error("Failed to save progress", e);
        }
    };

    const handleNextQuestion = async () => {
        if (!question) {
            router.back();
            return;
        }

        try {
            let nextQ;

            if (isReviewMode) {
                nextQ = await db.select()
                    .from(questions)
                    .where(and(
                        eq(questions.isMastered, false),
                        gt(questions.id, question.id)
                    ))
                    .orderBy(asc(questions.id))
                    .limit(1);
            } else {
                nextQ = await db.select()
                    .from(questions)
                    .where(and(
                        question.year ? eq(questions.year, question.year) : isNull(questions.year),
                        eq(questions.group, question.group),
                        gt(questions.id, question.id)
                    ))
                    .orderBy(asc(questions.id))
                    .limit(1);
            }

            if (nextQ.length > 0) {
                const nextId = nextQ[0].id;
                if (isReviewMode) {
                    router.replace(`/quiz/${nextId}?mode=review`);
                } else {
                    router.replace(`/quiz/${nextId}`);
                }
            } else {
                router.replace({
                    pathname: '/quiz/result',
                    params: {
                        total: questionsAnswered,
                        correct: correctCount,
                        year: isReviewMode ? "Weakness Review" : (question.year || "Practice")
                    }
                });
            }
        } catch (e) {
            console.error("Error finding next question", e);
            router.back();
        }
    };

    const cycleTextSize = async () => {
        const nextSize = (textSizeMode + 1) % 3;
        setTextSizeMode(nextSize);
        try {
            await AsyncStorage.setItem(TEXT_SIZE_KEY, nextSize.toString());
        } catch (e) {
            console.error("Failed to save text size", e);
        }
    };


    // Calculate dynamic font sizes
    const fontSizes = [
        { q: 16, opt: 15, exp: 14 }, // 0: Small
        { q: 20, opt: 17, exp: 16 }, // 1: Medium (Default)
        { q: 24, opt: 20, exp: 19 }, // 2: Large
    ];
    const currentSizes = fontSizes[textSizeMode];

    const getSizeLabel = (mode: number) => {
        switch (mode) {
            case 0: return 'S';
            case 1: return 'M';
            case 2: return 'L';
            default: return 'M';
        }
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color={brandColor} />
                <Text className="mt-4 text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading Master Knowledge</Text>
            </SafeAreaView>
        );
    }

    if (!question) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
                <Text className="text-slate-400 font-bold mb-4">Question not found.</Text>
                <TouchableOpacity onPress={() => router.back()} className="w-full py-4 bg-slate-900 rounded-2xl items-center">
                    <Text className="text-white font-black">Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white">
            {/* Header */}
            <View className="flex-row items-center justify-between px-6 py-4 border-b border-slate-50">
                <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center bg-slate-50 rounded-full">
                    <ChevronLeft size={20} color="#64748b" />
                </TouchableOpacity>
                <View className="items-center">
                    <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Question ID</Text>
                    <Text className="font-black text-slate-900 border-b-2 pb-0.5 px-1" style={{ borderBottomColor: brandColor }}>{id}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                    <TouchableOpacity onPress={cycleTextSize} className="w-10 h-10 items-center justify-center bg-slate-50 rounded-full">
                        <Type size={18} color="#64748b" />
                        <View className="absolute -top-1 -right-1 w-4 h-4 rounded-full items-center justify-center" style={{ backgroundColor: brandColor }}>
                            <Text className="text-[8px] text-white font-bold">{getSizeLabel(textSizeMode)}</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>

                {/* Question Info Chip */}
                <View className="flex-row mb-4">
                    <View className="bg-slate-100 px-3 py-1 rounded-full flex-row items-center">
                        <Info size={12} color="#94a3b8" />
                        <Text className="text-slate-500 text-[10px] font-bold ml-1.5 uppercase">
                            {isReviewMode ? "Review Mode" : `${question.year || "Practice"} Exam`}
                        </Text>
                    </View>
                </View>

                {/* Question Text */}
                <View className="mb-10">
                    <Text style={{ fontSize: currentSizes.q }} className="font-bold text-slate-900 leading-[34px]">
                        {question.text}
                    </Text>
                </View>

                {/* Options List */}
                <View className="gap-4 mb-10">
                    {question.options.map((option, index) => {
                        const selected = isSelected(index);
                        const correct = isCorrect(index);

                        let borderColor = "border-slate-100";
                        let bgColor = "bg-white";
                        let shadowColor = "shadow-slate-200";
                        let bubbleBg = "bg-slate-100";
                        let bubbleText = "text-slate-400";
                        let optionText = "text-slate-600";
                        let icon = null;

                        if (isSubmitted) {
                            if (correct) {
                                // Correct answer - Always Green
                                borderColor = "border-green-500";
                                bgColor = "bg-green-50";
                                shadowColor = "shadow-green-100";
                                bubbleBg = "bg-green-500";
                                bubbleText = "text-white";
                                optionText = "text-slate-900";
                                if (selected) {
                                    icon = <CheckCircle size={20} color="#10B981" fill="#10B98133" />;
                                }
                            } else if (selected && !correct) {
                                // User selected wrong - Always Red
                                borderColor = "border-red-500";
                                bgColor = "bg-red-50";
                                shadowColor = "shadow-red-100";
                                bubbleBg = "bg-red-500";
                                bubbleText = "text-white";
                                optionText = "text-slate-900";
                                icon = <XCircle size={20} color="#EF4444" fill="#EF444433" />;
                            }
                        } else if (selected) {
                            // Selected but not submitted - Use Brand Color
                            bubbleBg = ""; // Handled by inline style
                            bubbleText = "text-white";
                            optionText = "text-slate-900";
                        }

                        return (
                            <TouchableOpacity
                                key={index}
                                activeOpacity={0.8}
                                onPress={() => toggleSelection(index)}
                                className={clsx(
                                    "flex-row items-center p-5 border-2 rounded-[24px] shadow-sm",
                                    borderColor,
                                    bgColor,
                                    shadowColor
                                )}
                                style={(!isSubmitted && selected) ? {
                                    borderColor: brandColor,
                                    backgroundColor: `${brandColor}08`
                                } : {}}
                            >
                                <View
                                    className={clsx(
                                        "w-10 h-10 rounded-2xl items-center justify-center mr-4",
                                        bubbleBg
                                    )}
                                    style={(!isSubmitted && selected) ? { backgroundColor: brandColor } : {}}
                                >
                                    <Text className={clsx("font-black text-lg", bubbleText)}>
                                        {index + 1}
                                    </Text>
                                </View>
                                <Text
                                    style={{ fontSize: currentSizes.opt }}
                                    className={clsx("flex-1 font-bold", optionText)}
                                >
                                    {option}
                                </Text>
                                {icon && <View className="ml-2">{icon}</View>}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Explanation Area (Visible after submit) */}
                {isSubmitted && (
                    <View className="bg-slate-50 p-8 rounded-[32px] mb-10 border border-slate-100 border-dashed">
                        <View className="flex-row items-center gap-2 mb-6">
                            <View className="w-8 h-8 bg-white rounded-full items-center justify-center shadow-sm">
                                <Star size={16} color={brandColor} fill={brandColor} />
                            </View>
                            <View>
                                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Master Analysis</Text>
                                <Text className="font-black text-slate-900 text-lg">AI解説リサーチ</Text>
                            </View>
                        </View>

                        <RichText
                            text={question.explanation}
                            baseSize={currentSizes.exp}
                            className="text-slate-600"
                        />

                        <View className="mt-8 pt-8 border-t border-slate-200/50 flex-row items-center justify-between">
                            <Text className="text-[10px] font-bold text-slate-400 uppercase">Correct Answer Index</Text>
                            <View className="px-3 py-1 rounded-lg" style={{ backgroundColor: brandColor }}>
                                <Text className="text-white font-black text-xs">
                                    Option {question.correct_answers.map(i => i + 1).join(', ')}
                                </Text>
                            </View>
                        </View>
                    </View>
                )}

            </ScrollView>

            {/* Footer Action Button */}
            <View className="absolute bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-slate-100">
                {!isSubmitted ? (
                    <TouchableOpacity
                        onPress={submitAnswer}
                        disabled={selectedIndices.length !== question.correct_answers.length}
                        activeOpacity={0.9}
                        style={{ borderRadius: 24, overflow: 'hidden' }}
                    >
                        <View
                            className={clsx(
                                "w-full py-5 items-center justify-center flex-row gap-3",
                                selectedIndices.length !== question.correct_answers.length ? "bg-slate-200" : ""
                            )}
                            style={selectedIndices.length === question.correct_answers.length ? { backgroundColor: brandColor } : {}}
                        >
                            <View className="flex-col items-center">
                                <Text className="text-white font-black text-lg tracking-wider">
                                    {question.correct_answers.length > 1
                                        ? (selectedIndices.length === question.correct_answers.length ? "回答を確定する" : `${question.correct_answers.length}つ選んでください`)
                                        : "回答を確定する"}
                                </Text>
                                {selectedIndices.length !== question.correct_answers.length && (
                                    <View className="flex-row items-center gap-1">
                                        <Info size={8} color="#94a3b8" />
                                        <Text className="text-slate-400 text-[8px] font-bold uppercase tracking-[1px]">
                                            Selection: {selectedIndices.length} / {question.correct_answers.length}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            {selectedIndices.length === question.correct_answers.length && <ArrowRight size={20} color="white" strokeWidth={3} />}
                        </View>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        onPress={handleNextQuestion}
                        activeOpacity={0.9}
                        style={{ borderRadius: 24, overflow: 'hidden' }}
                    >
                        <View className="w-full bg-slate-900 py-5 items-center justify-center flex-row gap-3">
                            <View className="flex-col items-center">
                                <Text className="text-white font-black text-lg tracking-wider">次の問題へ進む</Text>
                                <Text className="text-slate-400 text-[9px] font-bold uppercase tracking-[2px]">Next Challenge</Text>
                            </View>
                            <ArrowRight size={20} color="white" strokeWidth={3} />
                        </View>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
}

const ArrowRight = ({ size, color, strokeWidth }: { size: number, color: string, strokeWidth?: number }) => (
    <View>
        <ChevronLeft size={size} color={color} style={{ transform: [{ rotate: '180deg' }] }} strokeWidth={strokeWidth} />
    </View>
);
