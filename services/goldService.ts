
import { GoldApiResponse } from '../types';

const API_TOKEN = "goldapi-h5rolsmkz5rm6w-io";
const WALLGOLD_TOKEN = "5093975|bCdpaLmf9i7CcVAusx53DpffU9LeE8tLq9XlVzHRe96015bd";
const STORAGE_KEY_GOLD = 'auragold_data_cache';

/**
 * Helper to clean and parse numeric strings from varying API responses
 */
const parseNumericValue = (val: any): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/,/g, '');
    return parseFloat(cleaned);
  }
  return 0;
};

export type GoldPriceResult = {
  price: number;
  chp: number;
  source: 'Live' | 'Swissquote' | 'History' | 'None';
};

/**
 * Fallback fetcher for Swissquote Forex Data Feed.
 * Implements proxy rotation to bypass CORS and network blocks.
 */
const fetchSwissquoteGoldPrice = async (): Promise<GoldPriceResult | null> => {
  const targetUrl = "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD";
  
  // List of proxies to try in order of reliability
  const proxies = [
    (url: string) => `https://api.codetabs.com/v1/proxy?url=${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`
  ];

  for (let i = 0; i < proxies.length; i++) {
    const start = performance.now();
    const proxiedUrl = proxies[i](targetUrl);
    const proxyName = proxiedUrl.split('/')[2];

    try {
      console.debug(`[Swissquote] Attempting fetch via ${proxyName} (Attempt ${i + 1}/${proxies.length})...`);
      const response = await fetch(proxiedUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(15000) // 15s per proxy attempt
      });
      
      const end = performance.now();
      
      if (response.ok) {
        const data = await response.json();
        console.debug(`[Swissquote] Proxy ${proxyName} success in ${(end - start).toFixed(2)}ms`);
        
        if (Array.isArray(data) && data.length > 0) {
          // Get the last entry from the main array
          const lastEntry = data[data.length - 1];
          if (lastEntry.spreadProfilePrices && lastEntry.spreadProfilePrices.length > 0) {
            // Get the last "bid" from the spreadProfilePrices array
            const pricesArray = lastEntry.spreadProfilePrices;
            const lastProfile = pricesArray[pricesArray.length - 1];
            const bid = parseNumericValue(lastProfile.bid);
            
            if (bid > 0) {
              return {
                price: bid,
                chp: 0,
                source: 'Swissquote'
              };
            }
          }
        }
      } else {
        console.warn(`[Swissquote] Proxy ${proxyName} returned status: ${response.status}`);
      }
    } catch (error: any) {
      console.warn(`[Swissquote] Proxy ${proxyName} failed:`, error.message || error);
      // Continue to next proxy
    }
  }

  console.error('[Swissquote] All proxy attempts failed.');
  return null;
};

/**
 * Fetches the latest gold price from GoldAPI.io.
 * Includes a retry mechanism for timeout errors and multiple fallback levels.
 */
export const fetchLatestGoldPrice = async (retryCount = 0): Promise<GoldPriceResult> => {
  const start = performance.now();
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
    
    const end = performance.now();
    console.debug(`[GoldAPI.io] Fetch took ${(end - start).toFixed(2)}ms`);
    
    if (response.ok) {
      const data: GoldApiResponse = await response.json();
      const price = parseNumericValue(data.price);
      
      if (price > 0) {
        localStorage.setItem(STORAGE_KEY_GOLD, JSON.stringify({ price, source: 'Live' }));
        return { 
          price: price, 
          chp: data.chp || 0, 
          source: 'Live' 
        };
      }
    } else {
      console.warn(`[GoldAPI.io] API error (${response.status}). Trying Swissquote fallback...`);
      const swissquoteRes = await fetchSwissquoteGoldPrice();
      if (swissquoteRes) return swissquoteRes;
    }
  } catch (error: any) {
    if (error.name === 'TimeoutError') {
      console.error(`[GoldAPI.io] Timeout (Attempt ${retryCount + 1}).`);
      if (retryCount < 1) {
        return fetchLatestGoldPrice(retryCount + 1);
      }
    } else {
      console.error('[GoldAPI.io] Fetch error:', error.message || error);
    }
    
    // Fallback to Swissquote
    const swissquoteRes = await fetchSwissquoteGoldPrice();
    if (swissquoteRes) return swissquoteRes;
  }

  // Final fallback to cached data
  const cached = localStorage.getItem(STORAGE_KEY_GOLD);
  if (cached) {
    try {
      const data = JSON.parse(cached);
      console.debug('[GoldAPI] Using cached history data');
      return { 
        price: parseNumericValue(data.price), 
        chp: 0, 
        source: 'History' 
      };
    } catch (e) {
      return { price: 0, chp: 0, source: 'None' };
    }
  }
  
  return { price: 0, chp: 0, source: 'None' };
};

