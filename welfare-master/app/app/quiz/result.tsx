import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trophy, Home, RotateCcw, Award } from 'lucide-react-native';
import clsx from 'clsx';
import { useEffect, useState } from 'react';

export default function QuizResult() {
    const router = useRouter();
    const params = useLocalSearchParams();

    // Parse params (they come as strings)
    const total = Number(params.total || 0);
    const correct = Number(params.correct || 0);
    const year = params.year as string;

    const percentage = total > 0 ? (correct / total) * 100 : 0;

    let title = "Completed!";
    let message = "Good effort, keep going!";
    let badgeColor = "text-gray-600";
    let badgeIcon = <Award size={80} color="#4B5563" />;

    if (percentage === 100) {
        title = "PERFECT!";
        message = "You are a master of this section.";
        badgeColor = "text-yellow-500";
        badgeIcon = <Trophy size={80} color="#EAB308" />;
    } else if (percentage >= 80) {
        title = "EXCELLENT";
        message = "Great job, you're almost there.";
        badgeColor = "text-blue-500";
        badgeIcon = <Award size={80} color="#3B82F6" />;
    } else if (percentage >= 60) {
        title = "GOOD";
        message = "Solid progress, review the mistakes.";
        badgeColor = "text-green-500";
        badgeIcon = <Award size={80} color="#22C55E" />;
    }

    return (
        <SafeAreaView className="flex-1 bg-white items-center p-6">

            <View className="flex-1 w-full items-center justify-center">
                <View className="mb-8 items-center">
                    <View className="mb-4">
                        {badgeIcon}
                    </View>
                    <Text className={clsx("text-4xl font-black italic tracking-tighter", badgeColor)}>
                        {title}
                    </Text>
                    <Text className="text-gray-400 font-medium mt-2 text-center px-8">
                        {message}
                    </Text>
                </View>

                <View className="w-full bg-slate-50 rounded-3xl p-8 items-center mb-8 border border-slate-100">
                    <Text className="text-gray-500 text-sm font-bold tracking-widest uppercase mb-2">SCORE</Text>
                    <View className="flex-row items-baseline">
                        <Text className="text-6xl font-black text-slate-800">{Math.round(percentage)}</Text>
                        <Text className="text-2xl font-bold text-slate-400 ml-1">%</Text>
                    </View>
                    <View className="flex-row gap-6 mt-4">
                        <View className="items-center">
                            <Text className="text-2xl font-bold text-green-600">{correct}</Text>
                            <Text className="text-xs text-gray-400">Correct</Text>
                        </View>
                        <View className="w-[1px] bg-gray-300 h-8" />
                        <View className="items-center">
                            <Text className="text-2xl font-bold text-gray-800">{total}</Text>
                            <Text className="text-xs text-gray-400">Total</Text>
                        </View>
                    </View>
                </View>

                <View className="flex-row gap-4 w-full">
                    <TouchableOpacity
                        onPress={() => router.replace('/')} // TODO: Navigate to Home properly
                        className="flex-1 bg-gray-100 py-4 rounded-xl items-center flex-row justify-center gap-2"
                    >
                        <Home size={20} color="#374151" />
                        <Text className="font-bold text-gray-700">Home</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.back()} // Ideally restart quiz
                        className="flex-1 bg-primary py-4 rounded-xl items-center flex-row justify-center gap-2"
                    >
                        <RotateCcw size={20} color="#FFFFFF" />
                        <Text className="font-bold text-white">Retry</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}
