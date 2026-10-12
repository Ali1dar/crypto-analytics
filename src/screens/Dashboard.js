import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useStore } from '../store/useStore';
import { C, fmt, pc } from '../theme';
import { Card, Chip, dirInfo } from '../components';

const RANK = ['weak', 'mid', 'safe'];

export default function Dashboard({ navigation }) {
  const { tickers, analysis, settings, loading, analyzeTop, scan, scanning, runScan } = useStore();
  const [q, setQ] = useState(''); const [ex, setEx] = useState('all'); const [sort, setSort] = useState('vol');

  const data = useMemo(() => {
    let l = Object.values(tickers).filter(t => (ex === 'all' || t.exchange === ex) && t.base.includes(q.toUpperCase()));
    const a = (t) => analysis[t.key];
    if (sort === 'conf') l = l.filter(a).sort((x,y) => a(y).confidence - a(x).confidence);
    else if (sort === 'safe') l = l.filter(a).sort((x,y) => RANK.indexOf(a(y).safety.level) - RANK.indexOf(a(x).safety.level));
    else if (sort === 'proven') l = l.filter(t => scan[t.key] && scan[t.key].n >= 10).sort((x,y) => scan[y.key].exp - scan[x.key].exp);
    else l = l.sort((x,y) => y.volume - x.volume);
    return l.slice(0, 80);
  }, [tickers, analysis, scan, q, ex, sort]);

  const renderItem = ({ item: t }) => {
    const a = analysis[t.key];
    const sc = scan[t.key]; const bad = sc && sc.n >= 10 && sc.exp <= 0;
    const ok = a && a.confidence >= settings.minConfidence && !bad;
    const d = dirInfo(ok ? a.direction : 'neutral');
    return (
      <TouchableOpacity onPress={() => navigation.navigate('Coin', { key: t.key })}>
        <Card style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: C.text, fontSize: 17, fontWeight: '700' }}>{t.base} <Text style={{ color: C.dim, fontSize: 12 }}>/USDT · {t.exchange}</Text></Text>
              <Text style={{ color: d.c, marginTop: 6 }}>{d.t}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: C.text, fontSize: 17, fontWeight: '700' }}>${fmt(t.price)}</Text>
              <Text style={{ color: t.change >= 0 ? C.green : C.red, marginTop: 4 }}>{pc(t.change)}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
            <Text style={{ color: C.dim }}>الثقة: <Text style={{ color: C.text }}>{a ? a.confidence + '%' : '—'}</Text></Text>
            <Text style={{ color: C.dim }}>الأمان: <Text style={{ color: C.text }}>{a ? `${a.safety.icon} ${a.safety.label}` : '—'}</Text></Text>
          </View>
          {sc && <Text style={{ color: bad ? C.red : sc.exp > 0.15 ? C.green : C.yellow, marginTop: 8, fontSize: 12 }}>
            الاختبار التاريخي: نجاح {sc.winRate.toFixed(0)}% ({sc.n} صفقة) · {bad ? 'غير مجدية ⛔' : sc.n < 15 ? 'عينة صغيرة ⚠️' : 'مجدية ✅'}
          </Text>}
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: 12 }}>
      <TextInput value={q} onChangeText={setQ} placeholder="ابحث: BTC, ETH, SOL..." placeholderTextColor={C.dim}
        style={{ backgroundColor: C.card, color: C.text, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.border }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 10 }}>
        {[['all','الكل'],['Binance','Binance'],['Bybit','Bybit']].map(([k,l]) => <Chip key={k} label={l} active={ex===k} onPress={() => setEx(k)} />)}
        {[['vol','الأعلى سيولة'],['conf','الأعلى نجاحاً'],['safe','الأكثر أماناً'],['proven','الأعلى تاريخياً']].map(([k,l]) => <Chip key={k} label={l} active={sort===k} onPress={() => setSort(k)} />)}
      </ScrollView>
      <TouchableOpacity onPress={() => runScan()} style={{ padding: 10, borderRadius: 10, borderWidth: 1, borderColor: C.green, alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ color: C.green, fontWeight: '700' }}>{scanning ? `جاري الفحص التاريخي... (${Object.keys(scan).length}/30)` : 'فحص دقة الخوارزمية تاريخياً على أعلى العملات'}</Text>
      </TouchableOpacity>
      <FlatList data={data} keyExtractor={t => t.key} renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => analyzeTop()} tintColor={C.green} />}
        ListEmptyComponent={<Text style={{ color: C.dim, textAlign: 'center', marginTop: 40 }}>جاري تحميل السوق...</Text>} />
    </View>
  );
}
