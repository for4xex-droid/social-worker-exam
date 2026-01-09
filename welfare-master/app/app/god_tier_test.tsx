import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Canvas, Circle, BackdropFilter, Blur, Fill } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { styled } from 'nativewind';

// NativeWindでスタイリングされたボタン
const StyledButton = styled(TouchableOpacity);

export default function GodTierTest() {
    const handlePress = () => {
        // 軽い振動を与える（iPhone/Android両対応）
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        console.log('Button Pressed with Haptics!');
    };

    return (
        <View className="flex-1 bg-black justify-center items-center">
            {/* 1. Skia: 背景にぼんやり光る円を描画 */}
            <View style={{ position: 'absolute', width: '100%', height: '100%' }}>
                <Canvas style={{ flex: 1 }}>
                    <Fill color="black" />
                    <Circle cx={100} cy={200} r={120} color="#4c1d95" /> {/* 紫の光 */}
                    <Circle cx={300} cy={500} r={150} color="#be185d" /> {/* ピンクの光 */}
                    {/* すりガラス効果 */}
                    <BackdropFilter filter={<Blur blur={30} />}>
                        <Fill color="rgba(0,0,0,0.3)" />
                    </BackdropFilter>
                </Canvas>
            </View>

            {/* 2. Moti: ふわっと出現するアニメーション */}
            <MotiView
                from={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring' }}
                className="bg-white/10 p-8 rounded-3xl border border-white/20"
            >
                <Text className="text-white text-2xl font-bold mb-4 text-center">
                    System All Green
                </Text>

                {/* 3. NativeWind & Haptics: インタラクティブなボタン */}
                <StyledButton
                    onPress={handlePress}
                    className="bg-blue-500 py-3 px-6 rounded-full active:bg-blue-600"
                >
                    <Text className="text-white font-bold text-center">
                        Tap for Haptics
                    </Text>
                </StyledButton>
            </MotiView>
        </View>
    );
}
