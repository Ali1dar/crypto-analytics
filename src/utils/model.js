// نموذج تعلّم آلي خفيف (انحدار لوجستي) يُدرَّب على التاريخ الطويل لكل عملة ويُختبر على بيانات لم يرها (Out-of-sample)
import { emaSeries } from './indicators';

const clip = (x, a) => Math.max(-a, Math.min(a, x));
const FEE = 0.001, BARRIER = 1.5;

function rsiSeries(c, p = 14) {
  const out = new Array(c.length).fill(50);
  if (c.length <= p) return out;
  let g = 0, l = 0;
  for (let i = 1; i <= p; i++) { const d = c[i]-c[i-1]; d >= 0 ? g += d : l -= d; }
  g /= p; l /= p; out[p] = l === 0 ? 100 : 100 - 100/(1+g/l);
  for (let i = p+1; i < c.length; i++) {
    const d = c[i]-c[i-1]; g = (g*(p-1)+Math.max(d,0))/p; l = (l*(p-1)+Math.max(-d,0))/p;
    out[i] = l === 0 ? 100 : 100 - 100/(1+g/l);
  }
  return out;
}

function adxSeries(k, p = 14) {
  const n = k.length, out = new Array(n).fill(0), dxs = [];
  let tr = 0, pd = 0, md = 0, a = 0;
  for (let i = 1; i < n; i++) {
    const up = k[i].h - k[i-1].h, dn = k[i-1].l - k[i].l;
    const P = up > dn && up > 0 ? up : 0, M = dn > up && dn > 0 ? dn : 0;
    const T = Math.max(k[i].h-k[i].l, Math.abs(k[i].h-k[i-1].c), Math.abs(k[i].l-k[i-1].c));
    if (i <= p) { tr += T; pd += P; md += M; } else { tr = tr - tr/p + T; pd = pd - pd/p + P; md = md - md/p + M; }
    if (i >= p) {
      const pi = 100*pd/tr, mi = 100*md/tr, dx = pi+mi === 0 ? 0 : 100*Math.abs(pi-mi)/(pi+mi);
      dxs.push(dx);
      a = dxs.length <= p ? dxs.reduce((x,y)=>x+y,0)/dxs.length : (a*(p-1)+dx)/p;
      out[i] = a;
    }
  }
  return out;
}

// 10 ميزات مُطبَّعة لكل شمعة: زخم، اتجاه، تقلب، حجم
export function buildFeatures(k) {
  const n = k.length, c = k.map(x => x.c), v = k.map(x => x.v);
  const e20 = emaSeries(c,20), e50 = emaSeries(c,50), e200 = emaSeries(c,200);
  const e12 = emaSeries(c,12), e26 = emaSeries(c,26);
  const ml = c.map((_,i) => e12[i]-e26[i]), ms = emaSeries(ml,9);
  const rs = rsiSeries(c), ad = adxSeries(k);
  const atr = new Array(n).fill(0); let s = 0;
  for (let i = 0; i < n; i++) { s += k[i].h-k[i].l; if (i >= 14) s -= k[i-14].h-k[i-14].l; atr[i] = s / Math.min(i+1, 14); }
  const rows = [];
  for (let i = 200; i < n; i++) {
    const a = atr[i] || 1e-9;
    let m = 0, sd = 0, av = 0, aa = 0;
    for (let j = i-19; j <= i; j++) { m += c[j]; av += v[j]; } m /= 20; av /= 20;
    for (let j = i-19; j <= i; j++) sd += (c[j]-m)**2; sd = Math.sqrt(sd/20);
    const pb = sd === 0 ? 0.5 : (c[i]-(m-2*sd))/(4*sd);
    for (let j = i-99; j <= i; j++) aa += atr[j]; aa /= 100;
    rows.push({ i, f: [
      (rs[i]-50)/50, clip((c[i]-e20[i])/a,5)/5, clip((e20[i]-e50[i])/a,8)/8, clip((c[i]-e200[i])/a,20)/20,
      clip((ml[i]-ms[i])/a,2)/2, clip(pb-0.5,1), ad[i]/50, clip(Math.log((v[i]+1e-9)/(av+1e-9)),2)/2,
      clip((c[i]-c[i-5])/a,6)/6, clip(a/(aa||1)-1,1) ] });
  }
  return { rows, atr };
}

