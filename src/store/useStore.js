import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchBinanceTickers, fetchBybitTickers, fetchKlines } from '../services/api';
import { analyze, backtest } from '../utils/indicators';

const HT = { '15m': '1h', '1h': '4h', '4h': '1d' };
const pnlOf = (t, price) => (price - t.entry) / t.entry * t.size * (t.side === 'long' ? 1 : -1);

export const useStore = create(persist((set, get) => ({
  settings: { capital: 10000, minConfidence: 70, interval: '1h', proxyUrl: '', token: '' },
  trades: [],
  tickers: {}, analysis: {}, loading: false, scan: {}, scanning: false,

  setSettings: (p) => set(s => ({ settings: { ...s.settings, ...p }, ...(p.interval ? { scan: {} } : {}) })),
  resetTrades: () => set({ trades: [] }),

  refreshTickers: async () => {
    const res = await Promise.allSettled([fetchBinanceTickers(), fetchBybitTickers()]);
    const map = {};
    res.forEach(r => r.status === 'fulfilled' && r.value.forEach(t => { map[t.key] = t; }));
    if (Object.keys(map).length) { set({ tickers: map }); get().checkTrades(); }
  },

  analyzeTop: async (n = 15) => {
    set({ loading: true });
    const { tickers, settings } = get();
    const top = Object.values(tickers).sort((a,b) => b.volume - a.volume);
    const pick = ['Binance','Bybit'].flatMap(ex => top.filter(t => t.exchange === ex).slice(0, n));
    const out = {};
    await Promise.all(pick.map(async t => {
      try {
        const [k, h] = await Promise.all([fetchKlines(t.exchange, t.symbol, settings.interval), fetchKlines(t.exchange, t.symbol, HT[settings.interval])]);
        out[t.key] = analyze(k, t, h);
      } catch (e) {}
    }));
    set(s => ({ analysis: { ...s.analysis, ...out }, loading: false }));
  },

  runScan: async (n = 15) => {
    if (get().scanning) return;
    set({ scanning: true, scan: {} });
    const { tickers, settings } = get();
    const top = Object.values(tickers).sort((a, b) => b.volume - a.volume);
    const pick = ['Binance', 'Bybit'].flatMap(ex => top.filter(t => t.exchange === ex).slice(0, n));
    for (const t of pick) {
      try {
        const k = await fetchKlines(t.exchange, t.symbol, settings.interval, 1000);
        const r = backtest(k);
        set(st => ({ scan: { ...st.scan, [t.key]: r } }));
      } catch (e) {}
      await new Promise(r => setTimeout(r, 0));
    }
    set({ scanning: false });
  },

  openTrade: ({ key, symbol, exchange, side, entry, tp, sl }) => {
    const size = get().balance() * 0.1; // 10% من الرصيد لكل صفقة
    set(s => ({ trades: [{ id: String(Date.now()), key, symbol, exchange, side, entry, tp, sl, size,
                           status: 'open', openedAt: Date.now() }, ...s.trades] }));
  },

  closeTrade: (id, price, reason = 'يدوي') => set(s => ({
    trades: s.trades.map(t => t.id === id && t.status === 'open'
      ? { ...t, status: 'closed', exit: price, reason, pnl: pnlOf(t, price), closedAt: Date.now() } : t) })),

  checkTrades: () => {
    const { trades, tickers, closeTrade } = get();
    trades.filter(t => t.status === 'open').forEach(t => {
      const p = tickers[t.key]?.price; if (!p) return;
      const long = t.side === 'long';
      if (long ? p >= t.tp : p <= t.tp) closeTrade(t.id, t.tp, 'الهدف 🎯');
      else if (long ? p <= t.sl : p >= t.sl) closeTrade(t.id, t.sl, 'وقف الخسارة 🛑');
    });
  },

  balance: () => get().settings.capital + get().trades.filter(t => t.status === 'closed').reduce((a,t) => a + t.pnl, 0),
  livePnl: (t) => pnlOf(t, get().tickers[t.key]?.price ?? t.entry),
}), { name: 'crypto-store', storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ settings: s.settings, trades: s.trades }) }));
