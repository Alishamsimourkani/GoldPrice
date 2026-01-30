
export interface GoldApiResponse {
  date?: string;
  timestamp: number;
  metal: string;
  currency: string;
  exchange: string;
  symbol: string;
  price: number;
  prev_close_price: number;
  ch: number;
  chp: number;
  ask?: number;
  bid?: number;
  price_gram_24k: number;
  price_gram_22k: number;
  price_gram_21k: number;
  price_gram_20k: number;
  price_gram_18k: number;
  price_gram_16k: number;
  price_gram_14k: number;
  price_gram_10k: number;
}

export interface NobitexResponse {
  status: string;
  lastUpdate: number;
  lastTradePrice: string;
  bids: [string, string][];
  asks: [string, string][];
}

export interface TetherlandResponse {
  status: number;
  data: {
    currencies: {
      USDT: {
        price: number;
        sell_price: number;
        buy_price: number;
        diff24d: string;
        diff7d: string;
        diff30d: string;
        last24h: number;
        last24hMin: number;
        last24hMax: number;
        last7d: number;
        last7dMin: number;
        last7dMax: number;
        last30d: number;
        last30dMin: number;
        last30dMax: number;
      };
    };
  };
}

export interface CalculationResult {
  finalPrice: number;
  rawPricePerGram: number;
  purityFactor: number;
  timestamp: Date;
}
