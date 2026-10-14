import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useStore } from '../store/useStore';
import { fetchKlines, fetchDerivs } from '../services/api';
import { analyzeStrict, backtestStrict } from '../utils/smc';
import { C, fmt } from '../theme';
import { Card, Row, Chip } from '../components';

const tick = () => new Promise(r => setTimeout(r, 0));
const topN = (n) => Object.values(useStore.getState().tickers).filter(t => t.exchange === 'Binance').sort((a, b) => b.volume - a.volume).slice(0, n);
const toJson = (t, a) => JSON.stringify({ symbol: t.symbol, direction: a.dir === 'up' ? 'LONG' : 'SHORT', confluence_score: a.score, reasons: a.reasons,
  entry: +a.entry.toPrecision(6), stop_loss: +a.sl.toPrecision(6), tp1: { price: +a.tp1.toPrecision(6), size: '50%' }, tp2: { price: +a.tp2.toPrecision(6), size: '50%' }, rr_to_tp2: +a.rr2.toFixed(1) }, null, 1);

export default function Strict() {
  const [res, setRes] = useState([]); const [busy, setBusy] = useState(false); const [prog, setProg] = useState('');
  const [count, setCount] = useState(20); const [diag, setDiag] = useState(null);
  const [bt, setBt] = useState(null); const [btBusy, setBtBusy] = useState(false); const [done, setDone] = useState(false);

  const scan = async () => {
    setBusy(true); setRes([]); setDone(false); setDiag(null); const list = topN(count), out = [];
    for (let x = 0; x < list.length; x++) {
      const t = list[x]; setProg(`${x + 1}/${list.length}`);
      try {
        const [k4, k1] = await Promise.all([fetchKlines('Binance', t.symbol, '4h', 250), fetchKlines('Binance', t.symbol, '1h', 250)]);
        let a = analyzeStrict(k4, k1, null), dv = null;
        if (a.gates.g1) { dv = await fetchDerivs(t.symbol, (k4[k4.length - 1].c / k4[k4.length - 4].c - 1) * 100); a = analyzeStrict(k4, k1, dv); }
        out.push({ t, a, dv }); setRes([...out]);
      } catch (e) {}
      await tick();
    }
    const reasons = {};
    out.filter(x => !x.a.signal).forEach(({ a }) => { const r = (a.reasons[0] || 'غير محدد').replace(/[\d.]+/g, '#'); reasons[r] = (reasons[r] || 0) + 1; });
    setDiag({ total: list.length, ok: out.length, failed: list.length - out.length, reasons });
    setBusy(false); setDone(true);
  };

  const runBt = async () => {
    setBtBusy(true); let n = 0, w = 0, sum = 0; const list = topN(count);
    for (const t of list) {
      try { const b = backtestStrict(await fetchKlines('Binance', t.symbol, '4h', 1000)); n += b.n; w += b.w; sum += b.expR * b.n; } catch (e) {}
      await tick();
    }
    setBt({ n, win: n ? w / n * 100 : 0, exp: n ? sum / n : 0 }); setBtBusy(false);
  };

  const open = (t, a) => {
    const st = useStore.getState(), bal = st.balance(), risk = bal * (st.settings.riskPct || 1) / 100;
    const dist = Math.abs(a.entry - a.sl) / a.entry, size = Math.min(risk / dist, bal * 10);
    st.openTrade({ key: t.key, symbol: t.symbol, exchange: 'Binance', side: a.dir === 'up' ? 'long' : 'short', entry: t.price, tp: a.tp1, tp2: a.tp2, sl: a.sl, size, rec: true, risk: size * dist });
    Alert.alert('تم', 'فُتحت الصفقة الوهمية. تابعها من تبويب الصفقات.');
  };

  const sigs = res.filter(r => r.a.signal);
  const near = res.filter(r => !r.a.signal && r.a.gates.g1).sort((x, y) => y.a.score - x.a.score).slice(0, 5);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 14 }}>
      <Card>
        <Text style={{ color: C.text, fontWeight: '800', fontSize: 16, marginBottom: 6 }}>🎯 المحرك الصارم (SMC + مشتقات)</Text>
        <Text style={{ color: C.dim, lineHeight: 22 }}>
          لا صفقة إلا بعد اجتياز 3 بوابات معاً: (1) سحب سيولة + Order Block على 4h في خصم/علاوة، (2) فائدة مفتوحة وتمويل مؤكدان، (3) FVG أو CHoCH مع حجم على 1h. ثم وقف خلف نقطة الإبطال و RR لا يقل عن 1:3.
        </Text>
        <Text style={{ color: C.dim, marginTop: 10, marginBottom: 6 }}>عدد العملات المفحوصة (أكثر = فرص أكثر ووقت أطول):</Text>
        <View style={{ flexDirection: 'row' }}>{[20, 50, 100].map(n => <Chip key={n} label={String(n)} active={count === n} onPress={() => setCount(n)} />)}</View>
        <TouchableOpacity onPress={scan} disabled={busy} style={{ marginTop: 10, backgroundColor: C.green, padding: 12, borderRadius: 12, alignItems: 'center' }}>
          <Text style={{ color: '#000', fontWeight: '800' }}>{busy ? `جاري الفحص... ${prog}` : `فحص أعلى ${count} عملة على Binance`}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={runBt} disabled={btBusy} style={{ marginTop: 8, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center' }}>
          <Text style={{ color: C.text }}>{btBusy ? 'جاري الاختبار التاريخي...' : `اختبار المحرك تاريخياً (4h · 1000 شمعة × ${count} عملة)`}</Text>
        </TouchableOpacity>
      </Card>

      {bt && <Card style={{ marginTop: 10 }}>
        <Text style={{ color: C.text, fontWeight: '700', marginBottom: 4 }}>نتيجة الاختبار التاريخي (البوابة 1 + المخاطرة)</Text>
        <Row a="عدد الصفقات" b={String(bt.n)} />
        <Row a="نسبة الربح" b={`${bt.win.toFixed(1)}%`} />
        <Row a="متوسط الربح للصفقة (R) بعد الرسوم" b={`${bt.exp >= 0 ? '+' : ''}${bt.exp.toFixed(2)}`} bColor={bt.exp > 0 ? C.green : C.red} />
        <Text style={{ color: bt.n < 30 ? C.yellow : bt.exp > 0 ? C.green : C.red, marginTop: 6, fontWeight: '700' }}>
          {bt.n < 30 ? '⚠️ عدد الصفقات قليل: النتيجة غير حاسمة.' : bt.exp > 0 ? '✅ ربحية تاريخية إيجابية (لا تضمن المستقبل).' : '⛔ المحرك خاسر تاريخياً على هذه العملات.'}
        </Text>
        <Text style={{ color: C.dim, fontSize: 12, marginTop: 4 }}>البوابتان 2 و3 لا يمكن اختبارهما تاريخياً هنا (بيانات OI قصيرة)، فتأثيرهما غير مثبت.</Text>
      </Card>}

      {sigs.map(({ t, a }) => (
        <Card key={t.key} style={{ marginTop: 10, borderColor: C.green }}>
          <Text style={{ color: a.dir === 'up' ? C.green : C.red, fontWeight: '800', fontSize: 17 }}>
            {t.base} · {a.dir === 'up' ? 'شراء LONG 📈' : 'بيع SHORT 📉'} · الثقة {a.score}/100
          </Text>
          <Row a="الدخول" b={fmt(a.entry)} /><Row a="الوقف" b={fmt(a.sl)} bColor={C.red} />
          <Row a="TP1 (50%) مسبح سيولة" b={fmt(a.tp1)} bColor={C.green} /><Row a="TP2 (الباقي)" b={fmt(a.tp2)} bColor={C.green} />
          <Row a="RR إلى TP2" b={`1 : ${a.rr2.toFixed(1)}`} />
          <Text selectable style={{ color: C.dim, fontSize: 11, marginTop: 6, fontFamily: 'monospace' }}>{toJson(t, a)}</Text>
          <TouchableOpacity onPress={() => open(t, a)} style={{ marginTop: 8, backgroundColor: C.green, padding: 12, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: '#000', fontWeight: '800' }}>فتح صفقة وهمية بهذه المستويات</Text>
          </TouchableOpacity>
        </Card>
      ))}

      {done && diag && diag.ok === 0 && <Card style={{ marginTop: 10, borderColor: C.red }}>
        <Text style={{ color: C.red, fontWeight: '800', lineHeight: 24 }}>تعذر جلب بيانات أي عملة. تحقق من الإنترنت، أو قد يكون Binance محجوباً على شبكتك.</Text>
      </Card>}

      {done && diag && diag.ok > 0 && sigs.length === 0 && <Card style={{ marginTop: 10, borderColor: C.yellow }}>
        <Text style={{ color: C.yellow, fontWeight: '800', fontSize: 16, lineHeight: 26 }}>
          السوق في منطقة ضوضاء (Noise Zone)، لا توجد فرص عالية الاحتمالية حالياً.
        </Text>
      </Card>}

      {done && diag && diag.ok > 0 && <Card style={{ marginTop: 10 }}>
        <Text style={{ color: C.text, fontWeight: '700', marginBottom: 4 }}>ملخص الفحص: {diag.ok} عملة{diag.failed ? ` (فشل جلب ${diag.failed})` : ''}</Text>
        {Object.entries(diag.reasons).sort((a, b) => b[1] - a[1]).map(([r, c]) => <Row key={r} a={r} b={String(c)} />)}
        <Text style={{ color: C.dim, fontSize: 12, marginTop: 6 }}>هذا يوضح أين تفشل العملات. ندرة الفرص طبيعية: شروط المحرك صارمة عمداً.</Text>
      </Card>}

      {near.length > 0 && <Text style={{ color: C.text, fontWeight: '700', marginTop: 14, marginBottom: 6 }}>الأقرب لكنها لم تكتمل ({near.length})</Text>}
      {near.map(({ t, a }) => (
        <Card key={t.key} style={{ marginBottom: 8 }}>
          <Text style={{ color: C.text, fontWeight: '700' }}>{t.base} · {a.dir === 'up' ? 'Long' : 'Short'} · {a.score}/100</Text>
          <Text style={{ color: C.dim, fontSize: 12 }}>البوابات: 1 {a.gates.g1 ? '✅' : '❌'} · 2 {a.gates.g2 ? '✅' : '❌'} · 3 {a.gates.g3 ? '✅' : '❌'}</Text>
          {a.reasons.map((r, i) => <Text key={i} style={{ color: C.yellow, fontSize: 12 }}>• {r}</Text>)}
        </Card>
      ))}
    </ScrollView>
  );
}
