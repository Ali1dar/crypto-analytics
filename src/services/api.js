const B = 'https://api.binance.com/api/v3';
const Y = 'https://api.bybit.com/v5/market';
const get = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(String(r.status)); return r.json(); };

export async function fetchBinanceTickers() {
  const d = await get(`${B}/ticker/24hr`);
  return d.filter(t => t.symbol.endsWith('USDT')).map(t => ({
    key:'Binance:'+t.symbol, exchange:'Binance', symbol:t.symbol, base:t.symbol.slice(0,-4),
    price:+t.lastPrice, change:+t.priceChangePercent, volume:+t.quoteVolume }));
}

export async function fetchBybitTickers() {
  const d = await get(`${Y}/tickers?category=spot`);
  return d.result.list.filter(t => t.symbol.endsWith('USDT')).map(t => ({
    key:'Bybit:'+t.symbol, exchange:'Bybit', symbol:t.symbol, base:t.symbol.slice(0,-4),
    price:+t.lastPrice, change:+t.price24hPcnt*100, volume:+t.turnover24h }));
}

const BY = { '15m':'15', '1h':'60', '4h':'240', '1d':'D' };
// الشموع من الأقدم للأحدث. end = وقت (ms) لجلب شموع أقدم منه
export async function fetchKlines(exchange, symbol, interval, limit = 250, end = null) {
  if (exchange === 'Bybit') {
    const d = await get(`${Y}/kline?category=spot&symbol=${symbol}&interval=${BY[interval]}&limit=${Math.min(limit,1000)}${end ? `&end=${end}` : ''}`);
    return d.result.list.slice().reverse().map(k => ({ t:+k[0], o:+k[1], h:+k[2], l:+k[3], c:+k[4], v:+k[5] }));
  }
  const d = await get(`${B}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}${end ? `&endTime=${end}` : ''}`);
  return d.map(k => ({ t:+k[0], o:+k[1], h:+k[2], l:+k[3], c:+k[4], v:+k[5] }));
}

// تاريخ طويل: كل صفحة 1000 شمعة
export async function fetchKlinesLong(exchange, symbol, interval, pages = 2) {
  let all = [], end = null;
  for (let p = 0; p < pages; p++) {
    const k = await fetchKlines(exchange, symbol, interval, 1000, end);
    if (!k.length) break;
    all = [...k, ...all]; end = k[0].t - 1;
    if (k.length < 1000) break;
  }
  return all;
}

export async function fetchFearGreed() {
  const d = await get('https://api.alternative.me/fng/?limit=1');
  return { value: +d.data[0].value, label: d.data[0].value_classification };
}
