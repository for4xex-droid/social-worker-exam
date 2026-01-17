/**
 * Premium Status Management
 * 
 * このファイルはプレミアム（課金）状態の管理を一元化します。
 * 将来的に RevenueCat, Expo IAP, Stripe などの課金プロバイダーを
 * 統合する際は、このファイルを更新してください。
 * 
 * 【現在の実装】
 * - AsyncStorage に 'is_premium' キーで状態を保存
 * - 'true' の場合はプレミアム、それ以外は非プレミアム
 * - usePremium() フックで各画面からプレミアム状態を取得
 * 
 * 【課金統合時のTODO】
 * 1. 課金プロバイダーのSDKをインストール (例: expo-in-app-purchases, react-native-purchases)
 * 2. checkPremiumStatus() を更新し、プロバイダーから購入状態を取得
 * 3. unlockPremium() を更新し、実際の購入処理を実行
 * 4. restorePurchases() を更新し、購入履歴の復元を実装
 * 
 * 【使い方】
 * // 各画面で:
 * import { usePremium } from '../../constants/premium';
 * const { isPremium, loading, refresh } = usePremium();
 */

import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ========================================
// イベント管理（購入後の状態更新用）
// シンプルなサブスクライバーパターン (React Native/Web互換)
// ========================================

type PremiumChangeHandler = (isPremium: boolean) => void;
const subscribers: Set<PremiumChangeHandler> = new Set();

/** 状態変更を通知する（内部用） */
function notifyPremiumChange(isPremium: boolean) {
    subscribers.forEach(handler => handler(isPremium));
}

/** サブスクライバーを追加する（内部用） */
function subscribeToPremiumChanges(handler: PremiumChangeHandler): () => void {
    subscribers.add(handler);
    return () => subscribers.delete(handler);
}

// ========================================
// 定数
// ========================================

/** AsyncStorage のキー */
export const PREMIUM_STORAGE_KEY = 'is_premium';

/** 商品ID (App Store / Google Play で設定する商品ID) */
export const PRODUCT_ID = {
    ONE_TIME_PURCHASE: 'com.yourapp.premium.lifetime', // TODO: 実際の商品IDに置き換え
};

/** 価格情報 (表示用、実際の価格はストアから取得すべき) */
export const PREMIUM_PRICE = {
    amount: 500,
    currency: '¥',
    display: '¥500',
};

// ========================================
// プレミアム状態のチェック
// ========================================

/**
 * プレミアム状態を確認する
 * 
 * TODO: 課金プロバイダー統合時
 * - RevenueCat: Purchases.getCustomerInfo() を使用
 * - Expo IAP: InAppPurchases.getPurchaseHistoryAsync() を使用
 * 
 * @returns Promise<boolean> - プレミアムならtrue
 */
export async function checkPremiumStatus(): Promise<boolean> {
    try {
        // ================================================
        // 【開発モード】常にプレミアム有効
        // 本番リリース時は以下を元に戻してください
        // ================================================
        return true;

        // ================================================
        // 【課金統合ポイント】
        // ここで課金プロバイダーから購入状態を確認する
        // 例: const customerInfo = await Purchases.getCustomerInfo();
        //     return customerInfo.entitlements.active['premium'] !== undefined;
        // ================================================

        // const value = await AsyncStorage.getItem(PREMIUM_STORAGE_KEY);
        // return value === 'true';
    } catch (error) {
        console.error('[Premium] Failed to check status:', error);
        return false;
    }
}

// ========================================
// プレミアムのアンロック（購入処理）
// ========================================

/**
 * プレミアムをアンロックする（購入成功後に呼び出す）
 * 
 * TODO: 課金プロバイダー統合時
 * - この関数は購入処理自体ではなく、購入成功後のローカル状態更新に使う
 * - 実際の購入処理は purchase.tsx の handlePurchase で行う
 * 
 * @returns Promise<boolean> - 成功したらtrue
 */
