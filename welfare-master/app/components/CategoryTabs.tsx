import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';

type TabKey = 'all' | 'past' | 'common' | 'special';

interface CategoryTabsProps {
    activeTab: TabKey;
    onTabPress: (key: TabKey) => void;
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({ activeTab, onTabPress }) => {

    const tabs: { key: TabKey; label: string }[] = [
        { key: 'all', label: 'すべて' },
        { key: 'past', label: '過去問' },
        { key: 'common', label: '共通 AI' },
        { key: 'special', label: '専門 AI' },
    ];

    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            onPress={() => onTabPress(tab.key)}
                            activeOpacity={0.7}
                            style={[
                                styles.tab,
                                isActive && styles.activeTab
                            ]}
                        >
                            <Text style={[
                                styles.label,
                                isActive && styles.activeLabel
                            ]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    scrollContent: {
        paddingHorizontal: 16,
        gap: 12,
    },
    tab: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.7)', // Glass-like default
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    activeTab: {
        backgroundColor: '#3B82F6', // Vibrant Blue (Tailwind blue-500)
        borderColor: '#3B82F6',
        transform: [{ scale: 1.05 }], // Subtle pop
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B', // Slate 500
    },
    activeLabel: {
        color: '#FFFFFF',
        fontWeight: '700',
    }
});
