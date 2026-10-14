import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchBinanceTickers, fetchBybitTickers, fetchKlines, fetchKlinesLong, fetchFearGreed } from '../services/api';
import { analyze } from '../utils/indicators';
import { deepAnalyze } from '../utils/model';

const HT = { '15m': '1h', '1h': '4h', '4h': '1d' };
const FEE = 0.001;
const dirOf = (t) => (t.side === 'long' ? 1 : -1);
const pnlOf = (t, price) => (price - t.entry) / t.entry * t.size * dirOf(t);
const closeT = (t, price, reason) => ({ ...t, status: 'closed', exit: price, reason,
  pnl: (t.realized || 0) + pnlOf(t, price) - t.size * FEE, closedAt: Date.now() });

export const useStore = create(persist((set, get) => ({
  settings: { capital: 10000, minConfidence: 60, interval: '1h', proxyUrl: '', token: '', riskPct: 1 },
  trades: [], favorites: [],
  tickers: {}, analysis: {}, deep: {}, deepBusy: {}, fng: null, loading: false, scanning: false,

  setSettings: (p) => set(s => ({ settings: { ...s.settings, ...p }, ...(p.interval ? { deep: {} } : {}) })),
  resetTrades: () => set({ trades: [] }),
  toggleFav: (key) => set(s => ({ favorites: s.favorites.includes(key) ? s.favorites.filter(k => k !== key) : [...s.favorites, key] })),

  refreshTickers: async () => {
    const res = await Promise.allSettled([fetchBinanceTickers(), fetchBybitTickers()]);
    const map = {};
    res.forEach(r => r.status === 'fulfilled' && r.value.forEach(t => { map[t.key] = t; }));
    if (Object.keys(map).length) { set({ tickers: map }); get().checkTrades(); }
  },
  refreshFng: async () => { try { set({ fng: await fetchFearGreed() }); } catch (e) {} },

  analyzeTop: async (n = 15) => {
    set({ loading: true });
    const { tickers, settings } = get();
    const top = Object.values(tickers).sort((a, b) => b.volume - a.volume);
    const pick = ['Binance', 'Bybit'].flatMap(ex => top.filter(t => t.exchange === ex).slice(0, n));
    const out = {};
    await Promise.all(pick.map(async t => {
      try {
        const [k, h] = await Promise.all([fetchKlines(t.exchange, t.symbol, settings.interval), fetchKlines(t.exchange, t.symbol, HT[settings.interval])]);
        out[t.key] = analyze(k, t, h);
      } catch (e) {}
    }));
    set(s => ({ analysis: { ...s.analysis, ...out }, loading: false }));
  },

  // تحليل عميق: تاريخ طويل + تعلّم آلي + اختبار خارج العينة
  deepAnalyze: async (key, pages = 3) => {
    const t = get().tickers[key]; if (!t || get().deepBusy[key]) return;
    const interval = get().settings.interval;
    set(s => ({ deepBusy: { ...s.deepBusy, [key]: true } }));
    try {
      const k = await fetchKlinesLong(t.exchange, t.symbol, interval, pages);
      await new Promise(r => setTimeout(r, 0));
      const res = deepAnalyze(k);
      if (res) set(s => ({ deep: { ...s.deep, [key]: { ...res, interval, time: Date.now() } } }));
    } catch (e) {}
    set(s => ({ deepBusy: { ...s.deepBusy, [key]: false } }));
  },
  deepScan: async (n = 15) => {
    if (get().scanning) return;
    set({ scanning: true, deep: {} });
    const { tickers } = get();
    const top = Object.values(tickers).sort((a, b) => b.volume - a.volume);
    const pick = ['Binance', 'Bybit'].flatMap(ex => top.filter(t => t.exchange === ex).slice(0, n));
    for (const t of pick) await get().deepAnalyze(t.key, 2);
    set({ scanning: false });
  },

  openTrade: ({ key, symbol, exchange, side, entry, tp, tp2, sl, size, prob }) => set(s => ({
    trades: [{ id: String(Date.now()), key, symbol, exchange, side, entry, tp, tp2, sl, sl0: sl, size, prob,
               realized: -size * FEE, tp1Hit: false, status: 'open', openedAt: Date.now() }, ...s.trades] })),

  closeTrade: (id, price, reason = 'يدوي') => set(s => ({
    trades: s.trades.map(t => t.id === id && t.status === 'open' ? closeT(t, price, reason) : t) })),

  // خروج ذكي: نصف الصفقة عند الهدف الأول، ثم نقل الوقف لنقطة الدخول، والباقي للهدف الثاني
  checkTrades: () => {
    const { trades, tickers } = get();
    if (!trades.some(t => t.status === 'open')) return;
    const next = trades.map(t => {
      if (t.status !== 'open') return t;
      const p = tickers[t.key]?.price; if (!p) return t;
      const long = t.side === 'long';
      if (long ? p <= t.sl : p >= t.sl) return closeT(t, t.sl, t.tp1Hit ? 'تعادل بعد الهدف الأول ⚖️' : 'وقف الخسارة 🛑');
      const target = t.tp1Hit || !t.tp2 ? (t.tp2 || t.tp) : t.tp;
      if (long ? p >= target : p <= target) {
        if (!t.tp1Hit && t.tp2) {
          const half = t.size / 2;
          return { ...t, tp1Hit: true, size: half, sl: t.entry, realized: (t.realized || 0) + pnlOf({ ...t, size: half }, t.tp) - half * FEE };
        }
        return closeT(t, target, t.tp2 ? 'الهدف الثاني 🎯🎯' : 'الهدف 🎯');
      }
      return t;
    });
    set({ trades: next });
  },

  balance: () => get().settings.capital
    + get().trades.reduce((a, t) => a + (t.status === 'closed' ? t.pnl : (t.realized || 0)), 0),
  livePnl: (t) => (t.realized || 0) + pnlOf(t, get().tickers[t.key]?.price ?? t.entry),
}), { name: 'crypto-store', version: 2,
      migrate: (st) => ({ ...st, settings: { ...st.settings, minConfidence: 60, riskPct: 1 }, favorites: st.favorites || [] }),
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ settings: s.settings, trades: s.trades, favorites: s.favorites }) }));
