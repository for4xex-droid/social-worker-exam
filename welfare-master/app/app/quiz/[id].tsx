import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, CheckCircle, XCircle, Type, Info, Star } from 'lucide-react-native';
import clsx from 'clsx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, saveDb } from '../../db/client';
import { questions, userProgress } from '../../db/schema';
import { eq, and, gt, asc, isNull, sql } from 'drizzle-orm';
import Constants from 'expo-constants';

interface QuestionData {
    id: string;
    text: string;
    options: string[];
    correct_answers: number[]; // Converted from string[] to indices
    explanation: string;
    year: string | null;
    group: string;
    categoryLabel: string | null;
}

/**
 * A simple component to render text with basic markdown-like support
 * Supports: **bold**, 【highlight】
 */
const RichText = ({ text, className, baseSize }: { text: string; className?: string; baseSize: number }) => {
    const brandColor = Constants.expoConfig?.extra?.brandColor || '#FF6B00';
    const parts = text.split(/(\*\*.*?\*\*|【.*?】)/);
    return (
        <View>
            <Text style={{ fontSize: baseSize, lineHeight: baseSize * 1.6, color: '#334155' }} className={clsx("leading-relaxed", className)}>
                {parts.map((part, i) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                        return (
                            <Text key={i} className="font-extrabold" style={{ color: '#0f172a' }}>
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
                    return <Text key={i} style={{ color: '#334155' }}>{part}</Text>;
                })}
            </Text>
        </View>
    );
};

