import "./global.css";
import React, { useEffect } from 'react';
import { Stack, Slot } from 'expo-router';
import { View, Platform, Dimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// @ts-ignore
import { initializeDb } from '../db/client';

export default function Layout() {
    useEffect(() => {
        // Initialize DB on mount
        initializeDb()
            .then(() => console.log("DB Initialized"))
            .catch((e: any) => console.error("DB Failed", e));
    }, []);

    // Web-specific layout container: Ensure min-height to prevent collapse
    if (Platform.OS === 'web') {
        return (
            <View style={{
                // @ts-ignore
                minHeight: '100vh' as any,
                width: '100%',
                backgroundColor: '#e2e8f0',
                alignItems: 'center'
            }}>
                <View style={{
                    flex: 1,
                    width: '100%',
                    maxWidth: 480,
                    backgroundColor: '#ffffff',
                    // @ts-ignore
                    minHeight: '100vh' as any,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 12,
                    elevation: 5,
                }}>
                    <Slot />
                </View>
            </View>
        );
    }

    // Native layout
    return (
        <SafeAreaProvider>
            <View style={{ flex: 1 }}>
                <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="analytics" options={{ headerShown: false }} />
                </Stack>
            </View>
        </SafeAreaProvider>
    );
}
