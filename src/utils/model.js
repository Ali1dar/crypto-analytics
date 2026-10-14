// مختبر النماذج: 8 استراتيجيات مشهورة + نموذجان تعلّم آلي، تُقيَّم كلها على كل عملة، ويُختار الأفضل بالبيانات
// التقسيم الزمني: A تدريب (50%) | B اختيار (25%) | C اختبار نهائي لم يُستخدم في أي اختيار (25%)
import { emaSeries } from './indicators';

const clip = (x, a) => Math.max(-a, Math.min(a, x));
const FEE = 0.001, BARRIER = 1.5;

export const MODEL_NAMES = {
  trend: 'تتبع الاتجاه (EMA + ADX)', tsmom: 'زخم السلاسل الزمنية', donchian: 'كسر قناة دونشيان (السلاحف)',
  rsirev: 'ارتداد RSI', bbrev: 'ارتداد بولينجر', macd: 'زخم MACD', squeeze: 'انفجار الانضغاط',
  volspike: 'اندفاع الحجم', logit: 'انحدار لوجستي (ML)', knn: 'الجيران الأقرب (ML)',
};

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
      dxs.push(dx); a = dxs.length <= p ? dxs.reduce((x,y)=>x+y,0)/dxs.length : (a*(p-1)+dx)/p; out[i] = a;
    }
  }
  return out;
}

function buildSeries(k) {
  const n = k.length, c = k.map(x => x.c), v = k.map(x => x.v);
  const e20 = emaSeries(c,20), e50 = emaSeries(c,50), e200 = emaSeries(c,200);
  const e12 = emaSeries(c,12), e26 = emaSeries(c,26);
  const ml = c.map((_,i) => e12[i]-e26[i]), ms = emaSeries(ml,9);
  const atr = new Array(n).fill(0); let s = 0;
  for (let i = 0; i < n; i++) { s += k[i].h-k[i].l; if (i >= 14) s -= k[i-14].h-k[i-14].l; atr[i] = s / Math.min(i+1, 14); }
  const pb = new Array(n).fill(0.5), bw = new Array(n).fill(0), vr = new Array(n).fill(1), hh = new Array(n).fill(0), ll = new Array(n).fill(0);
  for (let i = 20; i < n; i++) {
    let m = 0, av = 0, mx = -Infinity, mn = Infinity;
    for (let j = i-19; j <= i; j++) { m += c[j]; av += v[j]; }
    m /= 20; av /= 20;
    let sd = 0; for (let j = i-19; j <= i; j++) sd += (c[j]-m)**2; sd = Math.sqrt(sd/20);
    pb[i] = sd === 0 ? 0.5 : (c[i]-(m-2*sd))/(4*sd); bw[i] = m ? 4*sd/m : 0; vr[i] = (v[i]+1e-9)/(av+1e-9);
    for (let j = i-20; j < i; j++) { mx = Math.max(mx, k[j].h); mn = Math.min(mn, k[j].l); }
    hh[i] = mx; ll[i] = mn;
  }
  return { n, c, e20, e50, e200, ml, ms, rs: rsiSeries(c), ad: adxSeries(k), atr, pb, bw, vr, hh, ll };
}

function features(S) {
  const rows = [];
  for (let i = 200; i < S.n; i++) {
    const a = S.atr[i] || 1e-9; let aa = 0;
    for (let j = i-99; j <= i; j++) aa += S.atr[j]; aa /= 100;
    rows.push({ i, f: [
      (S.rs[i]-50)/50, clip((S.c[i]-S.e20[i])/a,5)/5, clip((S.e20[i]-S.e50[i])/a,8)/8, clip((S.c[i]-S.e200[i])/a,20)/20,
      clip((S.ml[i]-S.ms[i])/a,2)/2, clip(S.pb[i]-0.5,1), S.ad[i]/50, clip(Math.log(S.vr[i]),2)/2,
      clip((S.c[i]-S.c[i-5])/a,6)/6, clip(a/(aa||1)-1,1) ] });
  }
  return rows;
}

