import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Calculator, TrendingUp, TrendingDown, DollarSign, RefreshCw, Info, Scale, 
  Globe, Unlock, Coins, AlertCircle, Database, User, Clock, Loader2, WifiOff,
  MoveUp, MoveDown, Zap, ShoppingBag, BarChart3, Bell, BellOff, Volume2, VolumeX
} from 'lucide-react';
import { fetchLatestGoldPrice, fetchExchangeRate, fetchMarketPrice } from './services';
import { GoldApiResponse } from './types';

const STORAGE_KEYS = {
  EXCHANGE_RATE: 'auragold_exchange_rate',
  GOLD_DATA: 'auragold_data',
  GRAM_AMOUNT: 'auragold_gram_amount',
  EXCHANGE_SOURCE: 'auragold_exchange_source',
  GOLD_SOURCE: 'auragold_gold_source',
  REFRESH_INTERVAL: 'auragold_refresh_interval',
  USER_PREFERENCE_SOURCE: 'auragold_user_pref_source',
  MARKET_PRICE: 'auragold_market_price',
  NOTIFICATIONS_ENABLED: 'auragold_notifications_enabled'
};

const REFRESH_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '1M', value: 1 * 60 * 1000 },
  { label: '5M', value: 5 * 60 * 1000 },
  { label: '10M', value: 10 * 60 * 1000 },
  { label: '30M', value: 30 * 60 * 1000 },
];

