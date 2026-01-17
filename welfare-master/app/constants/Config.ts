import Constants from 'expo-constants';

// 型定義の再利用
export type AppVariant = 'social' | 'care' | 'mental';

// ここで安全に取り出す (デフォルトは social)
const variant = (Constants.expoConfig?.extra?.variant as AppVariant) || 'social';

// テーマカラー定義を一箇所にまとめる
export const THEME = {
    variant,
    colors: {
        // Primary Brand Color
        primary:
            variant === 'care' ? '#10B981' :   // Emerald-500
                variant === 'mental' ? '#EC4899' : // Pink-500
                    '#F97316',                         // Orange-500 (Social)

        // Background/Text utilities corresponding to tailwind classes if needed
        // But mainly we expose raw hex code for inline styles requiring dynamic color

        text:
            variant === 'care' ? 'text-emerald-600' :
                variant === 'mental' ? 'text-pink-600' :
                    'text-orange-600',

        bg:
            variant === 'care' ? 'bg-emerald-500' :
                variant === 'mental' ? 'bg-pink-500' :
                    'bg-orange-500',
    },

    labels: {
        appName:
            variant === 'care' ? '介護福祉士Master' :
                variant === 'mental' ? '精神保健福祉士Master' :
                    '社会福祉士Master',

        roleName:
            variant === 'care' ? 'Care Worker' :
                variant === 'mental' ? 'Mental Health Worker' :
                    'Social Worker',
    }
};
