export const C = { bg:'#0B0F14', card:'#131A22', border:'#1F2933', text:'#E6EDF3', dim:'#8B98A5', green:'#00FF9C', red:'#FF3B5C', yellow:'#FFC83D', blue:'#3DA5FF' };
export const fmt = (n) => n >= 1000 ? n.toLocaleString('en-US',{maximumFractionDigits:2}) : n >= 1 ? n.toFixed(3) : n.toPrecision(4);
export const pc = (n) => `${n>=0?'+':''}${n.toFixed(2)}%`;
