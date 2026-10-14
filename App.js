import React, { useEffect } from 'react';
import { I18nManager, Text, StatusBar } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStore } from './src/store/useStore';
import { C } from './src/theme';
import Dashboard from './src/screens/Dashboard';
import CoinDetail from './src/screens/CoinDetail';
import Trades from './src/screens/Trades';
import Settings from './src/screens/Settings';
import Assistant from './src/screens/Assistant';

// RTL: يتطلب إعادة تشغيل التطبيق مرة واحدة بعد أول تشغيل
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const hdr = { headerStyle: { backgroundColor: C.bg }, headerTintColor: C.text };
const icon = (e) => ({ tabBarIcon: () => <Text>{e}</Text> });

function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ ...hdr, tabBarStyle: { backgroundColor: C.card, borderTopColor: C.border }, tabBarActiveTintColor: C.green }}>
      <Tab.Screen name="Market" component={Dashboard} options={{ title: 'السوق', ...icon('📊') }} />
      <Tab.Screen name="AI" component={Assistant} options={{ title: 'المستشار', ...icon('🤖') }} />
      <Tab.Screen name="Trades" component={Trades} options={{ title: 'الصفقات', ...icon('💼') }} />
      <Tab.Screen name="Settings" component={Settings} options={{ title: 'الإعدادات', ...icon('⚙️') }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const { refreshTickers, analyzeTop, refreshFng } = useStore();
  useEffect(() => {
    let n = 0;
    (async () => { await refreshTickers(); analyzeTop(); })(); refreshFng();
    const id = setInterval(() => { refreshTickers(); if (++n % 12 === 0) analyzeTop(); if (n % 30 === 0) refreshFng(); }, 10000); // أسعار كل 10ث، تحليل كل دقيقتين
    return () => clearInterval(id);
  }, []);

  return (
    <NavigationContainer theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: C.bg } }}>
      <StatusBar barStyle="light-content" />
      <Stack.Navigator screenOptions={hdr}>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="Coin" component={CoinDetail} options={{ title: 'تحليل العملة' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
