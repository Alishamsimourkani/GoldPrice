
import { parseNumericValue } from './utils';

const WALLGOLD_TOKEN = "5093975|bCdpaLmf9i7CcVAusx53DpffU9LeE8tLq9XlVzHRe96015bd";

/**
 * Fetches Market Price from WallGold with 30s timeout.
 */
export const fetchMarketPrice = async (): Promise<number> => {
  const url = "https://api.wallgold.ir/api/v1/price?symbol=GLD_18C_750TMN&side=buy";
  
  const headers = new Headers();
  headers.append("Accept", "application/json");
  headers.append("Authorization", `Bearer ${WALLGOLD_TOKEN}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: headers,
      signal: AbortSignal.timeout(30000)
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.result && data.result.price) {
        return parseNumericValue(data.result.price);
      }
    }
  } catch (error: any) {
    console.error('[WallGold] Market Price error:', error.message);
  }
  return 0;
};
