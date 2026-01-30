import { parseNumericValue } from './utils';

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
      console.warn('[Tetherland] Error:', e.message);
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
      console.warn('[Nobitex] Error:', e.message);
    }
  };

  await Promise.allSettled([fetchTetherland(), fetchNobitex()]);

  if (result.tetherland.status === 'ok') result.bestSource = 'Tetherland';
  else if (result.nobitex.status === 'ok') result.bestSource = 'Nobitex';

  return result;
};
