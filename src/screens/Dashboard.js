import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useStore } from '../store/useStore';
import { C, fmt, pc } from '../theme';
import { Card, Chip, dirInfo } from '../components';

const RANK = ['weak', 'mid', 'safe'];
const FNG = { 'Extreme Fear': 'خوف شديد', Fear: 'خوف', Neutral: 'محايد', Greed: 'طمع', 'Extreme Greed': 'طمع شديد' };

export default function Dashboard({ navigation }) {
  const { tickers, analysis, deep, settings, loading, analyzeTop, scanning, deepScan, fng, favorites, toggleFav } = useStore();
  const [q, setQ] = useState(''); const [ex, setEx] = useState('all'); const [sort, setSort] = useState('vol');

  const view = (t) => {
    const a = analysis[t.key], d = deep[t.key];
    if (d) {
      const ok = d.validated && d.prob >= settings.minConfidence;
      return { dir: ok ? d.direction : 'neutral', conf: d.prob.toFixed(0) + '%',
        tag: d.validated ? { t: `✅ نموذج مُثبت: دقة ${d.precision.toFixed(0)}% على ${d.n} إشارة`, c: C.green }
                         : { t: `⛔ غير مُثبت (${d.n < 20 ? 'عينة صغيرة' : 'دقة ' + d.precision.toFixed(0) + '%'}) - لا توصية`, c: C.red } };
    }
    const ok = a && a.confidence >= settings.minConfidence;
    return { dir: ok ? a.direction : 'neutral', conf: a ? a.confidence + '%' : '—', tag: null };
  };

  const data = useMemo(() => {
    let l = Object.values(tickers).filter(t => (ex === 'all' || (ex === 'fav' ? favorites.includes(t.key) : t.exchange === ex)) && t.base.includes(q.toUpperCase()));
    const a = (t) => analysis[t.key];
    const cs = (t) => deep[t.key] ? deep[t.key].prob : (a(t) ? a(t).confidence : 0);
    if (sort === 'conf') l = l.filter(t => a(t) || deep[t.key]).sort((x, y) => cs(y) - cs(x));
    else if (sort === 'safe') l = l.filter(a).sort((x, y) => RANK.indexOf(a(y).safety.level) - RANK.indexOf(a(x).safety.level));
    else if (sort === 'proven') l = l.filter(t => deep[t.key]?.validated).sort((x, y) => deep[y.key].exp - deep[x.key].exp);
    else l = l.sort((x, y) => y.volume - x.volume);
    return l.slice(0, 80);
  }, [tickers, analysis, deep, q, ex, sort, favorites]);

  const renderItem = ({ item: t }) => {
    const v = view(t), d = dirInfo(v.dir), a = analysis[t.key];
    return (
      <TouchableOpacity onPress={() => navigation.navigate('Coin', { key: t.key })}>
        <Card style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: C.text, fontSize: 17, fontWeight: '700' }}>
                <Text onPress={() => toggleFav(t.key)}>{favorites.includes(t.key) ? '⭐' : '☆'} </Text>
                {t.base} <Text style={{ color: C.dim, fontSize: 12 }}>/USDT · {t.exchange}</Text></Text>
              <Text style={{ color: d.c, marginTop: 6 }}>{d.t}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: C.text, fontSize: 17, fontWeight: '700' }}>${fmt(t.price)}</Text>
              <Text style={{ color: t.change >= 0 ? C.green : C.red, marginTop: 4 }}>{pc(t.change)}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
            <Text style={{ color: C.dim }}>الاحتمال: <Text style={{ color: C.text }}>{v.conf}</Text></Text>
            <Text style={{ color: C.dim }}>الأمان: <Text style={{ color: C.text }}>{a ? `${a.safety.icon} ${a.safety.label}` : '—'}</Text></Text>
          </View>
          {v.tag && <Text style={{ color: v.tag.c, marginTop: 8, fontSize: 12 }}>{v.tag.t}</Text>}
        </Card>
      </TouchableOpacity>
    );
  };

  const wins = {};
  Object.values(deep).forEach(d => { if (d.validated && d.chosenNames[0]) wins[d.chosenNames[0]] = (wins[d.chosenNames[0]] || 0) + 1; });
  const winners = Object.entries(wins).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const btc = tickers['Binance:BTCUSDT'];
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: 12 }}>
      {(fng || btc) && <Card style={{ marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
        {fng && <Text style={{ color: C.dim }}>الخوف والطمع: <Text style={{ color: fng.value < 40 ? C.red : fng.value > 60 ? C.green : C.yellow, fontWeight: '700' }}>{fng.value} ({FNG[fng.label] || fng.label})</Text></Text>}
        {btc && <Text style={{ color: C.dim }}>BTC: <Text style={{ color: btc.change >= 0 ? C.green : C.red, fontWeight: '700' }}>{pc(btc.change)}</Text></Text>}
      </Card>}
      <TextInput value={q} onChangeText={setQ} placeholder="ابحث: BTC, ETH, SOL..." placeholderTextColor={C.dim}
        style={{ backgroundColor: C.card, color: C.text, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.border }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 10 }}>
        {[['all', 'الكل'], ['fav', '⭐ المفضلة'], ['Binance', 'Binance'], ['Bybit', 'Bybit']].map(([k, l]) => <Chip key={k} label={l} active={ex === k} onPress={() => setEx(k)} />)}
        {[['vol', 'الأعلى سيولة'], ['conf', 'الأعلى احتمالاً'], ['safe', 'الأكثر أماناً'], ['proven', 'الأعلى تاريخياً']].map(([k, l]) => <Chip key={k} label={l} active={sort === k} onPress={() => setSort(k)} />)}
      </ScrollView>
      <TouchableOpacity onPress={() => deepScan()} style={{ padding: 10, borderRadius: 10, borderWidth: 1, borderColor: C.green, alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ color: C.green, fontWeight: '700' }}>{scanning ? `جاري التحليل العميق... (${Object.keys(deep).length}/30)` : '🧠 تحليل عميق لأعلى العملات (تاريخ طويل + تعلّم آلي)'}</Text>
      </TouchableOpacity>
      {winners.length > 0 && <Text style={{ color: C.dim, fontSize: 12, marginBottom: 8, textAlign: 'center' }}>
        أكثر النماذج فوزاً: {winners.map(([n, c]) => `${n} (${c})`).join(' · ')}
      </Text>}
      <FlatList data={data} keyExtractor={t => t.key} renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => analyzeTop()} tintColor={C.green} />}
        ListEmptyComponent={<Text style={{ color: C.dim, textAlign: 'center', marginTop: 40 }}>لا توجد نتائج.</Text>} />
    </View>
  );
}
