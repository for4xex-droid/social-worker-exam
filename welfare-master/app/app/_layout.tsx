import "./global.css";
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { initializeDb } from '../db/client';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- TEST SETTINGS ---
// テスト運用中にオンボーディングをスキップしたい場合はここを 'false' に設定してください
const SHOW_ONBOARDING_FLOW = true;
// ---------------------

export default function Layout() {
    const [isInitReady, setInitReady] = useState(false);
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        const init = async () => {
            try {
                // 1. Initialize Database
                await initializeDb();

                // 2. Check Onboarding Status
                if (SHOW_ONBOARDING_FLOW) {
                    const completed = await AsyncStorage.getItem('onboarding_completed');
                    const inOnboarding = segments[0] === 'onboarding';

                    if (!completed && !inOnboarding) {
                        // Not completed and not already there, redirect
                        router.replace('/onboarding');
                    }
                }
            } catch (e) {
                console.error("Initialization error:", e);
            } finally {
                setInitReady(true);
            }
        };
        init();
    }, [segments]);

    if (!isInitReady) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
                <ActivityIndicator size="large" color="#FF6B00" />
            </View>
        );
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="purchase" />
            <Stack.Screen name="quiz/[id]" options={{ presentation: 'fullScreenModal' }} />
        </Stack>
    );
}
