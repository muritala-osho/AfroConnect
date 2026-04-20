import logger from '@/utils/logger';
import { Platform } from 'react-native';

const PRODUCT_IDS = {
  DAILY: 'afroconnect_premium_daily',
  WEEKLY: 'afroconnect_premium_weekly',
  MONTHLY: 'afroconnect_premium_monthly',
  YEARLY: 'afroconnect_premium_yearly',
};

const SUBSCRIPTION_SKUS = Platform.select({
  ios: [
    PRODUCT_IDS.DAILY,
    PRODUCT_IDS.WEEKLY,
    PRODUCT_IDS.MONTHLY,
    PRODUCT_IDS.YEARLY,
  ],
  android: [
    PRODUCT_IDS.DAILY,
    PRODUCT_IDS.WEEKLY,
    PRODUCT_IDS.MONTHLY,
    PRODUCT_IDS.YEARLY,
  ],
  default: [],
});

let iapModule: any = null;
let isIAPAvailable = false;

const loadIAP = async () => {
  if (Platform.OS === 'web') return false;
  if (iapModule) return isIAPAvailable;
  try {
    iapModule = await import('react-native-iap');
    await iapModule.initConnection();
    isIAPAvailable = true;
    return true;
  } catch (error) {
    logger.log('IAP not available:', error);
    isIAPAvailable = false;
    return false;
  }
};

const getSubscriptions = async () => {
  if (!isIAPAvailable || !iapModule) return [];
  try {
    const subs = await iapModule.getSubscriptions({ skus: SUBSCRIPTION_SKUS! });
    return subs;
  } catch (error) {
    logger.log('Failed to get subscriptions:', error);
    return [];
  }
};

const requestSubscription = async (sku: string) => {
  if (!isIAPAvailable || !iapModule) {
    throw new Error('In-app purchases are not available on this device.');
  }
  try {
    if (Platform.OS === 'android') {
      return await iapModule.requestSubscription({
        sku,
        subscriptionOffers: [{ sku, offerToken: '' }],
      });
    }
    return await iapModule.requestSubscription({ sku });
  } catch (error: any) {
    if (error?.code === 'E_USER_CANCELLED') {
      throw new Error('CANCELLED');
    }
    throw error;
  }
};

const getPurchaseHistory = async () => {
  if (!isIAPAvailable || !iapModule) return [];
  try {
    return await iapModule.getPurchaseHistory();
  } catch (error) {
    logger.log('Failed to get purchase history:', error);
    return [];
  }
};

const finishTransaction = async (purchase: any, isConsumable = false) => {
  if (!isIAPAvailable || !iapModule) return;
  try {
    await iapModule.finishTransaction({ purchase, isConsumable });
  } catch (error) {
    logger.log('Failed to finish transaction:', error);
  }
};

const endConnection = () => {
  if (!isIAPAvailable || !iapModule) return;
  try {
    iapModule.endConnection();
  } catch (error) {
    logger.log('Failed to end IAP connection:', error);
  }
};

const addPurchaseListener = (callback: (purchase: any) => void) => {
  if (!isIAPAvailable || !iapModule) return () => {};
  const subscription = iapModule.purchaseUpdatedListener(callback);
  return () => subscription.remove();
};

const addErrorListener = (callback: (error: any) => void) => {
  if (!isIAPAvailable || !iapModule) return () => {};
  const subscription = iapModule.purchaseErrorListener(callback);
  return () => subscription.remove();
};

export const iapService = {
  PRODUCT_IDS,
  SUBSCRIPTION_SKUS,
  loadIAP,
  getSubscriptions,
  requestSubscription,
  getPurchaseHistory,
  finishTransaction,
  endConnection,
  addPurchaseListener,
  addErrorListener,
  get isAvailable() {
    return isIAPAvailable;
  },
};
