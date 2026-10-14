import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useStore } from '../store/useStore';
import { C } from '../theme';
import { Card, Chip } from '../components';

export default function Settings() {
  const { settings, setSettings, resetTrades, analyzeTop } = useStore();
  const [cap, setCap] = useState(String(settings.capital));
  const lab = { color: C.text, fontWeight: '700', marginBottom: 8 };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 14 }}>
      <Card style={{ marginBottom: 12 }}>
        <Text style={lab}>رأس المال الافتراضي ($)</Text>
        <TextInput value={cap} onChangeText={setCap} keyboardType="numeric" onEndEditing={() => setSettings({ capital: Math.max(1, +cap || 10000) })}
          style={{ backgroundColor: C.bg, color: C.text, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.border }} />
      </Card>
      <Card style={{ marginBottom: 12 }}>
        <Text style={lab}>الحد الأدنى لاحتمال النجاح</Text>
        <Text style={{ color: C.dim, fontSize: 12, marginBottom: 8 }}>احتمال النموذج الواقعي يتراوح عادة بين 55% و70%.</Text>
        <View style={{ flexDirection: 'row' }}>
          {[58, 60, 65, 70].map(n => <Chip key={n} label={n + '%'} active={settings.minConfidence === n} onPress={() => setSettings({ minConfidence: n })} />)}
        </View>
      </Card>
      <Card style={{ marginBottom: 12 }}>
        <Text style={lab}>نسبة المخاطرة لكل صفقة من الرصيد</Text>
        <View style={{ flexDirection: 'row' }}>
          {[0.5, 1, 2].map(n => <Chip key={n} label={n + '%'} active={(settings.riskPct || 1) === n} onPress={() => setSettings({ riskPct: n })} />)}
        </View>
      </Card>
      <Card style={{ marginBottom: 12 }}>
        <Text style={lab}>الإطار الزمني للتحليل</Text>
        <View style={{ flexDirection: 'row' }}>
          {['15m', '1h', '4h'].map(x => <Chip key={x} label={x} active={settings.interval === x} onPress={() => { setSettings({ interval: x }); setTimeout(() => analyzeTop(), 0); }} />)}
        </View>
      </Card>
      <Card style={{ marginBottom: 12 }}>
        <Text style={lab}>المساعد الذكي</Text>
        {[['proxyUrl', 'رابط الخادم (Worker URL)'], ['token', 'رمز التطبيق (APP_TOKEN)']].map(([k, ph]) => (
          <TextInput key={k} defaultValue={settings[k] || ''} placeholder={ph} placeholderTextColor={C.dim} autoCapitalize="none"
            onEndEditing={(e) => setSettings({ [k]: e.nativeEvent.text.trim() })}
            style={{ backgroundColor: C.bg, color: C.text, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.border, marginBottom: 8 }} />
        ))}
      </Card>
      <TouchableOpacity onPress={() => Alert.alert('تصفير الصفقات', 'سيتم حذف كل الصفقات الوهمية.', [{ text: 'إلغاء' }, { text: 'حذف', style: 'destructive', onPress: resetTrades }])}
        style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.red, alignItems: 'center' }}>
        <Text style={{ color: C.red, fontWeight: '700' }}>حذف كل الصفقات</Text>
      </TouchableOpacity>
      <Text style={{ color: C.dim, marginTop: 16, textAlign: 'center', fontSize: 12 }}>⚠️ للمحاكاة والتعليم فقط. ليست نصيحة مالية.</Text>
    </ScrollView>
  );
}