// إشارات الاستراتيجيات الكلاسيكية: +1 شراء، -1 بيع، 0 لا شيء
function ruleSignals(S) {
  const n = S.n, T = {};
  ['trend','tsmom','donchian','rsirev','bbrev','macd','squeeze','volspike'].forEach(id => { T[id] = new Int8Array(n); });
  for (let i = 200; i < n; i++) {
    const a = S.atr[i] || 1e-9, c = S.c[i], ad = S.ad[i];
    T.trend[i] = ad > 20 && S.e20[i] > S.e50[i] && c > S.e200[i] ? 1 : ad > 20 && S.e20[i] < S.e50[i] && c < S.e200[i] ? -1 : 0;
    const x = (c - S.c[i-48]) / a; T.tsmom[i] = x > 4 ? 1 : x < -4 ? -1 : 0;
    T.donchian[i] = c > S.hh[i] ? 1 : c < S.ll[i] ? -1 : 0;
    T.rsirev[i] = S.rs[i] < 30 ? 1 : S.rs[i] > 70 ? -1 : 0;
    T.bbrev[i] = S.pb[i] < 0.02 ? 1 : S.pb[i] > 0.98 ? -1 : 0;
    const h = S.ml[i]-S.ms[i], hp = S.ml[i-1]-S.ms[i-1];
    T.macd[i] = h > 0 && hp <= 0 && ad > 15 ? 1 : h < 0 && hp >= 0 && ad > 15 ? -1 : 0;
    const w = S.bw.slice(i-120, i).sort((p, q) => p - q), p20 = w[Math.floor(w.length*0.2)];
    if (S.bw[i-1] <= p20) T.squeeze[i] = S.pb[i] > 1 ? 1 : S.pb[i] < 0 ? -1 : 0;
    const r = (c - S.c[i-1]) / a; T.volspike[i] = S.vr[i] > 2 && r > 1 ? 1 : S.vr[i] > 2 && r < -1 ? -1 : 0;
  }
  const out = {};   // الإشارة تبقى صالحة 3 شموع
  for (const id in T) { const o = new Int8Array(n); for (let i = 0; i < n; i++) for (let j = 0; j < 3 && i-j >= 0; j++) if (T[id][i-j] !== 0) { o[i] = T[id][i-j]; break; } out[id] = o; }
  return out;
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
const lrP = (mod, f) => 1/(1+Math.exp(-(mod.b + mod.w.reduce((s,wj,j) => s + wj*f[j], 0))));
const knnP = (db, f, K = 25) => {
  const ds = db.map(s => { let d = 0; for (let j = 0; j < f.length; j++) d += (s.f[j]-f[j])**2; return [d, s.y]; });
  ds.sort((a, b) => a[0] - b[0]); let u = 0; for (let j = 0; j < K; j++) u += ds[j][1]; return u / K;
};
const toSig = (p, thr) => (p >= thr ? 1 : p <= 1-thr ? -1 : 0);

function label(k, i, a, H) {
  const up = k[i].c + BARRIER*a, dn = k[i].c - BARRIER*a;
  for (let j = i+1; j <= i+H && j < k.length; j++) {
    const hu = k[j].h >= up, hd = k[j].l <= dn;
    if (hu && hd) return null;
    if (hu) return 1; if (hd) return 0;
  }
  return null;
}

function evalSet(sig, set, k, atr) {
  let w = 0, l = 0, sum = 0;
  for (const s of set) {
    const g = sig[s.i]; if (!g) continue;
    const win = (g === 1) === (s.y === 1);
    sum += (win ? 1 : -1) - 2*FEE*k[s.i].c/(BARRIER*atr[s.i]);
    win ? w++ : l++;
  }
  const n = w + l; return { n, precision: n ? w/n*100 : 0, exp: n ? sum/n : 0 };
}

export function deepAnalyze(k, H = 12, thr = 0.58) {
  if (k.length < 600) return null;
  const S = buildSeries(k), rows = features(S);
  const smp = [];
  for (const r of rows) { if (r.i + H >= k.length) continue; const y = label(k, r.i, S.atr[r.i], H); if (y !== null) smp.push({ f: r.f, y, i: r.i }); }
  if (smp.length < 300) return null;
  const N = smp.length, cA = Math.floor(N*0.5), cB = Math.floor(N*0.75);
  const A = smp.slice(0, cA - H), B = smp.slice(cA, cB), C = smp.slice(cB), BC = smp.slice(cA);

  // 1) الإشارات: استراتيجيات + ML مُدرَّب على A فقط
  const sigs = ruleSignals(S);
  const mLR = trainLR(A.map(s => s.f), A.map(s => s.y));
  sigs.logit = new Int8Array(S.n); sigs.knn = new Int8Array(S.n);
  for (const s of BC) { sigs.logit[s.i] = toSig(lrP(mLR, s.f), thr); sigs.knn[s.i] = toSig(knnP(A, s.f), thr); }

  // 2) تقييم كل نموذج: التحقق B (للاختيار) والاختبار C (للتقرير فقط)
  const table = Object.keys(sigs).map(id => ({ id, name: MODEL_NAMES[id], val: evalSet(sigs[id], B, k, S.atr), test: evalSet(sigs[id], C, k, S.atr) }));
  table.sort((a, b) => b.val.exp - a.val.exp);
  const chosen = table.filter(m => m.val.n >= 10 && m.val.exp > 0).slice(0, 3);
  chosen.forEach(m => { m.chosen = true; });

  // 3) التصويت: إشارة المجموعة تحتاج اتفاق نموذجين على الأقل
  const vote = (get) => { const sum = chosen.reduce((s, m) => s + get(m.id), 0); return chosen.length === 1 ? Math.sign(sum) : Math.abs(sum) >= 2 ? Math.sign(sum) : 0; };
  const ens = new Int8Array(S.n);
  for (const s of C) ens[s.i] = vote(id => sigs[id][s.i]);
  const test = chosen.length ? evalSet(ens, C, k, S.atr) : { n: 0, precision: 0, exp: 0 };

  // 4) الإشارة الحالية: ML يُعاد تدريبه على كامل التاريخ
  const last = rows[rows.length-1].f, mAll = trainLR(smp.map(s => s.f), smp.map(s => s.y));
  const live = { logit: toSig(lrP(mAll, last), thr), knn: toSig(knnP(smp, last), thr) };
  const liveSig = (id) => (id in live ? live[id] : sigs[id][S.n-1]);
  const dirNum = chosen.length ? vote(liveSig) : 0;
  const direction = dirNum === 1 ? 'up' : dirNum === -1 ? 'down' : 'neutral';
  const emp = test.n >= 15 ? test.precision : 50;                    // الاحتمال = الدقة التجريبية الفعلية خارج العينة
  const pUp = direction === 'up' ? emp/100 : direction === 'down' ? 1 - emp/100 : 0.5;

  const nowAtr = S.atr[k.length-1], hist = S.atr.slice(200);
  let mv = 0, cnt = 0; for (let i = 200; i + H < k.length; i++) { mv += Math.abs(k[i+H].c-k[i].c)/k[i].c; cnt++; }
  const up = C.filter(s => s.y === 1).length / C.length;
  return { candles: k.length, samples: N, models: table, chosenNames: chosen.map(m => m.name),
    n: test.n, precision: test.precision, exp: test.exp, coverage: test.n/C.length*100,
    baseline: Math.max(up, 1-up)*100, pUp, prob: Math.max(pUp, 1-pUp)*100, direction,
    validated: chosen.length > 0 && test.n >= 15 && test.precision >= 55 && test.exp > 0, thr, H,
    atrNow: nowAtr, atrPct: nowAtr/k[k.length-1].c*100,
    volRank: hist.filter(x => x <= nowAtr).length/hist.length*100, avgMove: cnt ? mv/cnt*100 : 0 };
}
