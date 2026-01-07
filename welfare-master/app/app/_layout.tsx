import "./global.css";
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { initializeDb } from '../db/client';

export default function Layout() {
    const [isInitReady, setInitReady] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                // Now safe to call because it's guarded internally
                await initializeDb();
            } catch (e) {
                console.error("Initialization error:", e);
            } finally {
                setInitReady(true);
            }
        };
        init();
    }, []);

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
            <Stack.Screen name="(tabs)" />
        </Stack>
    );
}
