import React, { useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useStore } from '../store/useStore';
import { C } from '../theme';
import { Chip } from '../components';

const QUICK = ['أين أستثمر اليوم؟', 'حلل صفقاتي المفتوحة', 'ما أكثر العملات أماناً الآن؟', 'كيف أدير المخاطرة؟'];

function buildContext() {
  const s = useStore.getState();
  const top = Object.values(s.tickers).filter(t => s.analysis[t.key])
    .map(t => ({ t, a: s.analysis[t.key] })).sort((x, y) => y.a.confidence - x.a.confidence).slice(0, 10)
    .map(({ t, a }) => ({ coin: t.base, exchange: t.exchange, price: t.price, change24h: +t.change.toFixed(2),
      volume24h: Math.round(t.volume), signal: a.direction, confidence: a.confidence, safety: a.safety.label,
      rsi: +a.rsi.toFixed(1), adx: +a.adx.toFixed(0), higherTimeframe: a.mtf,
      levels: a.levels && { tp1: a.levels.tp1, tp2: a.levels.tp2, sl: a.levels.sl } }));
  return { timeframe: s.settings.interval, virtualBalance: +s.balance().toFixed(2),
    openTrades: s.trades.filter(x => x.status === 'open').map(x => ({ symbol: x.symbol, side: x.side, entry: x.entry, tp: x.tp, sl: x.sl, pnl: +s.livePnl(x).toFixed(2) })),
    topSignals: top };
}

export default function Assistant() {
  const settings = useStore(s => s.settings);
  const [msgs, setMsgs] = useState([{ role: 'assistant', content: 'مرحباً! أنا مستشارك داخل التطبيق. أرى بيانات السوق وإشاراتك وصفقاتك. اسألني ما تريد.\n\n⚠️ أقدم تحليلاً تعليمياً وليس نصيحة مالية مضمونة.' }]);
  const [input, setInput] = useState(''); const [busy, setBusy] = useState(false); const ref = useRef();

  const send = async (text) => {
    const q = (text ?? input).trim(); if (!q || busy) return;
    if (!settings.proxyUrl) { setMsgs(m => [...m, { role: 'assistant', content: 'أضف رابط الخادم من الإعدادات أولاً (قسم المساعد الذكي).' }]); return; }
    const next = [...msgs, { role: 'user', content: q }]; setMsgs(next); setInput(''); setBusy(true);
    try {
      const history = next.slice(1).slice(-10);
      const r = await fetch(settings.proxyUrl, { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-token': settings.token || '' },
        body: JSON.stringify({ messages: history, context: buildContext() }) });
      const d = await r.json();
      setMsgs(m => [...m, { role: 'assistant', content: d.reply || d.error || 'لم أستطع الرد.' }]);
    } catch (e) { setMsgs(m => [...m, { role: 'assistant', content: 'تعذر الاتصال بالخادم. تحقق من الرابط والإنترنت.' }]); }
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList ref={ref} data={msgs} keyExtractor={(_, i) => String(i)} contentContainerStyle={{ padding: 12 }}
        onContentSizeChange={() => ref.current?.scrollToEnd()}
        renderItem={({ item }) => (
          <View style={{ alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', marginBottom: 10, padding: 12, borderRadius: 14,
            backgroundColor: item.role === 'user' ? '#0F3D2E' : C.card, borderWidth: 1, borderColor: C.border }}>
            <Text style={{ color: C.text, lineHeight: 22 }}>{item.content}</Text>
          </View>)}
        ListFooterComponent={busy ? <Text style={{ color: C.dim, padding: 8 }}>يكتب...</Text> : null} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, paddingHorizontal: 12, paddingBottom: 8 }}>
        {QUICK.map(q => <Chip key={q} label={q} onPress={() => send(q)} />)}
      </ScrollView>
      <View style={{ flexDirection: 'row', padding: 10, borderTopWidth: 1, borderTopColor: C.border }}>
        <TextInput value={input} onChangeText={setInput} placeholder="اسأل المستشار..." placeholderTextColor={C.dim} onSubmitEditing={() => send()}
          style={{ flex: 1, backgroundColor: C.card, color: C.text, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border }} />
        <TouchableOpacity onPress={() => send()} style={{ marginStart: 8, backgroundColor: C.green, borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' }}>
          <Text style={{ color: '#000', fontWeight: '800' }}>إرسال</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
