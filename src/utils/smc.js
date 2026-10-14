// المحرك الصارم: 3 بوابات (هيكل/سيولة SMC، تدفق مشتقات، تأكيد تنفيذ) + مصفوفة مخاطر إلزامية (RR >= 1:3)
// إذا فشل شرط واحد => NO TRADE
const L = 3, FEE = 0.001;
const atrAt = (k, i, p = 14) => { let s = 0, c = 0; for (let j = Math.max(0, i-p+1); j <= i; j++) { s += k[j].h - k[j].l; c++; } return s / c; };

export function swings(k, w = L) {
  const H = [], Lw = [];
  for (let i = w; i < k.length - w; i++) {
    let h = true, l = true;
    for (let j = 1; j <= w; j++) {
      if (k[i].h <= k[i-j].h || k[i].h <= k[i+j].h) h = false;
      if (k[i].l >= k[i-j].l || k[i].l >= k[i+j].l) l = false;
    }
    if (h) H.push({ i, p: k[i].h }); if (l) Lw.push({ i, p: k[i].l });
  }
  return { H, L: Lw };
}

// البوابة 1: سحب سيولة + Order Block + إعادة اختبار + الموقع (خصم/علاوة)
export function gate1(k) {
  const n = k.length; if (n < 80) return { pass: false, why: 'بيانات غير كافية' };
  const sw = swings(k), price = k[n-1].c, atr = atrAt(k, n-1);
  let sweep = null;
  for (let idx = n-1; idx >= n-12 && !sweep; idx--) {
    const lows = sw.L.filter(s => s.i <= idx - L - 1), highs = sw.H.filter(s => s.i <= idx - L - 1);
    const sl = lows[lows.length-1], sh = highs[highs.length-1];
    if (sl && k[idx].l < sl.p && k[idx].c > sl.p) sweep = { dir: 'up', idx, level: sl.p, extreme: k[idx].l };
    else if (sh && k[idx].h > sh.p && k[idx].c < sh.p) sweep = { dir: 'down', idx, level: sh.p, extreme: k[idx].h };
  }
  if (!sweep) return { pass: false, why: 'لا يوجد سحب سيولة حديث' };
  const up = sweep.dir === 'up';
  let j = -1;
  for (let x = sweep.idx; x < n-1; x++) { const body = up ? k[x].c - k[x].o : k[x].o - k[x].c; if (body > 1.2 * atrAt(k, x)) { j = x; break; } }
  if (j < 0) return { pass: false, why: 'لم يتشكل اندفاع بعد السحب' };
  let m = -1;
  for (let x = j-1; x >= Math.max(0, sweep.idx-3); x--) { if (up ? k[x].c < k[x].o : k[x].c > k[x].o) { m = x; break; } }
  if (m < 0) return { pass: false, why: 'لا يوجد Order Block' };
  const ob = { lo: k[m].l, hi: k[m].h };
  const inZone = price >= ob.lo - 0.3*atr && price <= ob.hi + 0.3*atr;
  if (!inZone) return { pass: false, why: 'السعر لم يعد لاختبار الـ Order Block' };
  const rec = k.length - 60, hs = sw.H.filter(s => s.i >= rec), ls = sw.L.filter(s => s.i >= rec);
  if (!hs.length || !ls.length) return { pass: false, why: 'لا يوجد نطاق واضح' };
  const hi = Math.max(...hs.map(s => s.p)), lo = Math.min(...ls.map(s => s.p));
  const pos = hi > lo ? (price - lo) / (hi - lo) : 0.5;
  if (up ? pos > 0.45 : pos < 0.55) return { pass: false, why: 'السعر في منتصف النطاق (Mid-Range)' };
  return { pass: true, dir: sweep.dir, sweep, ob, pos, atr, sw };
}