export default function QuizPlayer() {
    const { id, mode } = useLocalSearchParams();
    const router = useRouter();

    const [question, setQuestion] = useState<QuestionData | null>(null);
    const [mockIndex, setMockIndex] = useState<number | null>(null); // For Mock Exam
    const [loading, setLoading] = useState(true);
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [textSizeMode, setTextSizeMode] = useState<number>(1); // 0: Small, 1: Normal, 2: Large, 3: XL
    const [correctCount, setCorrectCount] = useState(0);
    const [questionsAnswered, setQuestionsAnswered] = useState(0);
    const [qIndex, setQIndex] = useState<{ current: number; total: number } | null>(null);
    const [errorInfo, setErrorInfo] = useState<string>('');

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
                    const q = result[0] as any;
                    // Robust field access (camelCase or snake_case)
                    const rawCorrectAnswer = q.correctAnswer || q.correct_answer || [];
                    const rawOptions = q.options || [];
                    const rawText = q.questionText || q.question_text || "";
                    const rawExplanation = q.explanation || "";

                    let correctIndices: number[] = [];

                    // Strategy 1: Numeric Indices (Priority for our data format)
                    let cleanAnswers: string[] = [];

                    if (Array.isArray(rawCorrectAnswer)) {
                        cleanAnswers = rawCorrectAnswer.map((a: any) => String(a).trim());
                    } else if (typeof rawCorrectAnswer === 'string') {
                        // In case JSON mode failed
                        try {
                            const parsed = JSON.parse(rawCorrectAnswer);
                            if (Array.isArray(parsed)) {
                                cleanAnswers = parsed.map((a: any) => String(a).trim());
                            } else {
                                cleanAnswers = [String(parsed).trim()];
                            }
                        } catch (e) {
                            // Treat as raw string if not valid JSON
                            cleanAnswers = [rawCorrectAnswer.trim()];
                        }
                    }

                    const optionsArray = Array.isArray(rawOptions) ? rawOptions : (typeof rawOptions === 'string' ? JSON.parse(rawOptions) : []);

                    // Check if answers look like numbers
                    const isNumeric = cleanAnswers.every((a: string) => !isNaN(parseInt(a)));

                    if (isNumeric) {
                        correctIndices = cleanAnswers.map((a: string) => parseInt(a) - 1)
                            .filter((i: number) => i >= 0 && i < optionsArray.length);
                    }

                    // Strategy 2: Exact/Fuzzy Text Match (Fallback)
                    if (correctIndices.length === 0) {
                        const normalize = (s: string) => String(s).replace(/\s+/g, '').replace(/[。、]/g, '');

                        correctIndices = optionsArray.reduce<number[]>((acc: number[], opt: string, idx: number) => {
                            const normOpt = normalize(opt);
                            const isMatch = cleanAnswers.some(ans => normalize(ans) === normOpt);

                            if (isMatch) {
                                acc.push(idx);
                            }
                            return acc;
                        }, []);
                    }

                    // Fallback Safety
                    if (correctIndices.length === 0) {
                        // console.warn("Quiz data corrupted: No correct answer matched for ID " + q.id);
                        correctIndices = [0];
                    }

                    // Deduplicate
                    correctIndices = Array.from(new Set(correctIndices));

                    // NEW: Calculate Question Index
                    // NEW: Calculate Question Index
                    const getCounts = async () => {
                        try {
                            // Priority: Queue Index for Daily/Weakness
                            if (mode === 'daily' || mode === 'weakness') {
                                const queueJson = await AsyncStorage.getItem('@quiz_queue');
                                if (queueJson) {
                                    const queueIds = JSON.parse(queueJson);
                                    const idx = queueIds.indexOf(q.id);
                                    if (idx !== -1) {
                                        setQIndex({
                                            current: idx + 1,
                                            total: queueIds.length
                                        });
                                        return;
                                    }
                                }
                            }

                            let whereClause;
                            if (q.year) {
                                whereClause = eq(questions.year, q.year);
                            } else if (q.categoryLabel && q.categoryLabel !== '未分類') {
                                whereClause = and(eq(questions.group, q.group), eq(questions.categoryLabel, q.categoryLabel));
                            } else {
                                whereClause = eq(questions.group, q.group);
                            }

                            const totalRes = await db.select({ count: sql`count(*)` }).from(questions).where(whereClause);
                            const prevRes = await db.select({ count: sql`count(*)` }).from(questions).where(and(whereClause, sql`${questions.id} < ${q.id}`));

                            setQIndex({
                                total: Number(totalRes[0].count),
                                current: Number(prevRes[0].count) + 1
                            });
                        } catch (err) { console.log("Index count error", err); }
                    };
                    getCounts();

                    setQuestion({
                        id: q.id,
                        text: rawText,
                        options: optionsArray,
                        correct_answers: correctIndices,
                        explanation: rawExplanation,
                        year: q.year,
                        group: q.group || (q as any).group_id || 'unknown',
                        categoryLabel: q.categoryLabel || (q as any).category_label
                    });
                } else {
                    setErrorInfo("No result found for ID: " + id);
                }
            } catch (e: any) {
                console.error("Failed to load question", e);
                setErrorInfo(e.toString() + " / " + JSON.stringify(e));
            } finally {
                setLoading(false);
            }
        };
        loadQuestion();
    }, [id]);

    // Mock Exam: Sync Index
    useEffect(() => {
        if (mode === 'mock') {
            AsyncStorage.getItem('mock_exam_session').then(s => {
                if (s) {
                    const sess = JSON.parse(s);
                    setMockIndex(sess.currentIndex);
                }
            });
        }
    }, [id, mode]);

    // Save Resume Point
    useEffect(() => {
        if (!question) return;
        const saveResumePoint = async () => {
            try {
                // Create a unique key for this book/category
                let key = question.year
                    ? `resume_cursor_${question.group}_${question.year}_v2`
                    : `resume_cursor_${question.group}_${question.categoryLabel || 'all'}_v2`;

                // HOTFIX for R6 consistency
                if (question.year && question.year.includes('令和6')) {
                    key = 'resume_cursor_social_R6_v3';
                }

                console.log(`[Quiz] Saving resume point: Key=${key}, ID=${question.id}`);
                await AsyncStorage.setItem(key, question.id);
            } catch (e) {
                console.error("Failed to save resume point", e);
            }
        };
        saveResumePoint();
    }, [question]);

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
        if (correct) {
            setCorrectCount(prev => prev + 1);
            // Persistent Score for Session
            try {
                const currentScore = await AsyncStorage.getItem('@quiz_session_correct_count');
                const newScore = (parseInt(currentScore || '0') + 1).toString();
                await AsyncStorage.setItem('@quiz_session_correct_count', newScore);
            } catch (e) {
                console.error("Failed to save session score", e);
            }
        }
        setQuestionsAnswered(prev => prev + 1);

        try {
            await db.insert(userProgress).values({
                questionId: question.id,
                isCorrect: correct,
                timestamp: new Date()
            });

            if (correct) {
                await db.update(questions)
                    .set({ isMastered: true, correctStreak: 1 })
                    .where(eq(questions.id, question.id));
            }
            await saveDb();
        } catch (e) {
            console.error("Failed to save progress", e);
        }
    };

    const handleNextQuestion = async () => {
        if (!question) {
            router.back();
            return;
        }

        // --- Mock Exam Logic ---
        if (mode === 'mock') {
            try {
                const sessionStr = await AsyncStorage.getItem('mock_exam_session');
                if (sessionStr) {
                    const session = JSON.parse(sessionStr);

                    // Re-verify correctness
                    const correctSet = new Set(question.correct_answers);
                    const selectedSet = new Set(selectedIndices);
                    const isCorrect = correctSet.size === selectedSet.size &&
                        [...correctSet].every(x => selectedSet.has(x));

                    session.results[session.currentIndex] = isCorrect;
                    session.currentIndex += 1; // Move to next

                    await AsyncStorage.setItem('mock_exam_session', JSON.stringify(session));

                    // Check finish
                    if (session.currentIndex >= session.queue.length) {
                        router.replace('/mock-result');
                    } else {
                        const nextId = session.queue[session.currentIndex];
                        router.replace(`/quiz/${nextId}?mode=mock`);
                    }
                    return;
                }
            } catch (e) {
                console.error("Mock next error", e);
            }
        }
        // -----------------------

        try {
            // New Queue Logic
            if (mode === 'daily' || mode === 'weakness') {
                const queueJson = await AsyncStorage.getItem('@quiz_queue');
                if (queueJson) {
                    const queueIds: string[] = JSON.parse(queueJson);
                    const currentIndex = queueIds.indexOf(question.id);
                    if (currentIndex !== -1 && currentIndex < queueIds.length - 1) {
                        router.replace(`/quiz/${queueIds[currentIndex + 1]}?mode=${mode}`);
                        return;
                    } else {
                        const scoreStr = await AsyncStorage.getItem('@quiz_session_correct_count');
                        router.replace({ pathname: '/quiz/result', params: { total: queueIds.length, correct: parseInt(scoreStr || '0'), year: mode === 'daily' ? "今日のミッション" : "苦手克服" } });
                        return;
                    }
                }
            }

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
                // If categorized prediction, stay in same category
                const isCategorizedPrediction = !question.year && question.group && question.categoryLabel && question.categoryLabel !== '未分類';

                if (isCategorizedPrediction) {
                    nextQ = await db.select()
                        .from(questions)
                        .where(and(
                            eq(questions.group, question.group),
                            eq(questions.categoryLabel, question.categoryLabel as string),
                            gt(questions.id, question.id)
                        ))
                        .orderBy(asc(questions.id))
                        .limit(1);
                } else {
                    // Robust: Use year-based query if group might be undefined
                    const groupValue = question.group || 'unknown';
                    console.log(`[handleNextQuestion] group=${question.group}, year=${question.year}, id=${question.id}`);

                    // If group is unknown but year exists, query by year only
                    if (groupValue === 'unknown' && question.year) {
                        console.log(`[handleNextQuestion] Using year-only query for R6 workaround`);
                        nextQ = await db.select()
                            .from(questions)
                            .where(and(
                                eq(questions.year, question.year),
                                gt(questions.id, question.id)
                            ))
                            .orderBy(asc(questions.id))
                            .limit(1);
                    } else {
                        nextQ = await db.select()
                            .from(questions)
                            .where(and(
                                question.year ? eq(questions.year, question.year) : isNull(questions.year),
                                eq(questions.group, groupValue),
                                gt(questions.id, question.id)
                            ))
                            .orderBy(asc(questions.id))
                            .limit(1);
                    }
                }
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
            // FALLBACK: Calculate next ID directly from current ID pattern (e.g., ss37_001 -> ss37_002)
            const match = question.id.match(/^(.+_)(\d+)$/);
            if (match) {
                const prefix = match[1]; // e.g., "ss37_"
                const num = parseInt(match[2], 10); // e.g., 1
                const nextNum = num + 1;
                const nextId = prefix + String(nextNum).padStart(match[2].length, '0'); // e.g., "ss37_002"
                router.replace(`/quiz/${nextId}`);
            } else {
                router.back();
            }
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
                <Text className="mt-4 text-slate-400 font-bold text-xs">データ読み込み中...</Text>
            </SafeAreaView>
        );
    }

    if (!question) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
                <Text className="text-slate-500 font-bold mb-6 text-base">問題データが見つかりませんでした。</Text>
                <TouchableOpacity onPress={() => router.back()} className="w-full py-4 bg-slate-900 rounded-2xl items-center shadow-md shadow-slate-200">
                    <Text className="text-white font-bold text-base">戻る</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white">
            {/* Header */}
            <View className="flex-row items-center justify-between p-4 bg-white/80 backdrop-blur-xl sticky top-0 z-10 border-b border-slate-50">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 bg-slate-50 rounded-full items-center justify-center border border-slate-100"
                >
                    <ChevronLeft size={24} color="#64748b" />
                </TouchableOpacity>

                <View className="items-center">
                    {mode === 'mock' && mockIndex !== null ? (
                        <>
                            <Text className="text-[10px] font-bold text-emerald-500 mb-0.5">全国統一模擬試験</Text>
                            <Text className="text-lg font-black text-emerald-700 leading-6">
                                {mockIndex + 1} / 150
                            </Text>
                        </>
                    ) : (
                        <>
                            <Text className="text-[10px] font-bold text-slate-400 mb-0.5">現在の問題</Text>
                            <View className="flex-row items-center gap-2">
                                <Text className="text-lg font-black text-slate-900 leading-6">
                                    {qIndex ? `No.${qIndex.current} / ${qIndex.total}` : `No.${question ? question.id.split('_').pop() : '--'}`}
                                </Text>
                            </View>
                        </>
                    )}
                </View>

                <TouchableOpacity
                    onPress={cycleTextSize}
                    className={clsx(
                        "w-10 h-10 rounded-full items-center justify-center border",
                        textSizeMode === 2 ? "bg-slate-900 border-slate-900" : "bg-white border-slate-200"
                    )}
                >
                    <Type size={20} color={textSizeMode === 2 ? "#fff" : "#64748b"} />
                    {textSizeMode > 0 && (
                        <View className="absolute -top-1 -right-1 bg-orange-500 rounded-full w-4 h-4 items-center justify-center border border-white">
                            <Text className="text-[8px] text-white font-bold">{textSizeMode === 1 ? 'M' : 'L'}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 120 }}>

                {/* Question Info Chip */}
                <View className="flex-row mb-5">
                    <View className="bg-slate-50 px-3 py-1.5 rounded-lg flex-row items-center border border-slate-100">
                        <Info size={12} color="#94a3b8" />
                        <Text className="text-slate-500 text-xs font-bold ml-1.5">
                            {isReviewMode ? "復習モード"
                                : question.year ? question.year
                                    : question.categoryLabel ? question.categoryLabel
                                        : question.group === 'common_social' ? '共通科目'
                                            : question.group === 'spec_social' ? '専門科目'
                                                : "模擬試験・練習問題"}
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
                <View className="gap-3 mb-10">
                    {question.options.map((option, index) => {
                        const selected = isSelected(index);
                        const correct = isCorrect(index);

                        let borderColor = "border-slate-100/80";
                        let bgColor = "bg-white";
                        let shadowColor = "shadow-slate-100";
                        let bubbleBg = "bg-slate-50";
                        let bubbleText = "text-slate-400";
                        let optionText = "text-slate-600";
                        let icon = null;

                        if (isSubmitted) {
                            if (correct) {
                                // Correct answer - Always Green
                                borderColor = "border-emerald-500";
                                bgColor = "bg-emerald-50";
                                shadowColor = "shadow-emerald-100";
                                bubbleBg = "bg-emerald-500";
                                bubbleText = "text-white";
                                optionText = "text-emerald-900";
                                if (selected) {
                                    icon = <CheckCircle size={24} color="#10B981" fill="#10B98120" />;
                                }
                            } else if (selected && !correct) {
                                // User selected wrong - Always Red
                                borderColor = "border-red-500";
                                bgColor = "bg-red-50";
                                shadowColor = "shadow-red-100";
                                bubbleBg = "bg-red-500";
                                bubbleText = "text-white";
                                optionText = "text-red-900";
                                icon = <XCircle size={24} color="#EF4444" fill="#EF444420" />;
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
                                    "flex-row items-center p-5 border-2 rounded-2xl shadow-sm",
                                    borderColor,
                                    bgColor,
                                    shadowColor
                                )}
                                style={(!isSubmitted && selected) ? {
                                    borderColor: brandColor,
                                    backgroundColor: `${brandColor}06`
                                } : {}}
                            >
                                <View
                                    className={clsx(
                                        "w-9 h-9 rounded-[10px] items-center justify-center mr-4",
                                        bubbleBg
                                    )}
                                    style={(!isSubmitted && selected) ? { backgroundColor: brandColor } : {}}
                                >
                                    <Text className={clsx("font-bold text-base", bubbleText)}>
                                        {index + 1}
                                    </Text>
                                </View>
                                <Text
                                    style={{ fontSize: currentSizes.opt }}
                                    className={clsx("flex-1 font-bold leading-relaxed", optionText)}
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
                    <View className="bg-slate-50 p-6 rounded-3xl mb-8 border border-dashed border-slate-200">
                        <View className="flex-row items-center gap-2 mb-4">
                            <View className="w-8 h-8 bg-white rounded-full items-center justify-center border border-slate-100 shadow-sm">
                                <Star size={14} color={brandColor} fill={brandColor} />
                            </View>
                            <View>
                                <Text className="font-black text-slate-800 text-base">AIによる解説</Text>
                            </View>
                        </View>

                        <RichText
                            text={question.explanation
                                ? question.explanation
                                    .trim()
                                : `解説データがありません。`
                            }
                            baseSize={currentSizes.exp}
                            className="text-slate-600 leading-7"
                        />

                        <View className="mt-6 pt-6 border-t border-slate-200 flex-row items-center justify-between">
                            <Text className="text-xs font-bold text-slate-400">正解の選択肢</Text>
                            <View className="px-4 py-1.5 rounded-full" style={{ backgroundColor: brandColor }}>
                                <Text className="text-white font-bold text-sm">
                                    {question.correct_answers.map(i => i + 1).join(', ')}
                                </Text>
                            </View>
                        </View>
                    </View>
                )}

            </ScrollView>

            {/* Footer Action Button */}
            <View className="absolute bottom-0 left-0 right-0 p-5 bg-white/95 backdrop-blur-md border-t border-slate-100 pb-8">
                {!isSubmitted ? (
                    <TouchableOpacity
                        onPress={submitAnswer}
                        disabled={selectedIndices.length !== question.correct_answers.length}
                        activeOpacity={0.9}
                        className="w-full"
                    >
                        <View
                            className={clsx(
                                "w-full py-4 items-center justify-center rounded-2xl",
                                selectedIndices.length !== question.correct_answers.length ? "bg-slate-100" : ""
                            )}
                            style={selectedIndices.length === question.correct_answers.length ? { backgroundColor: brandColor } : {}}
                        >
                            <Text
                                className={clsx("font-bold text-base tracking-wide text-center", selectedIndices.length !== question.correct_answers.length ? "text-slate-400" : "text-white")}
                            >
                                {question.correct_answers.length > 1
                                    ? (selectedIndices.length === question.correct_answers.length ? "回答を確定する" : `あと ${question.correct_answers.length - selectedIndices.length} つ選択`)
                                    : "回答を確定する"}
                            </Text>
                        </View>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        onPress={handleNextQuestion}
                        activeOpacity={0.9}
                        className="w-full"
                    >
                        <View className="w-full bg-slate-800 py-4 items-center justify-center rounded-2xl">
                            <Text className="text-white font-bold text-base tracking-wide text-center">次の問題へ</Text>
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
