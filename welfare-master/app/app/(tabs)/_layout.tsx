import { Tabs } from 'expo-router';
import { Home, BarChart2, Settings } from 'lucide-react-native';
import { THEME } from '../../constants/Config'; // Import centralized theme

export default function TabLayout() {
    const brandColor = THEME.colors.primary.replace('bg-', '').replace('-500', ''); // Extract color code approx? No, let's use hex for tab bar.
    // Actually Config.ts returns tailwind class strings like 'bg-orange-500'. 
    // We need hex codes for TabBar. Let's map variant to hex directly here or update Config.ts later.
    // For safety without editing Config.ts yet, let's map manually here to match:
    const activeColor =
        THEME.variant === 'care' ? '#10B981' :
            THEME.variant === 'mental' ? '#EC4899' :
                '#f97316';

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: '#ffffff',
                    borderTopWidth: 0,
                    elevation: 0,
                    height: 90, // Increased from 60
                    paddingBottom: 30, // Increased for iPhone X+ home indicator
                    paddingTop: 10,
                    shadowColor: '#000',
                    shadowOpacity: 0.05,
                    shadowOffset: { width: 0, height: -2 },
                    shadowRadius: 10,
                },
                tabBarActiveTintColor: activeColor,
                tabBarInactiveTintColor: '#94a3b8',
                tabBarShowLabel: true,
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '600',
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'ホーム',
                    tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="analytics"
                options={{
                    title: '学習記録',
                    tabBarIcon: ({ color, size }) => <BarChart2 color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: '設定',
                    tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
                }}
            />
        </Tabs>
    );
}
