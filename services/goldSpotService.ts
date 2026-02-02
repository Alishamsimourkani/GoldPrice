
import { GoldApiResponse } from '../types';
import { parseNumericValue } from './utils';

const API_TOKEN = "goldapi-h5rolsmkz5rm6w-io";
const STORAGE_KEY_GOLD = 'auragold_data_cache';

export type GoldSource = 'GoldAPI.com' | 'Live' | 'Swissquote' | 'Auto';
export type GoldPriceResult = {
  price: number;
  source: 'GoldAPI.com' | 'Live' | 'Swissquote' | 'History' | 'None';
};

/**
 * Priority 1: Primary New Gold API (gold-api.com)
 */
const fetchNewGoldApiPrice = async (): Promise<GoldPriceResult | null> => {
  const url = "https://api.gold-api.com/price/XAU";
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(15000)
    });
    
    if (response.ok) {
      const data = await response.json();
      const price = parseNumericValue(data.price);
      if (price > 0) {
        return { price, source: 'GoldAPI.com' };
      }
    }
  } catch (error: any) {
    console.warn('[GoldAPI.com] Failed:', error.message);
  }
  return null;
};

/**
 * Priority 2: GoldAPI.io (Live)
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
        return { price, source: 'Live' };
      }
    }
  } catch (error: any) {
    console.warn('[GoldAPI.io] Failed:', error.message);
  }
  return null;
};

/**
 * Priority 3: Swissquote Forex Data Feed.
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
        signal: AbortSignal.timeout(10000)
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
              return { price: bid, source: 'Swissquote' };
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
 * Sequential aggregator: Tries each source in order of priority or user preference.
 */
export const fetchLatestGoldPrice = async (prefSource: GoldSource = 'Auto'): Promise<GoldPriceResult> => {
  const sources = {
    'GoldAPI.com': fetchNewGoldApiPrice,
    'Live': fetchGoldApiIoPrice,
    'Swissquote': fetchSwissquoteGoldPrice
  };

  // 1. Try preferred source first if not Auto
  if (prefSource !== 'Auto') {
    const res = await sources[prefSource]();
    if (res) {
      localStorage.setItem(STORAGE_KEY_GOLD, JSON.stringify({ price: res.price }));
      return res;
    }
  }

  // 2. Fallback sequence (or default Auto sequence)
  const newApiRes = await fetchNewGoldApiPrice();
  if (newApiRes) {
    localStorage.setItem(STORAGE_KEY_GOLD, JSON.stringify({ price: newApiRes.price }));
    return newApiRes;
  }

  const ioRes = await fetchGoldApiIoPrice();
  if (ioRes) {
    localStorage.setItem(STORAGE_KEY_GOLD, JSON.stringify({ price: ioRes.price }));
    return ioRes;
  }

  const swissquoteRes = await fetchSwissquoteGoldPrice();
  if (swissquoteRes) {
    localStorage.setItem(STORAGE_KEY_GOLD, JSON.stringify({ price: swissquoteRes.price }));
    return swissquoteRes;
  }

  const cached = localStorage.getItem(STORAGE_KEY_GOLD);
  if (cached) {
    try {
      const data = JSON.parse(cached);
      return { price: parseNumericValue(data.price), source: 'History' };
    } catch (e) {}
  }

  return { price: 0, source: 'None' };
};
