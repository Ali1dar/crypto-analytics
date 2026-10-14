import React from 'react';
import { Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { useStore } from '../store/useStore';
import { C, fmt } from '../theme';
import { Card, Row } from '../components';

const usd = (n) => `${n >= 0 ? '+' : ''}$${n.toFixed(2)}`;

export default function Trades() {
  const { trades, tickers, closeTrade, livePnl, balance, settings } = useStore();
  const open = trades.filter(t => t.status === 'open');
  const closed = trades.filter(t => t.status === 'closed').sort((a, b) => a.closedAt - b.closedAt);
  const wins = closed.filter(t => t.pnl > 0), losses = closed.filter(t => t.pnl <= 0);
  const total = closed.reduce((s, t) => s + t.pnl, 0);
  const gp = wins.reduce((s, t) => s + t.pnl, 0), gl = -losses.reduce((s, t) => s + t.pnl, 0);
  const rate = closed.length ? (wins.length / closed.length) * 100 : 0;
  let eq = settings.capital, peak = eq, dd = 0; const curve = [eq];
  closed.forEach(t => { eq += t.pnl; curve.push(eq); peak = Math.max(peak, eq); dd = Math.max(dd, (peak - eq) / peak * 100); });
  const W = Dimensions.get('window').width - 56, H = 100;
  const mn = Math.min(...curve), mx = Math.max(...curve);
  const pts = curve.map((v, i) => `${(i / Math.max(curve.length - 1, 1)) * W},${H - ((v - mn) / (mx - mn || 1)) * H}`).join(' ');
  const grp = (f) => { const g = closed.filter(f); return { n: g.length, w: g.filter(t => t.pnl > 0).length, pnl: g.reduce((s, t) => s + t.pnl, 0) }; };
  const gr = grp(t => t.rec), gm = grp(t => !t.rec);
  const fmtG = (g) => g.n ? `${g.w}/${g.n} (${(g.w / g.n * 100).toFixed(0)}%) · ${usd(g.pnl)}` : 'لا توجد بعد';
  const h = { color: C.text, fontSize: 17, fontWeight: '700', marginVertical: 12 };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 14 }}>
      <Card>
        <Row a="الرصيد الافتراضي" b={`$${balance().toFixed(2)}`} />
        <Row a="نسبة النجاح" b={`${rate.toFixed(1)}%`} bColor={C.green} />
        <Row a="إجمالي الربح/الخسارة" b={usd(total)} bColor={total >= 0 ? C.green : C.red} />
        <Row a="ناجحة / خاسرة" b={`${wins.length} / ${losses.length}`} />
        <Row a="معامل الربح (PF)" b={gl ? (gp / gl).toFixed(2) : gp ? '∞' : '—'} />
        <Row a="متوسط الربح / الخسارة" b={`${wins.length ? usd(gp / wins.length) : '—'} / ${losses.length ? usd(-gl / losses.length) : '—'}`} />
        <Row a="أقصى تراجع (Drawdown)" b={`${dd.toFixed(1)}%`} bColor={dd > 15 ? C.red : C.text} />
      </Card>
      {curve.length > 1 && <Card style={{ marginTop: 10 }}>
        <Text style={{ color: C.dim, marginBottom: 6 }}>منحنى الرصيد</Text>
        <Svg width={W} height={H}><Polyline points={pts} fill="none" stroke={total >= 0 ? C.green : C.red} strokeWidth="2" /></Svg>
      </Card>}

      <Card style={{ marginTop: 10 }}>
        <Text style={{ color: C.text, fontWeight: '700', marginBottom: 4 }}>🧪 اختبار حي: هل التوصيات تنجح فعلاً؟</Text>
        <Row a="صفقات بتوصية النموذج" b={fmtG(gr)} />
        <Row a="صفقات يدوية" b={fmtG(gm)} />
        <Text style={{ color: C.dim, fontSize: 12 }}>لا تعتمد على التوصيات قبل أن تغلق 50 صفقة مقترحة على الأقل بنتيجة موجبة.</Text>
      </Card>

      <Text style={h}>الصفقات الحالية ({open.length})</Text>
      {open.map(t => {
        const p = livePnl(t), pct = (p / (t.size * (t.tp1Hit ? 2 : 1))) * 100;
        return (
          <Card key={t.id} style={{ marginBottom: 10 }}>
            <Text style={{ color: t.side === 'long' ? C.green : C.red, fontWeight: '700' }}>{t.symbol} · {t.side === 'long' ? 'Long' : 'Short'} · {t.exchange} · {t.rec ? '✅ مقترحة' : '✋ يدوية'}</Text>
            <Row a="الدخول / الحالي" b={`${fmt(t.entry)} / ${fmt(tickers[t.key]?.price ?? t.entry)}`} />
            <Row a={t.tp1Hit ? 'الهدف الثاني' : 'الهدف الأول'} b={fmt(t.tp1Hit ? t.tp2 : t.tp)} bColor={C.green} />
            <Row a={t.tp1Hit ? 'الوقف (عند الدخول)' : 'الوقف'} b={fmt(t.sl)} bColor={C.red} />
            {t.tp1Hit && <Text style={{ color: C.green, marginVertical: 4 }}>✅ حُقق الهدف الأول: أُغلق النصف ونُقل الوقف للتعادل</Text>}
            <Row a="الربح اللحظي" b={`${usd(p)} (${pct.toFixed(2)}%)`} bColor={p >= 0 ? C.green : C.red} />
            <TouchableOpacity onPress={() => closeTrade(t.id, tickers[t.key]?.price ?? t.entry)} style={{ marginTop: 6, alignItems: 'center', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: C.border }}>
              <Text style={{ color: C.text }}>إغلاق يدوي</Text>
            </TouchableOpacity>
          </Card>
        );
      })}

      <Text style={h}>السجل ({closed.length})</Text>
      {closed.slice().reverse().map(t => (
        <Card key={t.id} style={{ marginBottom: 8 }}>
          <Row a={`${t.symbol} · ${t.side === 'long' ? 'Long' : 'Short'}`} b={usd(t.pnl)} bColor={t.pnl >= 0 ? C.green : C.red} />
          <Text style={{ color: C.dim, fontSize: 12 }}>الإغلاق: {t.reason}{t.prob ? ` · احتمال النموذج وقت الفتح ${(t.prob * 100).toFixed(0)}%` : ''}</Text>
        </Card>
      ))}
    </ScrollView>
  );
}
