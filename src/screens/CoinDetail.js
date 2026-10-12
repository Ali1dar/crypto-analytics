import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Dimensions } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { useStore } from '../store/useStore';
import { fetchKlines } from '../services/api';
import { C, fmt, pc } from '../theme';
import { Card, Chip, Row, dirInfo } from '../components';

export default function CoinDetail({ route }) {
  const { key } = route.params;
  const t = useStore(s => s.tickers[key]); const a = useStore(s => s.analysis[key]);
  const openTrade = useStore(s => s.openTrade);
  const [tf, setTf] = useState('1h'); const [closes, setCloses] = useState([]);

  useEffect(() => { if (t) fetchKlines(t.exchange, t.symbol, tf, 100).then(k => setCloses(k.map(x => x.c))).catch(() => {}); }, [tf, key]);
  if (!t) return null;

  const W = Dimensions.get('window').width - 56, H = 160;
  const mn = Math.min(...closes), mx = Math.max(...closes);
  const pts = closes.map((c, i) => `${(i/(closes.length-1))*W},${H - ((c-mn)/(mx-mn || 1))*H}`).join(' ');
  const up = closes.length > 0 && closes[closes.length-1] >= closes[0];
  const d = dirInfo(a?.direction);

  const open = () => {
    if (!a?.levels) return Alert.alert('لا توجد توصية', 'التوقع الحالي محايد.');
    openTrade({ key, symbol: t.symbol, exchange: t.exchange, side: a.direction === 'up' ? 'long' : 'short',
                entry: t.price, tp: a.levels.tp1, sl: a.levels.sl });
    Alert.alert('تم', 'تم فتح صفقة وهمية. تابعها من تبويب الصفقات.');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 14 }}>
      <Text style={{ color: C.text, fontSize: 26, fontWeight: '800' }}>{t.base}/USDT</Text>
      <Text style={{ color: t.change >= 0 ? C.green : C.red, fontSize: 20, marginBottom: 10 }}>${fmt(t.price)}  {pc(t.change)}</Text>
      <Card>
        <View style={{ flexDirection: 'row', marginBottom: 10 }}>
          {['15m','1h','4h','1d'].map(x => <Chip key={x} label={x === '1d' ? '1D' : x} active={tf===x} onPress={() => setTf(x)} />)}
        </View>
        {closes.length > 1 && <Svg width={W} height={H}><Polyline points={pts} fill="none" stroke={up ? C.green : C.red} strokeWidth="2" /></Svg>}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Text style={{ color: d.c, fontSize: 18, fontWeight: '700', marginBottom: 6 }}>التوقع: {d.t}  ·  الثقة {a ? a.confidence : '—'}%</Text>
        {a && <Row a="مؤشر الأمان" b={`${a.safety.icon} ${a.safety.label}`} />}
        {a?.levels ? <>
          <Row a="سعر الدخول" b={fmt(a.levels.entry)} />
          <Row a="الهدف الأول TP1" b={fmt(a.levels.tp1)} bColor={C.green} />
          <Row a="الهدف الثاني TP2" b={fmt(a.levels.tp2)} bColor={C.green} />
          <Row a="وقف الخسارة SL" b={fmt(a.levels.sl)} bColor={C.red} />
        </> : <Text style={{ color: C.dim }}>لا توجد مستويات: الإشارة محايدة.</Text>}
      </Card>

      {a && <Card style={{ marginTop: 12 }}>
        <Text style={{ color: C.text, fontWeight: '700', marginBottom: 4 }}>التحليل الفني</Text>
        <Row a="RSI" b={`${a.rsi.toFixed(1)} ${a.rsi > 70 ? '(إشباع شراء)' : a.rsi < 30 ? '(إشباع بيع)' : ''}`} />
        <Row a="EMA 20" b={fmt(a.e20)} /><Row a="EMA 50" b={fmt(a.e50)} /><Row a="EMA 200" b={fmt(a.e200)} />
        <Row a="تقاطع MACD" b={a.macdCross} /><Row a="الحجم أعلى من المتوسط" b={a.volHigh ? 'نعم' : 'لا'} />
      </Card>}

      <TouchableOpacity onPress={open} style={{ backgroundColor: C.green, borderRadius: 14, padding: 16, marginTop: 16, alignItems: 'center' }}>
        <Text style={{ color: '#000', fontSize: 17, fontWeight: '800' }}>فتح صفقة وهمية</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
