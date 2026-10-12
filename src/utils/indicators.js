export const emaSeries = (v, p) => { const k = 2/(p+1), o = []; v.forEach((x,i) => o.push(i===0 ? x : x*k + o[i-1]*(1-k))); return o; };
const last = (a) => a[a.length - 1];

export function rsi(c, p = 14) {
  if (c.length <= p) return 50;
  let g = 0, l = 0;
  for (let i = 1; i <= p; i++) { const d = c[i]-c[i-1]; d >= 0 ? g += d : l -= d; }
  g /= p; l /= p;
  for (let i = p+1; i < c.length; i++) { const d = c[i]-c[i-1]; g = (g*(p-1)+Math.max(d,0))/p; l = (l*(p-1)+Math.max(-d,0))/p; }
  return l === 0 ? 100 : 100 - 100/(1+g/l);
}

export function macd(c) {
  const e12 = emaSeries(c,12), e26 = emaSeries(c,26);
  const line = c.map((_,i) => e12[i]-e26[i]);
  const sig = emaSeries(line, 9);
  const n = line.length;
  return { crossUp: n>1 && line[n-2]<=sig[n-2] && line[n-1]>sig[n-1],
           crossDown: n>1 && line[n-2]>=sig[n-2] && line[n-1]<sig[n-1] };
}

export function safetyScore(volume, change24h) {
  let s = volume >= 1e8 ? 2 : volume >= 1e7 ? 1 : 0;      // السيولة
  if (Math.abs(change24h) > 8) s -= 1;                     // التقلب العالي
  return s >= 2 ? { level:'safe', label:'آمن جداً', icon:'🟢' }
       : s === 1 ? { level:'mid', label:'متوسط', icon:'🟡' }
       : { level:'weak', label:'ضعيف', icon:'🔴' };
}

// الخوارزمية: Confluence Score حسب المواصفات
export function analyze(klines, t) {
  const c = klines.map(k => k.c), price = t.price;
  const e20 = last(emaSeries(c,20)), e50 = last(emaSeries(c,50)), e200 = last(emaSeries(c,200));
  const r = rsi(c), m = macd(c);
  const avgVol = klines.reduce((s,k) => s+k.v, 0)/klines.length;
  const volHigh = last(klines).v > avgVol;
  let up = 0, down = 0;
  if (r < 30 && price > e200) up += 30;
  if (r > 70 && price < e200) down += 30;
  if (m.crossUp) up += 20;
  if (m.crossDown) down += 20;
  if (price > e20 && e20 > e50) up += 15;
  if (price < e20 && e20 < e50) down += 15;
  if (volHigh) { if (up > down) up += 20; else if (down > up) down += 20; }
  const direction = up > down ? 'up' : down > up ? 'down' : 'neutral';
  const confidence = Math.min(100, Math.max(up, down));
  const slice = klines.slice(-14);
  const atr = slice.reduce((s,k) => s + (k.h-k.l), 0)/slice.length;
  let levels = null;
  if (direction !== 'neutral') {
    const d = direction === 'up' ? 1 : -1;
    levels = { entry:price, tp1:price + d*1.5*atr, tp2:price + d*3*atr, sl:price - d*1.2*atr };
  }
  return { direction, confidence, levels, rsi:r, e20, e50, e200,
           macdCross: m.crossUp ? 'إيجابي' : m.crossDown ? 'سلبي' : 'لا يوجد',
           volHigh, safety: safetyScore(t.volume, t.change), time: Date.now() };
}
