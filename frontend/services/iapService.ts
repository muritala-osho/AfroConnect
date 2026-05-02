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

export interface NormalizedPrice {
  productId: string;
  localizedPrice: string;
  currency: string;
  priceAmountMicros?: string;
  offerToken?: string;
  basePlanId?: string;
}

const PRICE_CACHE_KEY = 'iap_price_cache_v2';

let iapModule: any = null;
let asyncStorageModule: any = null;
let isIAPAvailable = false;
let cachedSubscriptions: any[] = [];
let cachedPrices: Record<string, NormalizedPrice> = {};

const getAsyncStorage = async () => {
  if (asyncStorageModule) return asyncStorageModule;
  try {
    asyncStorageModule = (await import('@react-native-async-storage/async-storage')).default;
    return asyncStorageModule;
  } catch {
    return null;
  }
};

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

function extractAndroidPrice(sub: any): NormalizedPrice | null {
  const offers = sub.subscriptionOfferDetails;
  if (!Array.isArray(offers) || offers.length === 0) return null;

  const baseOffer =
    offers.find((o: any) => !o.offerId) ||
    offers.reduce((cheapest: any, current: any) => {
      const cMicros = Number(current?.pricingPhases?.pricingPhaseList?.[0]?.priceAmountMicros || 0);
      const bMicros = Number(cheapest?.pricingPhases?.pricingPhaseList?.[0]?.priceAmountMicros || 0);
      return cMicros && (!bMicros || cMicros < bMicros) ? current : cheapest;
    }, offers[0]);

  const phases = baseOffer?.pricingPhases?.pricingPhaseList;
  if (!Array.isArray(phases) || phases.length === 0) return null;

  const paidPhase = phases.find((p: any) => Number(p?.priceAmountMicros || 0) > 0) || phases[phases.length - 1];

  if (!paidPhase?.formattedPrice) return null;

  return {
    productId: sub.productId,
    localizedPrice: paidPhase.formattedPrice,
    currency: paidPhase.priceCurrencyCode || 'USD',
    priceAmountMicros: paidPhase.priceAmountMicros,
    offerToken: baseOffer.offerToken,
    basePlanId: baseOffer.basePlanId,
  };
}

function extractIOSPrice(sub: any): NormalizedPrice | null {
  const localizedPrice = sub.localizedPrice || sub.price;
  if (!localizedPrice) return null;

  // Compute micros from the numeric price string so savings can be calculated
  let priceAmountMicros: string | undefined;
  const numericPrice = sub.price ?? sub.priceAmountMicros;
  if (numericPrice != null) {
    const parsed = parseFloat(String(numericPrice));
    if (!isNaN(parsed) && parsed > 0) {
      priceAmountMicros = String(Math.round(parsed * 1_000_000));
    }
  }

  return {
    productId: sub.productId,
    localizedPrice: String(localizedPrice),
    currency: sub.currency || 'USD',
    priceAmountMicros,
  };
}

const getSubscriptions = async (): Promise<NormalizedPrice[]> => {
  if (!isIAPAvailable || !iapModule) return [];
  try {
    const subs = await iapModule.getSubscriptions({ skus: SUBSCRIPTION_SKUS! });
    cachedSubscriptions = Array.isArray(subs) ? subs : [];

    const priceMap: Record<string, NormalizedPrice> = {};
    cachedSubscriptions.forEach((sub: any) => {
      if (!sub?.productId) return;
      const normalized =
        Platform.OS === 'android' ? extractAndroidPrice(sub) : extractIOSPrice(sub);
      if (normalized) {
        priceMap[normalized.productId] = normalized;
      }
    });
    cachedPrices = priceMap;

    // Persist to AsyncStorage so next launch is instant
    try {
      const storage = await getAsyncStorage();
      if (storage && Object.keys(priceMap).length > 0) {
        await storage.setItem(
          PRICE_CACHE_KEY,
          JSON.stringify({ prices: priceMap, ts: Date.now() }),
        );
      }
    } catch (cacheError) {
      logger.log('Failed to cache IAP prices:', cacheError);
    }

    return Object.values(priceMap);
  } catch (error) {
    logger.log('Failed to get subscriptions:', error);
    return [];
  }
};

/**
 * Load prices from AsyncStorage immediately (before IAP initialises)
 * so the screen can show local-currency prices on first render.
 */
const loadCachedPrices = async (): Promise<Record<string, NormalizedPrice>> => {
  try {
    const storage = await getAsyncStorage();
    if (!storage) return {};
    const raw = await storage.getItem(PRICE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Treat cache as stale after 24 hours (prices rarely change)
    if (Date.now() - (parsed.ts || 0) > 24 * 60 * 60 * 1000) return {};
    return parsed.prices || {};
  } catch {
    return {};
  }
};

const getCachedPrice = (productId: string): NormalizedPrice | undefined => {
  return cachedPrices[productId];
};

const requestSubscription = async (sku: string) => {
  if (!isIAPAvailable || !iapModule) {
    throw new Error('In-app purchases are not available on this device.');
  }
  try {
    if (Platform.OS === 'android') {
      const cached = cachedPrices[sku];
      const offerToken = cached?.offerToken;
      if (!offerToken) {
        throw new Error('Subscription offer not loaded. Please try again.');
      }
      return await iapModule.requestSubscription({
        sku,
        subscriptionOffers: [{ sku, offerToken }],
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
    cachedSubscriptions = [];
    cachedPrices = {};
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

const restorePurchases = async (): Promise<{ receipt: string | null; productId: string | null }> => {
  if (!isIAPAvailable || !iapModule) return { receipt: null, productId: null };
  try {
    const history = await iapModule.getPurchaseHistory();
    if (!Array.isArray(history) || history.length === 0) return { receipt: null, productId: null };

    const premiumPurchases = history
      .filter((p: any) => p.productId?.startsWith('afroconnect_premium'))
      .sort((a: any, b: any) => Number(b.transactionDate || 0) - Number(a.transactionDate || 0));

    if (premiumPurchases.length === 0) return { receipt: null, productId: null };

    const latest = premiumPurchases[0];
    const receipt = Platform.OS === 'ios' ? latest.transactionReceipt : latest.purchaseToken;
    return { receipt: receipt || null, productId: latest.productId || null };
  } catch (error) {
    logger.log('Failed to restore purchases:', error);
    return { receipt: null, productId: null };
  }
};

export const iapService = {
  PRODUCT_IDS,
  SUBSCRIPTION_SKUS,
  loadIAP,
  loadCachedPrices,
  getSubscriptions,
  getCachedPrice,
  requestSubscription,
  getPurchaseHistory,
  restorePurchases,
  finishTransaction,
  endConnection,
  addPurchaseListener,
  addErrorListener,
  get isAvailable() {
    return isIAPAvailable;
  },
};