// مستويات المخاطرة: SL خلف نقطة الإبطال + ATR، TP1 عند مسبح سيولة، TP2 عند أبعد قمة/قاع في النطاق
export function riskPlan(k, g) {
  const n = k.length, price = k[n-1].c, up = g.dir === 'up', atr = g.atr;
  let sl = up ? Math.min(g.sweep.extreme, g.ob.lo) - 0.3*atr : Math.max(g.sweep.extreme, g.ob.hi) + 0.3*atr;
  let risk = Math.abs(price - sl);
  // وقف ضيق جداً يجعل RR>=3 سهلاً شكلياً لكن الضوضاء والرسوم تقتله: حد أدنى 1 ATR
  if (risk < atr) { sl = up ? price - atr : price + atr; risk = atr; }
  if (2 * FEE * price / risk > 0.25) return { pass: false, why: 'الرسوم تلتهم أكثر من 25% من المخاطرة' };
  if (!(risk > 0) || risk / price > 0.06) return { pass: false, why: 'الوقف بعيد جداً أو غير صالح' };
  const rec = n - 150;
  const pool = (up ? g.sw.H : g.sw.L).filter(s => s.i >= rec && (up ? s.p > price : s.p < price)).map(s => s.p).sort((a, b) => up ? a - b : b - a);
  if (!pool.length) return { pass: false, why: 'لا يوجد مسبح سيولة كهدف' };
  let tp1 = pool[0];
  for (let q = 0; q < pool.length - 1; q++) if (Math.abs(pool[q+1] - pool[q]) / pool[q] < 0.002) { tp1 = (pool[q] + pool[q+1]) / 2; break; }  // Equal Highs/Lows
  const far = up ? Math.max(...pool) : Math.min(...pool);
  const tp2 = up ? (far > tp1 ? far : null) : (far < tp1 ? far : null);
  if (!tp2) return { pass: false, why: 'لا توجد منطقة عرض/طلب أبعد للهدف الثاني' };
  const rr1 = Math.abs(tp1 - price) / risk, rr2 = Math.abs(tp2 - price) / risk;
  if (rr2 < 3) return { pass: false, why: `نسبة العائد للمخاطرة ${rr2.toFixed(1)} أقل من 3` };
  return { pass: true, entry: price, sl, tp1, tp2, rr1, rr2, risk };
}

// البوابة 3 (فريم 1 ساعة): FVG أو CHoCH + ارتفاع حجم
export function gate3(k, dir) {
  const n = k.length; if (n < 60) return { pass: false, why: 'بيانات 1h غير كافية' };
  const up = dir === 'up', sw = swings(k, 2);
  let fvg = false;
  for (let i = n-1; i >= n-12 && i >= 2; i--) if (up ? k[i-2].h < k[i].l : k[i-2].l > k[i].h) { fvg = true; break; }
  let choch = false;
  const cand = (up ? sw.H : sw.L).filter(s => s.i < n-6 && s.i > n-40); const ref = cand[cand.length-1];
  if (ref) for (let i = n-6; i < n; i++) if (up ? k[i].c > ref.p : k[i].c < ref.p) choch = true;
  let av = 0; for (let i = n-26; i < n-6; i++) av += k[i].v; av /= 20;
  let spike = false; for (let i = n-6; i < n; i++) if (k[i].v > 1.5 * av) spike = true;
  return { pass: (fvg || choch) && spike, fvg, choch, spike, why: !(fvg || choch) ? 'لا FVG ولا CHoCH على 1h' : !spike ? 'لا يوجد ارتفاع حجم' : '' };
}

// البوابة 2: الفائدة المفتوحة والتمويل (deriv = { oiChange%, funding, priceChange% } أو null)
export function gate2(dir, deriv) {
  if (!deriv) return { pass: false, why: 'بيانات المشتقات غير متاحة' };
  const up = dir === 'up';
  const oiOk = (up ? deriv.priceChange > 0 : deriv.priceChange < 0) && deriv.oiChange > 0.5;
  const fOk = up ? deriv.funding <= 0.0005 : deriv.funding >= -0.0005;
  return { pass: oiOk && fOk, oiOk, fOk, why: !oiOk ? 'الفائدة المفتوحة لا تؤكد الاتجاه (حركة ضعيفة/إغلاق صفقات)' : !fOk ? 'معدل التمويل متطرف ضد الصفقة' : '' };
}

