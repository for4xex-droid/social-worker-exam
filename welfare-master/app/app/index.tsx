import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
    const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);

    useEffect(() => {
        checkOnboarding();
    }, []);

    const checkOnboarding = async () => {
        try {
            const valueV2 = await AsyncStorage.getItem('onboarding_completed_v2');
            if (valueV2 === 'true') {
                setIsFirstLaunch(false);
                return;
            }
            setIsFirstLaunch(true);
        } catch (e) {
            console.error(e);
            setIsFirstLaunch(false);
        }
    };

    if (isFirstLaunch === null) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#F97316" />
            </View>
        );
    }

    if (isFirstLaunch) {
        return <Redirect href="/onboarding" />;
    }

    return <Redirect href="/(tabs)" />;
}
