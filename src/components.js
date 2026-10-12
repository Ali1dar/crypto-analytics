import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { C } from './theme';

export const Card = ({ children, style }) => (
  <View style={[{ backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border }, style]}>{children}</View>
);
export const Chip = ({ label, active, onPress }) => (
  <TouchableOpacity onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginEnd: 8,
    backgroundColor: active ? C.green : C.card, borderWidth: 1, borderColor: active ? C.green : C.border }}>
    <Text style={{ color: active ? '#000' : C.text, fontWeight: '600' }}>{label}</Text>
  </TouchableOpacity>
);
export const Row = ({ a, b, bColor }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
    <Text style={{ color: C.dim }}>{a}</Text><Text style={{ color: bColor || C.text, fontWeight: '600' }}>{b}</Text>
  </View>
);
export const dirInfo = (d) => d === 'up' ? { t: 'صعود 📈', c: C.green } : d === 'down' ? { t: 'هبوط 📉', c: C.red } : { t: 'محايد ➖', c: C.dim };