export async function unlockPremium(): Promise<boolean> {
    try {
        await AsyncStorage.setItem(PREMIUM_STORAGE_KEY, 'true');
        console.log('[Premium] Successfully unlocked premium');
        notifyPremiumChange(true); // 全画面に通知
        return true;
    } catch (error) {
        console.error('[Premium] Failed to unlock:', error);
        return false;
    }
}

// ========================================
// 購入履歴の復元
// ========================================

/**
 * 購入履歴を復元する
 * 
 * TODO: 課金プロバイダー統合時
 * - RevenueCat: Purchases.restorePurchases() を使用
 * - Expo IAP: InAppPurchases.getPurchaseHistoryAsync() を使用
 * 
 * @returns Promise<boolean> - 復元成功（プレミアム有効）ならtrue
 */
export async function restorePurchases(): Promise<boolean> {
    try {
        // ================================================
        // 【課金統合ポイント】
        // ここで課金プロバイダーから購入履歴を復元する
        // 例: const customerInfo = await Purchases.restorePurchases();
        //     const hasPremium = customerInfo.entitlements.active['premium'] !== undefined;
        //     if (hasPremium) await AsyncStorage.setItem(PREMIUM_STORAGE_KEY, 'true');
        //     return hasPremium;
        // ================================================

        // 現在はAsyncStorageのみチェック（ダミー実装）
        const value = await AsyncStorage.getItem(PREMIUM_STORAGE_KEY);
        const isPremium = value === 'true';

        if (isPremium) {
            notifyPremiumChange(true); // 全画面に通知
        }

        return isPremium;
    } catch (error) {
        console.error('[Premium] Failed to restore purchases:', error);
        return false;
    }
}

// ========================================
// デバッグ用（開発時のみ使用）
// ========================================

/**
 * 【開発用】プレミアム状態をリセットする
 * 本番環境では使用しないでください
 */
export async function resetPremiumStatus(): Promise<void> {
    try {
        await AsyncStorage.removeItem(PREMIUM_STORAGE_KEY);
        console.log('[Premium] Status reset (dev only)');
        notifyPremiumChange(false); // 全画面に通知
    } catch (error) {
        console.error('[Premium] Failed to reset:', error);
    }
}

/**
 * 【開発用】プレミアム状態を強制的に設定する
 * 本番環境では使用しないでください
 */
export async function setDebugPremiumStatus(isPremium: boolean): Promise<void> {
    try {
        await AsyncStorage.setItem(PREMIUM_STORAGE_KEY, isPremium ? 'true' : 'false');
        console.log(`[Premium] Debug status set to: ${isPremium}`);
        notifyPremiumChange(isPremium); // 全画面に通知
    } catch (error) {
        console.error('[Premium] Failed to set debug status:', error);
    }
}

// ========================================
// React フック（各画面で使用）
// ========================================

/**
 * プレミアム状態を管理するReactフック
 * 
 * 使い方:
 * ```tsx
 * import { usePremium } from '../../constants/premium';
 * 
 * function MyScreen() {
 *     const { isPremium, loading, refresh } = usePremium();
 *     
 *     if (loading) return <Loading />;
 *     if (!isPremium) return <LockedContent />;
 *     return <PremiumContent />;
 * }
 * ```
 * 
 * 特徴:
 * - 画面フォーカス時に自動で状態を更新
 * - 購入完了時に自動で全画面に反映（イベント経由）
 * - refresh() で手動更新も可能
 */
export function usePremium() {
    const [isPremium, setIsPremium] = useState(false);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const status = await checkPremiumStatus();
            setIsPremium(status);
        } catch (error) {
            console.error('[usePremium] Failed to check status:', error);
            setIsPremium(false);
        } finally {
            setLoading(false);
        }
    }, []);

    // 画面フォーカス時に状態を更新
    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [refresh])
    );

    // 購入後のイベントをリッスン
    useEffect(() => {
        const handler = (newStatus: boolean) => {
            setIsPremium(newStatus);
            setLoading(false);
        };
        const unsubscribe = subscribeToPremiumChanges(handler);
        return unsubscribe;
    }, []);

    return { isPremium, loading, refresh };
}
