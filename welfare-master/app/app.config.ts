import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
    const flavor = process.env.APP_FLAVOR || 'social';

    const flavorConfigs: Record<string, any> = {
        social: {
            name: '社会福祉士 合格マスター',
            title: '社会福祉士',
            slug: 'welfare-master-social',
            primaryColor: '#FF6B00',
            iconEmoji: '🧑‍💼',
        },
        mental: {
            name: '精神保健福祉士 合格マスター',
            title: '精神保健福祉士',
            slug: 'welfare-master-mental',
            primaryColor: '#2563EB',
            iconEmoji: '🧠',
        },
        care: {
            name: '介護福祉士 合格マスター',
            title: '介護福祉士',
            slug: 'welfare-master-care',
            primaryColor: '#10B981',
            iconEmoji: '👵',
        }
    };

    const currentFlavor = flavorConfigs[flavor] || flavorConfigs.social;

    return {
        ...config,
        name: currentFlavor.name,
        slug: currentFlavor.slug,
        version: '1.0.0',
        orientation: 'portrait',
        icon: './assets/icon.png',
        userInterfaceStyle: 'light',
        backgroundColor: '#ffffff',
        splash: {
            image: './assets/splash-icon.png',
            resizeMode: 'contain',
            backgroundColor: '#ffffff'
        },
        ios: {
            supportsTablet: true,
            bundleIdentifier: `com.welfaremaster.${flavor}`
        },
        android: {
            adaptiveIcon: {
                foregroundImage: './assets/adaptive-icon.png',
                backgroundColor: '#ffffff'
            },
            package: `com.welfaremaster.${flavor}`,
            edgeToEdgeEnabled: true
        },
        extra: {
            flavor,
            brandColor: currentFlavor.primaryColor,
            title: currentFlavor.title,
            iconEmoji: currentFlavor.iconEmoji,
            eas: {
                projectId: "807c4623-455b-4394-bb96-6e467d32c510"
            }
        },
        plugins: [
            'expo-sqlite',
            'expo-asset',
            'expo-router'
        ]
    };
};
