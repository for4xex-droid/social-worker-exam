
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Stack, useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, BookOpen, CheckCircle } from 'lucide-react-native';
import { useState, useCallback } from 'react';
import { db } from '../../db/client';
import { memorizationCards } from '../../db/schema';
import { sql } from 'drizzle-orm';

const CARDS_PER_VOL = 30;

export default function VolumeSelectScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const mode = params.mode || 'new'; // 'new' or 'weak' or 'all'

    interface VolStats {
        vol: number;
        total: number;
        mastered: number;
        unseen: number; // Not reviewed yet
        weak: number;   // Reviewed but low proficiency
    }

    const [volumes, setVolumes] = useState<VolStats[]>([]);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            const loadStats = async () => {
                if (!db) return;
                try {
                    // Get all cards with their status
                    const allCards = await db.select().from(memorizationCards);

                    // Group by volumes
                    const vols: VolStats[] = [];
                    const totalVols = Math.floor(allCards.length / CARDS_PER_VOL);
                    // 369 / 30 = 12 remainder 9. So 12 volumes. 11 have 30, last has 39.

                    for (let i = 0; i < totalVols; i++) {
                        const start = i * CARDS_PER_VOL;
                        let end = start + CARDS_PER_VOL;

                        // If this is the last volume (i === totalVols - 1), take everything until the end
                        if (i === totalVols - 1) {
                            end = allCards.length;
                        }

                        const chunk = allCards.slice(start, end);

                        const total = chunk.length;
                        const mastered = chunk.filter((c: any) => c.isMastered).length;
                        const unseen = chunk.filter((c: any) => !c.lastReviewed).length;
                        const weak = chunk.filter((c: any) => c.lastReviewed && !c.isMastered && (c.proficiency || 0) < 3).length;

                        vols.push({
                            vol: i + 1,
                            total,
                            mastered,
                            unseen,
                            weak
                        });
                    }
                    setVolumes(vols);

                } catch (e) {
                    console.error(e);
                } finally {
                    setLoading(false);
                }
            };

            // 少し遅延させてDB更新の完了を待つ (オプション)
            loadStats();
        }, [])
    );

    const getModeTitle = () => {
        if (mode === 'weak') return '苦手克服：単語帳選択';
        if (mode === 'new') return '新規未学習：単語帳選択';
        return '単語帳選択';
    };

    const getStatusText = (vol: VolStats) => {
        if (mode === 'new') {
            return `未学習: ${vol.unseen} / ${vol.total} 問`;
        }
        if (mode === 'weak') {
            return `要復習: ${vol.weak} 問`;
        }
        return `マスター: ${vol.mastered} / ${vol.total} 問`;
    };

    const isVolDisabled = (vol: VolStats) => {
        if (mode === 'new' && vol.unseen === 0) return true;
        if (mode === 'weak' && vol.weak === 0) return true;
        return false;
    };

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="flex-row items-center justify-center px-5 py-4 bg-white border-b border-slate-100 mb-4 relative">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="absolute left-5 p-2 rounded-full active:bg-slate-100 z-10"
                    >
                        <ArrowLeft size={24} color="#64748B" />
                    </TouchableOpacity>
                    <Text className="text-lg font-bold text-slate-800">{getModeTitle()}</Text>
                </View>

                <ScrollView className="px-5">
                    <Text className="text-slate-500 mb-4 text-sm">
                        学習したい単語帳セットを選んでください。
                        {mode === 'new' && '「未学習」の問題が含まれるセットが表示されます。'}
                        {mode === 'weak' && '「苦手」な問題が含まれるセットが表示されます。'}
                    </Text>

                    <View className="pb-10 gap-3">
                        {volumes.map((v) => {
                            const disabled = isVolDisabled(v);
                            return (
                                <TouchableOpacity
                                    key={v.vol}
                                    disabled={disabled}
                                    onPress={() => {
                                        // Pass the volume AND the mode.
                                        // Player needs to kow: "Load Vol X" AND "Filter by Mode".
                                        router.push({
                                            pathname: '/flashcards/player',
                                            params: {
                                                mode: 'set', // Player uses 'set' logic for slicing
                                                vol: v.vol,
                                                limit: v.total, // Pass the actual size of this volume (e.g. 39 for the last one)
                                                filter: mode // 'new' or 'weak' (extra param we need to handle in player)
                                            }
                                        });
                                    }}
                                    className={`p-4 rounded-xl border flex-row items-center justify-between ${disabled
                                        ? 'bg-slate-100 border-slate-200 opacity-60'
                                        : 'bg-white border-slate-200 shadow-sm active:bg-amber-50 active:border-amber-200'
                                        }`}
                                >
                                    <View className="flex-row items-center gap-4">
                                        <View className={`w-12 h-12 rounded-full items-center justify-center ${v.mastered === v.total ? 'bg-green-100' : 'bg-amber-100'
                                            }`}>
                                            {v.mastered === v.total ? (
                                                <CheckCircle size={24} color="#16A34A" />
                                            ) : (
                                                <Text className="text-amber-700 font-black text-lg">{v.vol}</Text>
                                            )}
                                        </View>
                                        <View>
                                            <Text className={`font-bold text-lg ${disabled ? 'text-slate-400' : 'text-slate-700'}`}>
                                                単語帳 Vol.{v.vol}
                                            </Text>
                                            <Text className="text-slate-400 text-xs mt-0.5">
                                                {getStatusText(v)}
                                            </Text>
                                        </View>
                                    </View>

                                    {!disabled && (
                                        <View className="bg-amber-50 px-3 py-1.5 rounded-full">
                                            <Text className="text-amber-600 font-bold text-xs">学習する</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