export function analyzeStrict(k4, k1, deriv) {
  const out = { signal: false, gates: { g1: false, g2: false, g3: false }, score: 0, reasons: [] };
  const g = gate1(k4);
  if (!g.pass) { out.reasons.push('البوابة 1: ' + g.why); return out; }
  out.gates.g1 = true; out.dir = g.dir;
  const rp = riskPlan(k4, g);
  if (!rp.pass) { out.gates.g1 = false; out.reasons.push('المخاطرة: ' + rp.why); return out; }
  const g2 = gate2(g.dir, deriv), g3 = gate3(k1, g.dir);
  out.gates.g2 = g2.pass; out.gates.g3 = g3.pass;
  if (!g2.pass) out.reasons.push('البوابة 2: ' + g2.why);
  if (!g3.pass) out.reasons.push('البوابة 3: ' + g3.why);
  const up = g.dir === 'up';
  out.score = 15 + 15 + (up ? (g.pos <= 0.3 ? 10 : 6) : (g.pos >= 0.7 ? 10 : 6))
    + (g2.oiOk ? 15 : 0) + (g2.fOk ? 10 : 0) + (deriv && deriv.oiChange > 2 ? 5 : 0)
    + (g3.fvg ? 8 : 0) + (g3.choch ? 7 : 0) + (g3.spike ? 10 : 0) + (g3.fvg && g3.choch ? 5 : 0);
  Object.assign(out, { entry: rp.entry, sl: rp.sl, tp1: rp.tp1, tp2: rp.tp2, rr1: rp.rr1, rr2: rp.rr2, ob: g.ob, sweepLevel: g.sweep.level });
  if (g2.pass && g3.pass) {
    out.signal = true;
    out.reasons = [`سحب سيولة ${up ? 'قيعان' : 'قمم'} عند ${g.sweep.level.toPrecision(6)}`, `إعادة اختبار Order Block (${g.ob.lo.toPrecision(5)} - ${g.ob.hi.toPrecision(5)})`,
      `الموقع ${up ? 'خصم' : 'علاوة'} (${(g.pos * 100).toFixed(0)}% من النطاق)`, `OI ${deriv.oiChange.toFixed(1)}% وتمويل ${(deriv.funding * 100).toFixed(3)}%`,
      `تأكيد 1h: ${g3.fvg ? 'FVG ' : ''}${g3.choch ? 'CHoCH ' : ''}+ حجم`, `RR إلى TP2 = 1:${rp.rr2.toFixed(1)}`];
  }
  return out;
}

// اختبار تاريخي للبوابة 1 + المخاطرة فقط (بيانات OI التاريخية قصيرة والبوابة 3 تحتاج محاذاة 1h)
export function backtestStrict(k) {
  const res = []; let i = 120;
  while (i < k.length - 49) {
    const win = k.slice(Math.max(0, i - 200), i + 1), g = gate1(win);
    if (g.pass) {
      const rp = riskPlan(win, g);
      if (rp.pass) {
        const up = g.dir === 'up', e = rp.entry, risk = rp.risk; let r = 0, t1 = false, done = false;
        for (let j = i + 1; j <= i + 48 && !done; j++) {
          const hitSl = up ? k[j].l <= (t1 ? e : rp.sl) : k[j].h >= (t1 ? e : rp.sl);
          const hit1 = up ? k[j].h >= rp.tp1 : k[j].l <= rp.tp1, hit2 = up ? k[j].h >= rp.tp2 : k[j].l <= rp.tp2;
          if (hitSl) { r += t1 ? 0 : -1; done = true; }
          else if (!t1 && hit1) { t1 = true; r += 0.5 * rp.rr1; if (hit2) { r += 0.5 * rp.rr2; done = true; } }
          else if (t1 && hit2) { r += 0.5 * rp.rr2; done = true; }
        }
        if (!done) { const d = (k[i+48].c - e) * (up ? 1 : -1) / risk; r += t1 ? 0.5 * d : d; }
        res.push(r - 2 * FEE * e / risk);
        i += 12; continue;
      }
    }
    i++;
  }
  const n = res.length, w = res.filter(x => x > 0).length;
  return { n, w, expR: n ? res.reduce((a, b) => a + b, 0) / n : 0 };
}