function trainLR(X, y, iters = 250, lr = 0.4, l2 = 0.02) {
  const d = X[0].length, m = X.length; let w = new Array(d).fill(0), b = 0;
  for (let it = 0; it < iters; it++) {
    const gw = new Array(d).fill(0); let gb = 0;
    for (let r = 0; r < m; r++) {
      let z = b; for (let j = 0; j < d; j++) z += w[j]*X[r][j];
      const e = 1/(1+Math.exp(-z)) - y[r];
      for (let j = 0; j < d; j++) gw[j] += e*X[r][j]; gb += e;
    }
    for (let j = 0; j < d; j++) w[j] -= lr*(gw[j]/m + l2*w[j]); b -= lr*gb/m;
  }
  return { w, b };
}
const predict = (mod, f) => 1/(1+Math.exp(-(mod.b + mod.w.reduce((s,wj,j) => s + wj*f[j], 0))));

// الهدف: هل يلمس السعر +1.5 ATR قبل -1.5 ATR خلال H شمعة؟ (حاجز ثلاثي متماثل)
function label(k, i, a, H) {
  const up = k[i].c + BARRIER*a, dn = k[i].c - BARRIER*a;
  for (let j = i+1; j <= i+H && j < k.length; j++) {
    const hu = k[j].h >= up, hd = k[j].l <= dn;
    if (hu && hd) return null;
    if (hu) return 1; if (hd) return 0;
  }
  return null;
}

export function deepAnalyze(k, H = 12, thr = 0.58) {
  if (k.length < 500) return null;
  const { rows, atr } = buildFeatures(k);
  const smp = [];
  for (const r of rows) { if (r.i + H >= k.length) continue; const y = label(k, r.i, atr[r.i], H); if (y !== null) smp.push({ f: r.f, y, i: r.i }); }
  if (smp.length < 150) return null;
  const cut = Math.floor(smp.length * 0.7);
  const train = smp.slice(0, cut - H), test = smp.slice(cut);     // فجوة H لمنع تسرب المعلومات
  const m1 = trainLR(train.map(s => s.f), train.map(s => s.y));
  let w = 0, l = 0, sum = 0;
  for (const s of test) {
    const p = predict(m1, s.f);
    if (p < thr && p > 1-thr) continue;
    const win = (p >= thr ? 1 : 0) === s.y;
    sum += (win ? 1 : -1) - 2*FEE*k[s.i].c/(BARRIER*atr[s.i]);
    win ? w++ : l++;
  }
  const n = w + l, up = test.filter(s => s.y === 1).length / test.length;
  const m2 = trainLR(smp.map(s => s.f), smp.map(s => s.y));
  const pNow = predict(m2, rows[rows.length-1].f);
  const precision = n ? w/n*100 : 0, exp = n ? sum/n : 0;
  const nowAtr = atr[k.length-1], hist = atr.slice(200);
  let mv = 0, cnt = 0; for (let i = 200; i + H < k.length; i++) { mv += Math.abs(k[i+H].c-k[i].c)/k[i].c; cnt++; }
  return { candles: k.length, samples: smp.length, n, precision, exp, coverage: n/test.length*100,
    baseline: Math.max(up, 1-up)*100, pUp: pNow, prob: Math.max(pNow, 1-pNow)*100,
    direction: pNow >= thr ? 'up' : pNow <= 1-thr ? 'down' : 'neutral',
    validated: n >= 20 && precision >= 55 && exp > 0, thr, H,
    atrNow: nowAtr, atrPct: nowAtr/k[k.length-1].c*100,
    volRank: hist.filter(x => x <= nowAtr).length/hist.length*100, avgMove: cnt ? mv/cnt*100 : 0 };
}