/**
 * Fetches the Market Price from WallGold API.
 */
export const fetchMarketPrice = async (): Promise<number> => {
  const start = performance.now();
  const url = "https://api.wallgold.ir/api/v1/price?symbol=GLD_18C_750TMN&side=buy";
  
  const headers = new Headers();
  headers.append("Accept", "application/json");
  headers.append("Authorization", `Bearer ${WALLGOLD_TOKEN}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: headers,
      signal: AbortSignal.timeout(15000)
    });
    const end = performance.now();
    console.debug(`[WallGold] Fetch took ${(end - start).toFixed(2)}ms`);
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.result && data.result.price) {
        return parseNumericValue(data.result.price);
      }
    }
  } catch (error: any) {
    console.error('[WallGold] Market Price error:', error.message || error);
  }
  return 0;
};

export interface ExchangeRateDetail {
  price: number;
  status: 'ok' | 'error';
}

export type ExchangeRateResult = {
  tetherland: ExchangeRateDetail;
  nobitex: ExchangeRateDetail;
  bestSource: 'Tetherland' | 'Nobitex' | 'None';
};

/**
 * Fetches exchange rates from Tetherland and Nobitex concurrently.
 */
export const fetchExchangeRate = async (): Promise<ExchangeRateResult> => {
  const tetherlandTarget = "https://api.tetherland.com/currencies";
  const nobitexTarget = "https://apiv2.nobitex.ir/v3/orderbook/USDTIRT";

  const result: ExchangeRateResult = {
    tetherland: { price: 0, status: 'error' },
    nobitex: { price: 0, status: 'error' },
    bestSource: 'None'
  };

  const fetchTetherland = async () => {
    try {
      const response = await fetch(tetherlandTarget, { signal: AbortSignal.timeout(15000) });
      if (response.ok) {
        const data = await response.json();
        const currencies = data?.data?.currencies || data?.currencies;
        if (currencies?.USDT) {
          const p = parseNumericValue(currencies.USDT.price || currencies.USDT.sell_price);
          if (p > 0) result.tetherland = { price: p, status: 'ok' };
        }
      }
    } catch (e: any) {
      console.warn('[Tetherland] Error:', e.message || e);
    }
  };

  const fetchNobitex = async () => {
    try {
      const response = await fetch(nobitexTarget, { signal: AbortSignal.timeout(15000) });
      if (response.ok) {
        const data = await response.json();
        if (data.status === "ok" && data.lastTradePrice) {
          const p = parseNumericValue(data.lastTradePrice) / 10;
          if (p > 0) result.nobitex = { price: p, status: 'ok' };
        }
      }
    } catch (e: any) {
      console.warn('[Nobitex] Error:', e.message || e);
    }
  };

  await Promise.allSettled([fetchTetherland(), fetchNobitex()]);

  if (result.tetherland.status === 'ok') result.bestSource = 'Tetherland';
  else if (result.nobitex.status === 'ok') result.bestSource = 'Nobitex';

  return result;
};
