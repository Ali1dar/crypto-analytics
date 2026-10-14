import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Dimensions } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { useStore } from '../store/useStore';
import { fetchKlines } from '../services/api';
import { C, fmt, pc } from '../theme';
import { Card, Chip, Row, dirInfo } from '../components';

const MIN = { '15m': 15, '1h': 60, '4h': 240 };
const usd = (n) => `$${n.toFixed(2)}`;

export default function CoinDetail({ route, navigation }) {
  const { key } = route.params;
  const t = useStore(s => s.tickers[key]); const a = useStore(s => s.analysis[key]); const d = useStore(s => s.deep[key]);
  const busy = useStore(s => !!s.deepBusy[key]); const fav = useStore(s => s.favorites.includes(key));
  const settings = useStore(s => s.settings); const fng = useStore(s => s.fng);
  const { deepAnalyze, openTrade, toggleFav, balance } = useStore.getState();
  const [tf, setTf] = useState('1h'); const [closes, setCloses] = useState([]);
  const [ticket, setTicket] = useState(false); const [side, setSide] = useState(null); const [risk, setRisk] = useState(settings.riskPct || 1);

  useEffect(() => { navigation.setOptions({ headerRight: () => <Text style={{ fontSize: 22 }} onPress={() => toggleFav(key)}>{fav ? '⭐' : '☆'}</Text> }); }, [fav]);
  useEffect(() => { if (!d && t) deepAnalyze(key); }, [key, !!t]);
  useEffect(() => { if (t) fetchKlines(t.exchange, t.symbol, tf, 100).then(k => setCloses(k.map(x => x.c))).catch(() => {}); }, [tf, key]);
  if (!t) return null;

  const W = Dimensions.get('window').width - 56, H = 160;
  const mn = Math.min(...closes), mx = Math.max(...closes);
  const pts = closes.map((c, i) => `${(i / (closes.length - 1)) * W},${H - ((c - mn) / (mx - mn || 1)) * H}`).join(' ');
  const up = closes.length > 0 && closes[closes.length - 1] >= closes[0];

  const dir = d ? (d.validated ? d.direction : 'neutral') : a?.direction;
  const dd = dirInfo(dir);
  const sideEff = side || (dir === 'down' ? 'short' : 'long');

  // ===== حساب تذكرة الصفقة =====
  const atrv = d?.atrNow ?? a?.atr; const price = t.price; const kk = sideEff === 'long' ? 1 : -1;
  const lv = atrv ? { tp1: price + kk * 1.5 * atrv, tp2: price + kk * 3 * atrv, sl: price - kk * 1.5 * atrv } : null;
  const bal = balance(); const riskUsd = bal * risk / 100;
  const slDist = lv ? Math.abs(price - lv.sl) / price : 0;
  const size = lv ? Math.min(riskUsd / slDist, bal * 10) : 0;
  const realRisk = size * slDist, lev = size / bal, fees = 2 * size * 0.001;
  const gain1 = lv ? 0.5 * size * Math.abs(lv.tp1 - price) / price : 0;
  const gain2 = lv ? gain1 + 0.5 * size * Math.abs(lv.tp2 - price) / price : 0;
  const p = d ? (sideEff === 'long' ? d.pUp : 1 - d.pUp) : null;
  const ev = p != null ? p * realRisk - (1 - p) * realRisk - fees : null;
  const warns = [];
  if (!d) warns.push('لم يكتمل التحليل العميق بعد.');
  else if (!d.validated) warns.push('النموذج لم يثبت دقته على هذه العملة تاريخياً.');
  if (p != null && p < 0.5) warns.push('النموذج يميل عكس اتجاه الصفقة المختارة.');
  if (a?.mtf === 'conflict') warns.push('الإطار الزمني الأعلى يعاكس الاتجاه.');
  if (a?.safety.level === 'weak') warns.push('سيولة ضعيفة أو تقلب مرتفع.');
  if (d && d.volRank > 85) warns.push('التقلب الحالي أعلى من 85% من تاريخ العملة.');
  if (lev > 3) warns.push(`الحجم يتطلب رافعة ${lev.toFixed(1)}x.`);
  if (fng && (fng.value < 20 || fng.value > 80)) warns.push('السوق في حالة ' + (fng.value < 20 ? 'خوف شديد' : 'طمع شديد') + '.');

  const confirm = () => {
    if (!lv) return Alert.alert('لا توجد بيانات تقلب كافية بعد.');
    openTrade({ key, symbol: t.symbol, exchange: t.exchange, side: sideEff, entry: price, tp: lv.tp1, tp2: lv.tp2, sl: lv.sl, size, prob: p });
    setTicket(false); Alert.alert('تم', 'فُتحت الصفقة. تابعها من تبويب الصفقات.');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 14 }}>
      <Text style={{ color: C.text, fontSize: 26, fontWeight: '800' }}>{t.base}/USDT</Text>
      <Text style={{ color: t.change >= 0 ? C.green : C.red, fontSize: 20, marginBottom: 10 }}>${fmt(t.price)}  {pc(t.change)}</Text>
      <Card>
        <View style={{ flexDirection: 'row', marginBottom: 10 }}>
          {['15m', '1h', '4h', '1d'].map(x => <Chip key={x} label={x === '1d' ? '1D' : x} active={tf === x} onPress={() => setTf(x)} />)}
        </View>
        {closes.length > 1 && <Svg width={W} height={H}><Polyline points={pts} fill="none" stroke={up ? C.green : C.red} strokeWidth="2" /></Svg>}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Text style={{ color: dd.c, fontSize: 18, fontWeight: '700', marginBottom: 6 }}>
          التوقع: {dd.t}{d ? `  ·  الاحتمال ${d.prob.toFixed(0)}%` : a ? `  ·  ${a.confidence}%` : ''}
        </Text>
        {a && <Row a="مؤشر الأمان" b={`${a.safety.icon} ${a.safety.label}`} />}
        {d && <Row a="احتمال الصعود الآن" b={`${(d.pUp * 100).toFixed(0)}%`} bColor={d.pUp > 0.5 ? C.green : C.red} />}
        {busy && <Text style={{ color: C.yellow, marginTop: 6 }}>🧠 جاري تحليل التاريخ الطويل...</Text>}
      </Card>

      {d && <Card style={{ marginTop: 12 }}>
        <Text style={{ color: C.text, fontWeight: '700', marginBottom: 4 }}>🧠 التحليل العميق ({d.interval}) · {d.models.length} نماذج</Text>
        <Row a="التاريخ المحلل" b={`${d.candles} شمعة ≈ ${Math.round(d.candles * MIN[d.interval] / 1440)} يوم`} />
        <Row a="دقة النموذج على بيانات لم يرها" b={`${d.precision.toFixed(1)}% (${d.n} إشارة)`} bColor={d.precision >= 55 ? C.green : C.red} />
        <Row a="التخمين العشوائي المقابل" b={`${d.baseline.toFixed(0)}%`} />
        <Row a="متوسط الربح للصفقة بعد الرسوم" b={`${d.exp >= 0 ? '+' : ''}${d.exp.toFixed(2)} R`} bColor={d.exp > 0 ? C.green : C.red} />
        <Row a="نسبة الشموع التي أصدر فيها إشارة" b={`${d.coverage.toFixed(0)}%`} />
        <Row a="التقلب الحالي ATR" b={`${d.atrPct.toFixed(2)}% (أعلى من ${d.volRank.toFixed(0)}% من التاريخ)`} />
        <Row a={`متوسط حركة ${d.H} شمعة`} b={`${d.avgMove.toFixed(2)}%`} />
        <Text style={{ color: C.text, fontWeight: '700', marginTop: 10, marginBottom: 2 }}>ترتيب النماذج على هذه العملة</Text>
        <Text style={{ color: C.dim, fontSize: 12, marginBottom: 4 }}>الاختيار بنتيجة "التحقق"، و"الاختبار" بيانات لم تدخل في الاختيار.</Text>
        {d.models.map(m => (
          <View key={m.id} style={{ paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Text style={{ color: m.chosen ? C.green : C.text, fontWeight: m.chosen ? '700' : '400' }}>{m.chosen ? '⭐ ' : ''}{m.name}</Text>
            <Text style={{ color: C.dim, fontSize: 12 }}>
              تحقق {m.val.precision.toFixed(0)}% ({m.val.n}) · اختبار <Text style={{ color: m.test.n >= 10 ? (m.test.exp > 0 ? C.green : C.red) : C.dim }}>{m.test.precision.toFixed(0)}% ({m.test.n})</Text>
            </Text>
          </View>
        ))}
        {d.chosenNames.length > 0 && <Text style={{ color: C.dim, fontSize: 12, marginTop: 6 }}>التوصية = تصويت المختارين، وتحتاج اتفاق نموذجين على الأقل.</Text>}
        <Text style={{ color: d.validated ? C.green : C.red, marginTop: 6, fontWeight: '700' }}>
          {d.validated ? '✅ النموذج حقق دقة مقبولة خارج العينة على هذه العملة.' : '⛔ لم يتفوق النموذج بوضوح هنا، فلا تعتمد على توقعه.'}
        </Text>
        <Text style={{ color: C.dim, fontSize: 12, marginTop: 4 }}>الاختبار على آخر 30% من التاريخ لم يُستخدم في التدريب. الأداء السابق لا يضمن المستقبل.</Text>
        <TouchableOpacity onPress={() => deepAnalyze(key, 4)} style={{ marginTop: 8, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: 'center' }}>
          <Text style={{ color: C.text }}>{busy ? 'جاري التحليل...' : 'إعادة التحليل بتاريخ أطول'}</Text>
        </TouchableOpacity>
      </Card>}

      {a && <Card style={{ marginTop: 12 }}>
        <Text style={{ color: C.text, fontWeight: '700', marginBottom: 4 }}>المؤشرات الفنية</Text>
        <Row a="RSI" b={`${a.rsi.toFixed(1)} ${a.rsi > 70 ? '(إشباع شراء)' : a.rsi < 30 ? '(إشباع بيع)' : ''}`} />
        <Row a="EMA 20 / 50 / 200" b={`${fmt(a.e20)} / ${fmt(a.e50)} / ${fmt(a.e200)}`} />
        <Row a="ADX" b={`${a.adx.toFixed(0)} ${a.adx > 25 ? '(قوي)' : a.adx < 20 ? '(عرضي)' : ''}`} />
        <Row a="الإطار الأعلى" b={a.mtf === 'agree' ? 'متوافق ✅' : a.mtf === 'conflict' ? 'متعارض ⚠️' : '—'} />
        <Row a="تقاطع MACD" b={a.macdCross} /><Row a="الحجم أعلى من المتوسط" b={a.volHigh ? 'نعم' : 'لا'} />
      </Card>}

      {!ticket ? (
        <TouchableOpacity onPress={() => setTicket(true)} style={{ backgroundColor: C.green, borderRadius: 14, padding: 16, marginTop: 16, alignItems: 'center' }}>
          <Text style={{ color: '#000', fontSize: 17, fontWeight: '800' }}>تجهيز صفقة وهمية</Text>
        </TouchableOpacity>
      ) : (
        <Card style={{ marginTop: 16, borderColor: C.green }}>
          <Text style={{ color: C.text, fontWeight: '800', fontSize: 17, marginBottom: 8 }}>🧾 تذكرة الصفقة</Text>
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            <Chip label="Long شراء" active={sideEff === 'long'} onPress={() => setSide('long')} />
            <Chip label="Short بيع" active={sideEff === 'short'} onPress={() => setSide('short')} />
          </View>
          <Text style={{ color: C.dim, marginBottom: 4 }}>المخاطرة من الرصيد:</Text>
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            {[0.5, 1, 2].map(n => <Chip key={n} label={n + '%'} active={risk === n} onPress={() => setRisk(n)} />)}
          </View>
          {lv ? <>
            <Row a="سعر الدخول" b={fmt(price)} />
            <Row a="الهدف الأول (نصف الصفقة)" b={`${fmt(lv.tp1)}  (+${usd(gain1)})`} bColor={C.green} />
            <Row a="الهدف الثاني (الباقي)" b={`${fmt(lv.tp2)}  (+${usd(gain2)})`} bColor={C.green} />
            <Row a="وقف الخسارة" b={`${fmt(lv.sl)}  (-${usd(realRisk)})`} bColor={C.red} />
            <Row a="حجم الصفقة" b={`${usd(size)}  (${lev.toFixed(1)}x)`} />
            <Row a="نسبة العائد للمخاطرة" b={`1 : ${(gain2 / realRisk).toFixed(1)}`} />
            <Row a="الرسوم المتوقعة" b={usd(fees)} />
            {ev != null && <Row a="القيمة المتوقعة (EV)" b={`${ev >= 0 ? '+' : ''}${usd(ev)}`} bColor={ev > 0 ? C.green : C.red} />}
            <Text style={{ color: C.dim, fontSize: 12, marginTop: 4 }}>عند الهدف الأول يُغلق نصف الصفقة ويُنقل الوقف لنقطة الدخول (لا خسارة على الباقي).</Text>
            {warns.map((w, i) => <Text key={i} style={{ color: C.yellow, marginTop: 4 }}>⚠️ {w}</Text>)}
            <TouchableOpacity onPress={confirm} style={{ backgroundColor: C.green, borderRadius: 12, padding: 14, marginTop: 12, alignItems: 'center' }}>
              <Text style={{ color: '#000', fontWeight: '800' }}>تأكيد فتح الصفقة</Text>
            </TouchableOpacity>
          </> : <Text style={{ color: C.dim }}>انتظر اكتمال التحليل لحساب مستويات الدخول.</Text>}
          <TouchableOpacity onPress={() => setTicket(false)} style={{ marginTop: 8, alignItems: 'center', padding: 8 }}><Text style={{ color: C.dim }}>إلغاء</Text></TouchableOpacity>
        </Card>
      )}
    </ScrollView>
  );
}
