import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, CheckCircle, XCircle, Type } from 'lucide-react-native';
import clsx from 'clsx';
import { db } from '../../db/client';
import { questions, userProgress } from '../../db/schema';
import { eq, and, gt, asc } from 'drizzle-orm';

interface QuestionData {
    id: string;
    text: string;
    options: string[];
    correct_answers: number[]; // Converted from string[] to indices
    explanation: string;
    year: string | null;
}

export default function QuizPlayer() {
    const { id, mode } = useLocalSearchParams();
    const router = useRouter();

    const [question, setQuestion] = useState<QuestionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [textSize, setTextSize] = useState<'normal' | 'large'>('normal');
    const [correctCount, setCorrectCount] = useState(0);
    const [questionsAnswered, setQuestionsAnswered] = useState(0);

    const isReviewMode = mode === 'review';

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
                    const correctIndices = q.options.reduce<number[]>((acc, opt, idx) => {
                        if (q.correctAnswer.includes(opt)) {
                            acc.push(idx);
                        }
                        return acc;
                    }, []);

                    setQuestion({
                        id: q.id,
                        text: q.questionText,
                        options: q.options,
                        correct_answers: correctIndices,
                        explanation: q.explanation,
                        year: q.year
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
                // Find next NON-MASTERED question with ID > current ID (across all years or same year? Let's say globally for quest)
                // Actually simple approach: just any next question that is not mastered.
                nextQ = await db.select()
                    .from(questions)
                    .where(and(
                        eq(questions.isMastered, false),
                        gt(questions.id, question.id)
                    ))
                    .orderBy(asc(questions.id))
                    .limit(1);
            } else {
                // Default: Next in same year
                nextQ = await db.select()
                    .from(questions)
                    .where(and(
                        eq(questions.year, question.year),
                        gt(questions.id, question.id)
                    ))
                    .orderBy(asc(questions.id))
                    .limit(1);
            }

            if (nextQ.length > 0) {
                const nextId = nextQ[0].id;
                // Preserve mode param
                if (isReviewMode) {
                    router.replace(`/quiz/${nextId}?mode=review`);
                } else {
                    router.replace(`/quiz/${nextId}`);
                }
            } else {
                // End of session
                router.replace({
                    pathname: '/quiz/result',
                    params: {
                        total: questionsAnswered, // Simple session tracking
                        correct: correctCount,
                        year: isReviewMode ? "Weakness Review" : question.year
                    }
                });
            }
        } catch (e) {
            console.error("Error finding next question", e);
            router.back();
        }
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#2563EB" />
                <Text className="mt-4 text-gray-500">Loading Question...</Text>
            </SafeAreaView>
        );
    }

    if (!question) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <Text className="text-gray-500">Question not found.</Text>
                <TouchableOpacity onPress={() => router.back()} className="mt-4 p-4 bg-primary rounded-xl">
                    <Text className="text-white font-bold">Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // Dynamic styles based on text settings
    const baseTextSize = textSize === 'large' ? 'text-xl' : 'text-base';
    const explanationTextSize = textSize === 'large' ? 'text-lg' : 'text-sm';

    return (
        <SafeAreaView className="flex-1 bg-white">
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
                <TouchableOpacity onPress={() => router.back()} className="p-2">
                    <ChevronLeft size={24} color="#374151" />
                </TouchableOpacity>
                <Text className="font-bold text-gray-800">問題 {id}</Text>
                <TouchableOpacity onPress={() => setTextSize(prev => prev === 'normal' ? 'large' : 'normal')} className="p-2 bg-gray-100 rounded-full">
                    <Type size={20} color="#374151" />
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>

                {/* Question Text */}
                <View className="mb-8">
                    <Text className={clsx("font-medium text-gray-900 leading-8", baseTextSize)}>
                        {question.text}
                    </Text>
                </View>

                {/* Options List */}
                <View className="gap-3 mb-8">
                    {question.options.map((option, index) => {
                        let borderColor = "border-gray-200";
                        let bgColor = "bg-white";
                        let icon = null;

                        if (isSubmitted) {
                            if (isCorrect(index)) {
                                borderColor = "border-green-500";
                                bgColor = "bg-green-50";
                                icon = <CheckCircle size={20} color="#10B981" />;
                            } else if (isSelected(index) && !isCorrect(index)) {
                                borderColor = "border-red-500";
                                bgColor = "bg-red-50";
                                icon = <XCircle size={20} color="#EF4444" />;
                            }
                        } else if (isSelected(index)) {
                            borderColor = "border-primary";
                            bgColor = "bg-blue-50";
                        }

                        return (
                            <TouchableOpacity
                                key={index}
                                activeOpacity={0.8}
                                onPress={() => toggleSelection(index)}
                                className={clsx(
                                    "flex-row items-center p-4 border-2 rounded-xl",
                                    borderColor,
                                    bgColor
                                )}
                            >
                                <View className={clsx(
                                    "w-8 h-8 rounded-full border items-center justify-center mr-3",
                                    isSelected(index) || (isSubmitted && isCorrect(index)) ? "bg-primary border-primary" : "border-gray-300 bg-white"
                                )}>
                                    <Text className={clsx(
                                        "font-bold",
                                        isSelected(index) || (isSubmitted && isCorrect(index)) ? "text-white" : "text-gray-500"
                                    )}>
                                        {index + 1}
                                    </Text>
                                </View>
                                <Text className={clsx("flex-1 text-gray-800 font-medium", textSize === 'large' ? 'text-lg' : 'text-sm')}>
                                    {option}
                                </Text>
                                {icon && <View className="ml-2">{icon}</View>}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Explanation Area (Visible after submit) */}
                {isSubmitted && (
                    <View className="bg-slate-50 p-6 rounded-2xl mb-8 border border-slate-100">
                        <View className="flex-row items-center gap-2 mb-3">
                            <View className="h-6 w-1 bg-primary rounded-full" />
                            <Text className="font-bold text-slate-800">AI解説</Text>
                        </View>
                        <Text className={clsx("text-slate-600 leading-7", explanationTextSize)}>
                            {question.explanation}
                        </Text>
                    </View>
                )}

            </ScrollView>

            {/* Footer Action Button */}
            <View className="p-4 border-t border-gray-100 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                {!isSubmitted ? (
                    <TouchableOpacity
                        onPress={submitAnswer}
                        disabled={selectedIndices.length === 0}
                        className={clsx(
                            "w-full py-4 rounded-xl items-center shadow-sm",
                            selectedIndices.length > 0 ? "bg-primary" : "bg-gray-300"
                        )}
                    >
                        <Text className="text-white font-bold text-lg tracking-wider">回答する</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        onPress={handleNextQuestion}
                        className="w-full bg-slate-800 py-4 rounded-xl items-center shadow-md"
                    >
                        <Text className="text-white font-bold text-lg tracking-wider">次の問題へ</Text>
                        <Text className="text-slate-400 text-xs mt-1">Next Question</Text>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
}
