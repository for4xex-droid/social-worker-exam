import { ExpoConfig, ConfigContext } from 'expo/config';

// 型を定義してタイプミスを防ぐ
type AppVariant = 'social' | 'care' | 'mental';

// 環境変数を取得。未指定ならエラーにするか、デフォルトを設定
const APP_VARIANT = (process.env.APP_VARIANT as AppVariant) || 'social';

// 設定マップ
const configs: Record<AppVariant, { name: string; slug: string; scheme: string; icon: string; bundleIdentifier: string; title: string, primaryColor: string }> = {
    social: {
        name: "社会福祉士Master",
        title: '社会福祉士',
        slug: "welfare-master-social",
        scheme: "welfare-social",
        icon: "./assets/icon-social.png",
        bundleIdentifier: "com.yourname.welfare.social",
        primaryColor: '#F97316',
    },
    care: {
        name: "介護福祉士Master",
        title: '介護福祉士',
        slug: "welfare-master-care",
        scheme: "welfare-care",
        icon: "./assets/icon-care.png",
        bundleIdentifier: "com.yourname.welfare.care",
        primaryColor: '#10B981',
    },
    mental: {
        name: "精神保健福祉士Master",
        title: '精神保健福祉士',
        slug: "welfare-master-mental",
        scheme: "welfare-mental",
        icon: "./assets/icon-mental.png",
        bundleIdentifier: "com.yourname.welfare.mental",
        primaryColor: '#EC4899',
    },
};

// バリデーション: 定義にないVariantが来たら起動させない
if (!configs[APP_VARIANT]) {
    throw new Error(`Invalid APP_VARIANT: ${APP_VARIANT}. Must be one of: social, care, mental`);
}

const currentConfig = configs[APP_VARIANT];
const IS_DEV = process.env.APP_VARIANT === 'development'; // Keep existing dev check logic if needed

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    name: IS_DEV ? `(Dev)${currentConfig.name}` : currentConfig.name,
    slug: currentConfig.slug,
    version: "1.0.0",
    sdkVersion: "54.0.0",
    orientation: "portrait",
    icon: currentConfig.icon,
    scheme: currentConfig.scheme,
    userInterfaceStyle: "light",
    splash: {
        image: "./assets/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff",
    },
    ios: {
        supportsTablet: true,
        bundleIdentifier: currentConfig.bundleIdentifier,
    },
    android: {
        adaptiveIcon: {
            foregroundImage: "./assets/adaptive-icon.png",
            backgroundColor: "#ffffff",
        },
        package: currentConfig.bundleIdentifier,
    },
    web: {
        favicon: "./assets/favicon.png",
    },
    plugins: [
        "expo-router",
        "expo-font",
        "expo-asset",
        ["expo-sqlite", {
            "enableFts": true
        }]
    ],
    extra: {
        eas: {
            projectId: "d46ccc02-0d9c-409c-aad6-faaacb0f07ea",
        },
        variant: APP_VARIANT, // アプリ内コードで分岐判定に使う
        brandColor: currentConfig.primaryColor,
        title: currentConfig.title
    },
    experiments: {
        typedRoutes: true,
    },
});
