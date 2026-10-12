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
// يرجع الشموع من الأقدم للأحدث
export async function fetchKlines(exchange, symbol, interval, limit = 250) {
  if (exchange === 'Bybit') {
    const d = await get(`${Y}/kline?category=spot&symbol=${symbol}&interval=${BY[interval]}&limit=${limit}`);
    return d.result.list.slice().reverse().map(k => ({ o:+k[1], h:+k[2], l:+k[3], c:+k[4], v:+k[5] }));
  }
  const d = await get(`${B}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  return d.map(k => ({ o:+k[1], h:+k[2], l:+k[3], c:+k[4], v:+k[5] }));
}
