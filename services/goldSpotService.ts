import { GoldApiResponse } from '../types';
import { parseNumericValue } from './utils';

const API_TOKEN = "goldapi-h5rolsmkz5rm6w-io";
const STORAGE_KEY_GOLD = 'auragold_data_cache';

export type GoldPriceResult = {
  price: number;
  chp: number;
  source: 'GoldAPI.com' | 'Live' | 'Swissquote' | 'History' | 'None';
};

/**
 * Priority 1: Primary New Gold API
 * Endpoint: https://api.gold-api.com/price/XAU
 */
const fetchNewGoldApiPrice = async (): Promise<GoldPriceResult | null> => {
  const url = "https://api.gold-api.com/price/XAU";
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const data = await response.json();
      const price = parseNumericValue(data.price);
      if (price > 0) {
        console.debug('[GoldAPI.com] Success');
        localStorage.setItem(STORAGE_KEY_GOLD, JSON.stringify({ price, source: 'GoldAPI.com' }));
        return { price, chp: 0, source: 'GoldAPI.com' };
      }
    }
  } catch (error: any) {
    console.warn('[GoldAPI.com] Failed:', error.message);
  }
  return null;
};

/**
 * Fallback fetcher for Swissquote Forex Data Feed.
 */
const fetchSwissquoteGoldPrice = async (): Promise<GoldPriceResult | null> => {
  const targetUrl = "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD";
  
  const proxies = [
    (url: string) => `https://api.codetabs.com/v1/proxy?url=${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`
  ];

  for (let i = 0; i < proxies.length; i++) {
    const proxiedUrl = proxies[i](targetUrl);
    try {
      const response = await fetch(proxiedUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(15000)
      });
      
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const lastEntry = data[data.length - 1];
          if (lastEntry.spreadProfilePrices && lastEntry.spreadProfilePrices.length > 0) {
            const pricesArray = lastEntry.spreadProfilePrices;
            const lastProfile = pricesArray[pricesArray.length - 1];
            const bid = parseNumericValue(lastProfile.bid);
            
            if (bid > 0) {
              return { price: bid, chp: 0, source: 'Swissquote' };
            }
          }
        }
      }
    } catch (error: any) {
      console.warn(`[Swissquote] Proxy failed:`, error.message);
    }
  }

  return null;
};

/**
 * Priority 2: GoldAPI.io
 */
const fetchGoldApiIoPrice = async (): Promise<GoldPriceResult | null> => {
  const url = "https://www.goldapi.io/api/XAU/USD";
  const myHeaders = new Headers();
  myHeaders.append("x-access-token", API_TOKEN);
  myHeaders.append("Content-Type", "application/json");

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: myHeaders,
      signal: AbortSignal.timeout(15000)
    });
    
    if (response.ok) {
      const data: GoldApiResponse = await response.json();
      const price = parseNumericValue(data.price);
      if (price > 0) {
        localStorage.setItem(STORAGE_KEY_GOLD, JSON.stringify({ price, source: 'Live' }));
        return { price, chp: data.chp || 0, source: 'Live' };
      }
    }
  } catch (error: any) {
    console.warn('[GoldAPI.io] Failed:', error.message);
  }
  return null;
};

/**
 * Aggregator: Fetches the latest gold price with sequential priority.
 * Priority: GoldAPI.com -> GoldAPI.io -> Swissquote -> Cache.
 */
export const fetchLatestGoldPrice = async (): Promise<GoldPriceResult> => {
  // 1. Try Top Priority (Gold-API.com)
  const newApiRes = await fetchNewGoldApiPrice();
  if (newApiRes) return newApiRes;

  // 2. Try GoldAPI.io
  const ioRes = await fetchGoldApiIoPrice();
  if (ioRes) return ioRes;

  // 3. Try Swissquote Fallback
  const swissquoteRes = await fetchSwissquoteGoldPrice();
  if (swissquoteRes) return swissquoteRes;

  // 4. Try Cache
  const cached = localStorage.getItem(STORAGE_KEY_GOLD);
  if (cached) {
    try {
      const data = JSON.parse(cached);
      return { price: parseNumericValue(data.price), chp: 0, source: 'History' };
    } catch (e) {
      return { price: 0, chp: 0, source: 'None' };
    }
  }
  
  return { price: 0, chp: 0, source: 'None' };
};
