import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator, Text } from 'react-native';

export default function Index() {
    const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);

    useEffect(() => {
        const checkOnboarding = async () => {
            // Force onboarding for now to let user select license
            const val = await AsyncStorage.getItem('onboarding_completed_v2');
            setIsOnboarded(val === 'true');
        };
        checkOnboarding();
    }, []);

    if (isOnboarded === null) {
        return (
            <View className="flex-1 bg-white items-center justify-center">
                <View className="w-16 h-16 bg-orange-50 rounded-2xl items-center justify-center mb-4">
                    <ActivityIndicator size="small" color="#FF6B00" />
                </View>
                <Text className="text-slate-400 font-bold uppercase tracking-[3px] text-[10px]">Initializing</Text>
            </View>
        );
    }

    if (!isOnboarded) {
        return <Redirect href="/onboarding" />;
    }

    return <Redirect href="/(tabs)" />;
}
