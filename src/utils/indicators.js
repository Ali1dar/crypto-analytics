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

// ADX: قوة الاتجاه (>25 اتجاه قوي، <20 سوق عرضي)
export function adx(k, p = 14) {
  if (k.length < p*2+1) return 0;
  const tr = [], pd = [], md = [];
  for (let i = 1; i < k.length; i++) {
    const up = k[i].h - k[i-1].h, dn = k[i-1].l - k[i].l;
    pd.push(up > dn && up > 0 ? up : 0); md.push(dn > up && dn > 0 ? dn : 0);
    tr.push(Math.max(k[i].h-k[i].l, Math.abs(k[i].h-k[i-1].c), Math.abs(k[i].l-k[i-1].c)));
  }
  const sm = (a) => { let s = a.slice(0,p).reduce((x,y)=>x+y,0); const o=[s]; for (let i=p;i<a.length;i++){ s = s - s/p + a[i]; o.push(s);} return o; };
  const T = sm(tr), P = sm(pd), M = sm(md);
  const dx = T.map((t,i) => { const pi = 100*P[i]/t, mi = 100*M[i]/t; return pi+mi === 0 ? 0 : 100*Math.abs(pi-mi)/(pi+mi); });
  let a = dx.slice(0,p).reduce((x,y)=>x+y,0)/p;
  for (let i = p; i < dx.length; i++) a = (a*(p-1)+dx[i])/p;
  return a;
}

export function bollinger(c, p = 20) {
  const s = c.slice(-p), m = s.reduce((x,y)=>x+y,0)/s.length;
  const sd = Math.sqrt(s.reduce((x,y)=>x+(y-m)**2,0)/s.length);
  const lo = m-2*sd, hi = m+2*sd;
  return hi === lo ? 0.5 : (last(c)-lo)/(hi-lo);
}

export function safetyScore(volume, change24h) {
  let s = volume >= 1e8 ? 2 : volume >= 1e7 ? 1 : 0;
  if (Math.abs(change24h) > 8) s -= 1;
  return s >= 2 ? { level:'safe', label:'آمن جداً', icon:'🟢' }
       : s === 1 ? { level:'mid', label:'متوسط', icon:'🟡' }
       : { level:'weak', label:'ضعيف', icon:'🔴' };
}

// قلب الخوارزمية: يحسب نقاط الصعود والهبوط من الشموع فقط
export function score(k) {
  const c = k.map(x => x.c), price = last(c);
  const e20 = last(emaSeries(c,20)), e50 = last(emaSeries(c,50)), e200 = last(emaSeries(c,200));
  const r = rsi(c), m = macd(c), a = adx(k), b = bollinger(c);
  const avgVol = k.reduce((s,x) => s+x.v, 0)/k.length;
  const volHigh = last(k).v > avgVol;
  let up = 0, down = 0;
  if (r < 30 && price > e200) up += 30;
  if (r > 70 && price < e200) down += 30;
  if (m.crossUp) up += 20;
  if (m.crossDown) down += 20;
  if (price > e20 && e20 > e50) up += 15;
  if (price < e20 && e20 < e50) down += 15;
  if (b < 0.05) up += 10;          // ارتداد من أسفل بولينجر
  if (b > 0.95) down += 10;
  if (volHigh) { if (up > down) up += 20; else if (down > up) down += 20; }
  if (a > 25) { if (up > down) up += 10; else if (down > up) down += 10; }   // اتجاه قوي يؤكد
  else if (a < 20) { up *= 0.8; down *= 0.8; }                               // سوق عرضي: تقليل الثقة
  const direction = up > down ? 'up' : down > up ? 'down' : 'neutral';
  return { up, down, direction, conf: Math.min(100, Math.round(Math.max(up, down))),
           price, e20, e50, e200, rsi: r, adx: a, boll: b, volHigh, macd: m };
}

const atrOf = (k) => { const s = k.slice(-14); return s.reduce((x,y) => x+(y.h-y.l), 0)/s.length; };

// htf = شموع إطار زمني أعلى للتأكيد (Multi-timeframe)
export function analyze(klines, t, htf) {
  const s = score(klines);
  s.price = t.price;
  let conf = s.conf, mtf = 'none';
  if (htf && htf.length > 50 && s.direction !== 'neutral') {
    const h = score(htf).direction;
    if (h === s.direction) { conf += 15; mtf = 'agree'; }
    else if (h !== 'neutral') { conf -= 20; mtf = 'conflict'; }
  }
  conf = Math.max(0, Math.min(100, conf));
  const atr = atrOf(klines);
  let levels = null;
  if (s.direction !== 'neutral') {
    const d = s.direction === 'up' ? 1 : -1;
    levels = { entry:t.price, tp1:t.price + d*1.5*atr, tp2:t.price + d*3*atr, sl:t.price - d*1.2*atr };
  }
  return { direction: s.direction, confidence: conf, levels, rsi: s.rsi, e20: s.e20, e50: s.e50, e200: s.e200,
           adx: s.adx, boll: s.boll, mtf,
           macdCross: s.macd.crossUp ? 'إيجابي' : s.macd.crossDown ? 'سلبي' : 'لا يوجد',
           volHigh: s.volHigh, safety: safetyScore(t.volume, t.change), time: Date.now() };
}

// اختبار تاريخي: أهداف 1.5 ATR مقابل وقف 1.2 ATR، مع خصم رسوم 0.1% لكل جهة.
// إذا لمست الشمعة الهدف والوقف معاً تُحسب خسارة (تحفظ).
export function backtest(k, horizon = 24, minConf = 50) {
  const FEE = 0.001;
  const side = { up: { w: 0, l: 0 }, down: { w: 0, l: 0 } };
  let w = 0, l = 0, sum = 0, gp = 0, gl = 0, streak = 0, maxStreak = 0;
  for (let i = 210; i < k.length - horizon; i += 2) {
    const win = k.slice(Math.max(0, i - 300), i + 1);
    const sc = score(win);
    if (sc.direction === 'neutral' || sc.conf < minConf) continue;
    const d = sc.direction === 'up' ? 1 : -1, atr = atrOf(win), e = sc.price;
    const tp = e + d*1.5*atr, sl = e - d*1.2*atr;
    let res = 0;
    for (let j = i + 1; j <= i + horizon; j++) {
      const hitTp = d > 0 ? k[j].h >= tp : k[j].l <= tp;
      const hitSl = d > 0 ? k[j].l <= sl : k[j].h >= sl;
      if (hitSl) { res = -1; break; }
      if (hitTp) { res = 1; break; }
    }
    if (!res) continue;
    const r = ((res === 1 ? 1.5 : -1.2) * atr - 2*FEE*e) / atr;   // الربح بوحدات ATR بعد الرسوم
    sum += r;
    if (res === 1) { w++; gp += r; side[sc.direction].w++; streak = 0; }
    else { l++; gl += -r; side[sc.direction].l++; streak++; maxStreak = Math.max(maxStreak, streak); }
  }
  const n = w + l, pct = (a) => (a.w + a.l ? a.w/(a.w + a.l)*100 : 0);
  return { n, winRate: n ? w/n*100 : 0, exp: n ? sum/n : 0, pf: gl ? gp/gl : (gp ? 9.99 : 0), maxStreak,
           longWR: pct(side.up), longN: side.up.w + side.up.l, shortWR: pct(side.down), shortN: side.down.w + side.down.l };
}
