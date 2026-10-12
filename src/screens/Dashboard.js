import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useStore } from '../store/useStore';
import { C, fmt, pc } from '../theme';
import { Card, Chip, dirInfo } from '../components';

const RANK = ['weak', 'mid', 'safe'];

export default function Dashboard({ navigation }) {
  const { tickers, analysis, settings, loading, analyzeTop } = useStore();
  const [q, setQ] = useState(''); const [ex, setEx] = useState('all'); const [sort, setSort] = useState('vol');

  const data = useMemo(() => {
    let l = Object.values(tickers).filter(t => (ex === 'all' || t.exchange === ex) && t.base.includes(q.toUpperCase()));
    const a = (t) => analysis[t.key];
    if (sort === 'conf') l = l.filter(a).sort((x,y) => a(y).confidence - a(x).confidence);
    else if (sort === 'safe') l = l.filter(a).sort((x,y) => RANK.indexOf(a(y).safety.level) - RANK.indexOf(a(x).safety.level));
    else l = l.sort((x,y) => y.volume - x.volume);
    return l.slice(0, 80);
  }, [tickers, analysis, q, ex, sort]);

  const renderItem = ({ item: t }) => {
    const a = analysis[t.key];
    const ok = a && a.confidence >= settings.minConfidence;
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
        {[['vol','الأعلى سيولة'],['conf','الأعلى نجاحاً'],['safe','الأكثر أماناً']].map(([k,l]) => <Chip key={k} label={l} active={sort===k} onPress={() => setSort(k)} />)}
      </ScrollView>
      <FlatList data={data} keyExtractor={t => t.key} renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => analyzeTop()} tintColor={C.green} />}
        ListEmptyComponent={<Text style={{ color: C.dim, textAlign: 'center', marginTop: 40 }}>جاري تحميل السوق...</Text>} />
    </View>
  );
}
