import "./global.css";
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { initializeDb } from '../db/client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function Layout() {
    const [isInitReady, setInitReady] = useState(false);

    useEffect(() => {
        const init = async () => {
            console.log("[Layout] Starting initialization...");

            // Allow UI to paint first
            await new Promise(r => setTimeout(r, 100));

            try {
                // Restore DB init with safety check
                console.log("[Layout] Calling initializeDb...");
                await initializeDb();
                console.log("[Layout] initializeDb completed.");
            } catch (e) {
                console.error("[Layout] Initialization error:", e);
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
                <Text style={{ marginTop: 20 }}>INITIALIZING APP...</Text>
            </View>
        );
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(tabs)" />
            </Stack>
        </GestureHandlerRootView>
    );
}