const App: React.FC = () => {
  // Current values
  const [exchangeRate, setExchangeRate] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.EXCHANGE_RATE);
    return saved ? Number(saved) : 0;
  });
  const [exchangeSource, setExchangeSource] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.EXCHANGE_SOURCE) || 'None';
  });
  const [goldPrice, setGoldPrice] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.GOLD_DATA);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.price || 0;
      } catch (e) { return 0; }
    }
    return 0;
  });
  const [marketPrice, setMarketPrice] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MARKET_PRICE);
    return saved ? Number(saved) : 0;
  });
  const [goldSource, setGoldSource] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.GOLD_SOURCE) || 'None';
  });
  const [gramAmount, setGramAmount] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.GRAM_AMOUNT);
    return saved ? Number(saved) : 1;
  });
  const [refreshInterval, setRefreshInterval] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.REFRESH_INTERVAL);
    return saved !== null ? Number(saved) : 0;
  });

  const [prefSource, setPrefSource] = useState<'Tetherland' | 'Nobitex' | 'Auto'>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCE_SOURCE);
    return (saved as any) || 'Auto';
  });

  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED) === 'true';
  });

  const [availableRates, setAvailableRates] = useState<{
    tetherland: { price: number; status: 'ok' | 'error' };
    nobitex: { price: number; status: 'ok' | 'error' };
  }>({
    tetherland: { price: 0, status: 'error' },
    nobitex: { price: 0, status: 'error' }
  });

  const [prevExchangeRate, setPrevExchangeRate] = useState<number | null>(null);
  const [prevGoldPrice, setPrevGoldPrice] = useState<number | null>(null);
  const [prevValuation, setPrevValuation] = useState<number | null>(null);

  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [showSyncOverlay, setShowSyncOverlay] = useState<boolean>(false);
  const [isPulsing, setIsPulsing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const calculateResult = useCallback((rate: number, spot: number): number => {
    if (!rate || !spot) return 0;
    // Core Formula: ((Exchange Price * Spot Price) / 31.1035) * 0.75
    return ((rate * spot) / 31.1035) * 0.75;
  }, []);

  const currentPricePerGram = calculateResult(exchangeRate, goldPrice);
  const currentTotalValuation = currentPricePerGram * gramAmount;
  const marketDiff = marketPrice > 0 ? ((marketPrice - currentPricePerGram) / currentPricePerGram) * 100 : 0;

  const triggerAlert = useCallback((diff: number) => {
    if (!notificationsEnabled) return;

    if (Notification.permission === 'granted') {
      new Notification('AuraGold Alert', {
        body: `Market Spread reached ${diff.toFixed(2)}%! Check the dashboard.`,
        icon: 'https://cdn-icons-png.flaticon.com/512/261/261778.png'
      });
    }

    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log('Audio playback prevented by browser'));
    }
  }, [notificationsEnabled]);

  const refreshData = async () => {
    const refreshStart = performance.now();
    setIsSyncing(true);
    setError(null);

    setPrevExchangeRate(exchangeRate);
    setPrevGoldPrice(goldPrice);
    setPrevValuation(currentTotalValuation);

    const overlayTimer = setTimeout(() => {
      setShowSyncOverlay(true);
    }, 5000);

    try {
      const [goldRes, rateRes, wallGoldRes] = await Promise.all([
        fetchLatestGoldPrice(),
        fetchExchangeRate(),
        fetchMarketPrice()
      ]);

      if (goldRes.price > 0) {
        setGoldPrice(goldRes.price);
        setGoldSource(goldRes.source);
        localStorage.setItem(STORAGE_KEYS.GOLD_DATA, JSON.stringify({ price: goldRes.price }));
        localStorage.setItem(STORAGE_KEYS.GOLD_SOURCE, goldRes.source);
      }

      if (wallGoldRes > 0) {
        setMarketPrice(wallGoldRes);
        localStorage.setItem(STORAGE_KEYS.MARKET_PRICE, wallGoldRes.toString());
      }

      setAvailableRates({
        tetherland: rateRes.tetherland,
        nobitex: rateRes.nobitex
      });

      let selectedRate = 0;
      let finalSource: string = 'None';

      const tryTetherland = () => {
        if (rateRes.tetherland.status === 'ok') {
          selectedRate = rateRes.tetherland.price;
          finalSource = 'Tetherland';
          return true;
        }
        return false;
      };

      const tryNobitex = () => {
        if (rateRes.nobitex.status === 'ok') {
          selectedRate = rateRes.nobitex.price;
          finalSource = 'Nobitex';
          return true;
        }
        return false;
      };

      if (prefSource === 'Tetherland') {
        if (!tryTetherland()) tryNobitex();
      } else if (prefSource === 'Nobitex') {
        if (!tryNobitex()) tryTetherland();
      } else {
        if (!tryTetherland()) tryNobitex();
      }

      if (selectedRate > 0) {
        setExchangeRate(selectedRate);
        setExchangeSource(finalSource);
        localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, selectedRate.toString());
        localStorage.setItem(STORAGE_KEYS.EXCHANGE_SOURCE, finalSource);
      }

      const newPricePerGram = calculateResult(selectedRate || exchangeRate, goldRes.price || goldPrice);
      const newMarketDiff = wallGoldRes > 0 ? ((wallGoldRes - newPricePerGram) / newPricePerGram) * 100 : 0;
      
      if (Math.abs(newMarketDiff) >= 4) {
        triggerAlert(newMarketDiff);
      }

      setIsPulsing(true);
      setTimeout(() => setIsPulsing(false), 1000);
      
      if (refreshInterval > 0) {
        setTimeLeft(refreshInterval);
      }
    } catch (err) {
      setError('Sync operation encountered an error.');
    } finally {
      clearTimeout(overlayTimer);
      setIsInitialLoad(false);
      setIsSyncing(false);
      setShowSyncOverlay(false);
      const refreshEnd = performance.now();
      console.debug(`[Total Refresh] Full sync cycle took ${(refreshEnd - refreshStart).toFixed(2)}ms`);
    }
  };

  const toggleNotifications = async () => {
    if (!notificationsEnabled) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, 'true');
      } else {
        alert('Notification permission is required for this feature.');
      }
    } else {
      setNotificationsEnabled(false);
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, 'false');
    }
  };

  const handleExchangeRateChange = (value: number) => {
    setPrevExchangeRate(exchangeRate);
    setExchangeRate(value);
    setExchangeSource('Manual');
    localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, value.toString());
    localStorage.setItem(STORAGE_KEYS.EXCHANGE_SOURCE, 'Manual');
  };

  const handleSourcePrefChange = (source: 'Tetherland' | 'Nobitex' | 'Auto') => {
    setPrefSource(source);
    localStorage.setItem(STORAGE_KEYS.USER_PREFERENCE_SOURCE, source);
    
    if (source === 'Tetherland' && availableRates.tetherland.status === 'ok') {
      setExchangeRate(availableRates.tetherland.price);
      setExchangeSource('Tetherland');
    } else if (source === 'Nobitex' && availableRates.nobitex.status === 'ok') {
      setExchangeRate(availableRates.nobitex.price);
      setExchangeSource('Nobitex');
    } else if (source === 'Auto') {
       if (availableRates.tetherland.status === 'ok') {
         setExchangeRate(availableRates.tetherland.price);
         setExchangeSource('Tetherland');
       } else if (availableRates.nobitex.status === 'ok') {
         setExchangeRate(availableRates.nobitex.price);
         setExchangeSource('Nobitex');
       }
    }
  };

  const handleGramAmountChange = (value: number) => {
    setGramAmount(Math.max(0, value));
    localStorage.setItem(STORAGE_KEYS.GRAM_AMOUNT, value.toString());
  };

  const handleIntervalChange = (value: number) => {
    setRefreshInterval(value);
    localStorage.setItem(STORAGE_KEYS.REFRESH_INTERVAL, value.toString());
    setTimeLeft(value);
  };

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    if (refreshInterval > 0) {
      setTimeLeft(refreshInterval);
      timerRef.current = setInterval(() => { refreshData(); }, refreshInterval);
      countdownRef.current = setInterval(() => {
        setTimeLeft(prev => Math.max(0, prev - 1000));
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [refreshInterval]);

  useEffect(() => {
    refreshData();
  }, []);

  const formatTimeLeft = (ms: number) => {
    if (ms <= 0) return "0s";
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

  const getPercentChange = (current: number, previous: number | null): { value: string, direction: 'up' | 'down' | 'none' } => {
    if (previous === null || previous === 0 || current === previous) return { value: '0.00', direction: 'none' };
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change).toFixed(2),
      direction: change > 0 ? 'up' : 'down'
    };
  };

  const valuationChange = getPercentChange(currentTotalValuation, prevValuation);
  const rateChange = getPercentChange(exchangeRate, prevExchangeRate);
  const goldChange = getPercentChange(goldPrice, prevGoldPrice);

  const isTimeCritical = timeLeft > 0 && timeLeft <= 5000;

  const renderPercentBadge = (change: { value: string, direction: 'up' | 'down' | 'none' }) => {
    if (change.direction === 'none') return null;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black shadow-sm ${change.direction === 'up' ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
        {change.direction === 'up' ? <MoveUp size={10} strokeWidth={3} /> : <MoveDown size={10} strokeWidth={3} />}
        {change.value}%
      </span>
    );
  };

  const renderSourceBadge = (source: string) => {
    const isError = source === 'None';
    const isWarning = source === 'History';
    const isSuccess = ['GoldAPI.com', 'Live', 'Nobitex', 'Tetherland', 'Swissquote'].includes(source);
    
    let colorClass = 'bg-slate-800 border-slate-700 text-slate-400';
    if (isError) colorClass = 'bg-rose-500/10 border-rose-500/30 text-rose-500';
    if (isWarning) colorClass = 'bg-amber-500/10 border-amber-500/30 text-amber-500';

    const label = source === 'GoldAPI.com' ? 'GOLD-API' :
                  source === 'Live' ? 'GOLDAPI.IO' : 
                  source === 'History' ? 'CACHED' : 
                  source === 'None' ? 'OFFLINE' : 
                  source === 'Manual' ? 'MANUAL' : 
                  source === 'Nobitex' ? 'NOBITEX' :
                  source === 'Tetherland' ? 'TETHERLAND' : 
                  source === 'Swissquote' ? 'SWISSQUOTE' :
                  source.toUpperCase();

    return (
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border shadow-inner ${colorClass}`}>
        {isSuccess ? <Database size={10} className="text-emerald-500"/> : <WifiOff size={10}/>}
        <span className="text-[8px] font-black uppercase tracking-wider">
          {label}
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col p-4 sm:p-6 md:p-8 max-w-7xl mx-auto selection:bg-amber-500/30 overflow-x-hidden relative">
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" />

      {((isInitialLoad && goldPrice === 0) || showSyncOverlay) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-md">
          <div className="flex flex-col items-center gap-6 p-10 text-center animate-pulse">
            <Loader2 size={56} className="text-amber-500 animate-spin" />
            <h2 className="text-3xl font-bold gold-gradient luxury-text uppercase tracking-widest">Aura Sync</h2>
            <p className="text-slate-500 text-sm font-medium tracking-wide">Retrieving global market metrics...</p>
          </div>
        </div>
      )}

      <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
        <div className="text-center md:text-left">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold luxury-text gold-gradient tracking-tight">
            AuraGold
          </h1>
          <div className="flex items-center justify-center md:justify-start gap-4 mt-2">
            <p className="text-slate-400 flex items-center gap-2 text-xs md:text-sm font-light">
              <Globe size={14} className="text-amber-500" /> Professional 18K Asset Analysis
            </p>
            <button 
              onClick={toggleNotifications}
              className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all text-[10px] font-black uppercase tracking-widest ${
                notificationsEnabled 
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]' 
                  : 'bg-slate-800/50 border-slate-700 text-slate-500'
              }`}
            >
              {notificationsEnabled ? <Bell size={12} className="animate-bounce" /> : <BellOff size={12} />}
              {notificationsEnabled ? 'Alerts ON' : 'Alerts OFF'}
            </button>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2 p-1 bg-slate-800/50 rounded-full border border-slate-700/50">
            <div className="px-3 py-1 flex items-center gap-2 border-r border-slate-700/50 mr-1">
              <Clock size={14} className={isTimeCritical ? 'text-rose-500 animate-pulse' : 'text-slate-500'} />
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isTimeCritical ? 'text-rose-500' : 'text-slate-500'}`}>Auto</span>
            </div>
            <div className="flex gap-1">
              {REFRESH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleIntervalChange(opt.value)}
                  className={`px-3 py-1 rounded-full text-[10px] font-black transition-all ${
                    refreshInterval === opt.value 
                      ? 'bg-amber-500 text-slate-950 shadow-lg' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={refreshData}
            disabled={isSyncing}
            className="flex items-center gap-3 px-8 py-3 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-all active:scale-95 disabled:opacity-50 w-full sm:w-auto justify-center"
          >
            <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
            <div className="flex flex-row items-center gap-1.5 sm:flex-col sm:items-start leading-none">
              <span className="font-semibold text-sm tracking-wide uppercase">
                {isSyncing ? 'SYNCING...' : 'REFRESH'}
              </span>
              {refreshInterval > 0 && (
                <span className={`text-[9px] font-bold uppercase tracking-tighter sm:mt-1 ${isTimeCritical ? 'text-rose-500 animate-pulse' : 'text-slate-500'}`}>
                   {formatTimeLeft(timeLeft)}
                </span>
              )}
            </div>
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-200 rounded-2xl flex items-center gap-3">
          <AlertCircle size={20} className="text-amber-500 shrink-0" />
          <span className="text-xs sm:text-sm font-medium">{error}</span>
        </div>
      )}

      <main className="flex-1 flex flex-col gap-6 w-full">
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/50 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden flex flex-col min-h-0 md:min-h-[220px]">
            <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -ml-16 -mt-16"></div>
            
            <div className="flex-1">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                <Coins size={14} className="text-amber-500" /> Valuation (فیمت بدون حباب)
              </h3>
              
              <div className="flex flex-col gap-4">
                <div className="relative">
                  <input 
                    type="number" 
                    step="0.01"
                    value={gramAmount || ''}
                    onChange={(e) => handleGramAmountChange(Number(e.target.value))}
                    className="w-full bg-slate-950/40 border border-slate-800 rounded-2xl py-3 px-6 text-xl font-black text-white focus:border-amber-500/40 outline-none transition-all pr-16"
                    placeholder="0.00"
                  />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-600 font-black text-[10px] uppercase">Grams</span>
                </div>

                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[10px] uppercase tracking-wider text-amber-500/70 font-black">Total IRT</p>
                    {renderPercentBadge(valuationChange)}
                  </div>
                  <div className={`text-4xl lg:text-5xl font-black text-white tracking-tighter transition-all duration-700 ${isPulsing ? 'scale-105 text-amber-400' : ''}`}>
                    {(currentTotalValuation || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/50 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden flex flex-col min-h-0 md:min-h-[220px]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
            
            <div className="flex-1">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <BarChart3 size={14} className="text-amber-500" /> Market Price (قیمت بازار)
                </h3>
                <div className="px-2 py-0.5 bg-amber-500/10 rounded-full border border-amber-500/30 text-amber-500 text-[8px] font-bold uppercase tracking-tighter">
                  WallGold Live
                </div>
              </div>
              
              <div className="flex flex-col">
                <div className="text-4xl lg:text-5xl font-black text-white">
                  {(marketPrice || 0).toLocaleString()}
                </div>
                <span className="text-[10px] font-medium text-slate-500 mt-1 uppercase">IRT / Gram Settlement</span>
                
                {marketPrice > 0 && currentPricePerGram > 0 && (
                  <div className="mt-6 flex items-center gap-3">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${Math.abs(marketDiff) >= 4 ? 'bg-rose-500/20 text-rose-400 animate-pulse border border-rose-500/30' : marketDiff >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      Spread: {marketDiff.toFixed(2)}%
                    </span>
                    <span className="text-[8px] text-slate-500 font-bold uppercase">Difference vs Formula</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/60 border border-slate-800/50 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden flex flex-col justify-center min-h-[160px]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <TrendingUp size={14} className="text-amber-500" /> Gold Spot Price
              </h3>
              {renderSourceBadge(goldSource)}
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-black text-white">
                  ${(goldPrice || 0).toLocaleString()}
                  <span className="text-[10px] font-medium text-slate-500 ml-2 uppercase">/ t oz</span>
                </div>
                <div className="mt-2">
                  {renderPercentBadge(goldChange)}
                </div>
              </div>
              <div className={`p-4 rounded-full ${goldChange.direction === 'up' ? 'bg-emerald-500/10 text-emerald-500' : goldChange.direction === 'down' ? 'bg-rose-500/10 text-rose-500' : 'bg-slate-700/50 text-slate-500'}`}>
                {goldChange.direction === 'up' ? <TrendingUp size={24} /> : goldChange.direction === 'down' ? <TrendingDown size={24} /> : <div className="w-6 h-1 bg-slate-500 rounded-full" />}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/50 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden flex flex-col justify-center min-h-[160px]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Calculator size={14} className="text-amber-500" /> Market Sources
              </h2>
              <div className="flex gap-1">
                {(['Auto', 'Tetherland', 'Nobitex'] as const).map((s) => {
                  const isUnavailable = s !== 'Auto' && availableRates[s.toLowerCase() as 'tetherland' | 'nobitex'].status === 'error' && !isSyncing && !isInitialLoad;
                  return (
                    <button
                      key={s}
                      disabled={isUnavailable}
                      onClick={() => handleSourcePrefChange(s)}
                      className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${
                        prefSource === s 
                          ? 'bg-amber-500 text-slate-950' 
                          : isUnavailable 
                            ? 'text-slate-700 cursor-not-allowed opacity-50' 
                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="relative">
                <input 
                  type="number" 
                  value={exchangeRate || ''}
                  onChange={(e) => handleExchangeRateChange(Number(e.target.value))}
                  className="w-full bg-slate-950/30 border border-slate-800 focus:border-amber-500/50 rounded-2xl py-3 px-6 text-xl font-bold text-white outline-none transition-all"
                  placeholder="0"
                />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <span className="text-[8px] font-black text-slate-600 uppercase">USDT/IRT</span>
                  {renderPercentBadge(rateChange)}
                </div>
              </div>
              <div className="flex justify-between items-center px-2">
                <span className="text-[8px] font-bold text-slate-500 uppercase">Active:</span>
                {renderSourceBadge(exchangeSource)}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-8 py-6 border-t border-slate-800/50 flex flex-col items-center gap-4">
        <div className="flex flex-wrap justify-center gap-4 text-[9px] font-bold text-slate-600 uppercase tracking-widest">
            <span>NOBITEX</span>
            <span>TETHERLAND</span>
            <span>GOLD-API</span>
            <span>GOLDAPI.IO</span>
            <span>SWISSQUOTE</span>
            <span>WALLGOLD</span>
        </div>
        <p className="text-slate-700 text-[8px] font-bold tracking-[0.5em] uppercase text-center">
          AuraGold © 2025 Market Precision
        </p>
      </footer>
    </div>
  );
};

export default App;