import React from 'react';
import { Text, ScrollView, TouchableOpacity } from 'react-native';
import { useStore } from '../store/useStore';
import { C, fmt } from '../theme';
import { Card, Row } from '../components';

const usd = (n) => `${n >= 0 ? '+' : ''}$${n.toFixed(2)}`;

export default function Trades() {
  const { trades, tickers, closeTrade, livePnl, balance } = useStore();
  const open = trades.filter(t => t.status === 'open'), closed = trades.filter(t => t.status === 'closed');
  const wins = closed.filter(t => t.pnl > 0).length;
  const total = closed.reduce((s, t) => s + t.pnl, 0);
  const rate = closed.length ? (wins / closed.length) * 100 : 0;
  const h = { color: C.text, fontSize: 17, fontWeight: '700', marginVertical: 12 };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 14 }}>
      <Card>
        <Row a="الرصيد الافتراضي" b={`$${balance().toFixed(2)}`} />
        <Row a="نسبة النجاح" b={`${rate.toFixed(1)}%`} bColor={C.green} />
        <Row a="إجمالي الربح/الخسارة" b={usd(total)} bColor={total >= 0 ? C.green : C.red} />
        <Row a="ناجحة / خاسرة" b={`${wins} / ${closed.length - wins}`} />
      </Card>

      <Text style={h}>الصفقات الحالية ({open.length})</Text>
      {open.map(t => {
        const p = livePnl(t), pct = (p / t.size) * 100;
        return (
          <Card key={t.id} style={{ marginBottom: 10 }}>
            <Text style={{ color: t.side === 'long' ? C.green : C.red, fontWeight: '700' }}>{t.symbol} · {t.side === 'long' ? 'Long' : 'Short'} · {t.exchange}</Text>
            <Row a="الدخول / الحالي" b={`${fmt(t.entry)} / ${fmt(tickers[t.key]?.price ?? t.entry)}`} />
            <Row a="الهدف / الوقف" b={`${fmt(t.tp)} / ${fmt(t.sl)}`} />
            <Row a="الربح اللحظي" b={`${usd(p)} (${pct.toFixed(2)}%)`} bColor={p >= 0 ? C.green : C.red} />
            <TouchableOpacity onPress={() => closeTrade(t.id, tickers[t.key]?.price ?? t.entry)} style={{ marginTop: 6, alignItems: 'center', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: C.border }}>
              <Text style={{ color: C.text }}>إغلاق يدوي</Text>
            </TouchableOpacity>
          </Card>
        );
      })}

      <Text style={h}>السجل ({closed.length})</Text>
      {closed.map(t => (
        <Card key={t.id} style={{ marginBottom: 8 }}>
          <Row a={`${t.symbol} · ${t.side === 'long' ? 'Long' : 'Short'}`} b={usd(t.pnl)} bColor={t.pnl >= 0 ? C.green : C.red} />
          <Text style={{ color: C.dim, fontSize: 12 }}>الإغلاق: {t.reason}</Text>
        </Card>
      ))}
    </ScrollView>
  );
}
