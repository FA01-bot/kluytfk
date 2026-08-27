import http from 'node:http';

const PORT = Number(process.env.PORT || 10000);
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const ALLOWED_ORIGIN = (process.env.ALLOWED_ORIGIN || '').replace(/\/$/, '');
let spotifyToken = { value: '', expiresAt: 0 };
const requests = new Map();

function send(res, status, body, origin = '') {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer'
  };
  if (origin && origin === ALLOWED_ORIGIN) {
    headers['access-control-allow-origin'] = origin;
    headers.vary = 'Origin';
  }
  res.writeHead(status, headers); res.end(JSON.stringify(body));
}

function limited(req) {
  const key = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const recent = (requests.get(key) || []).filter(t => now - t < 60_000);
  recent.push(now); requests.set(key, recent);
  return recent.length > 45;
}

async function getSpotifyToken() {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('Spotify 環境變數尚未設定');
  if (spotifyToken.expiresAt > Date.now() + 60_000) return spotifyToken.value;
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  if (!response.ok) throw new Error('Spotify Client ID 或 Client Secret 無效');
  const data = await response.json();
  spotifyToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return spotifyToken.value;
}

async function spotify(path) {
  const response = await fetch(`https://api.spotify.com/v1${path}`, { headers: { authorization: `Bearer ${await getSpotifyToken()}` } });
  if (!response.ok) throw new Error(`Spotify API 回應 ${response.status}`);
  return response.json();
}

function view(t) {
  return { id:t.id, name:t.name, artists:t.artists.map(a=>a.name).join(', '), album:t.album.name, durationMs:t.duration_ms, image:t.album.images?.[0]?.url||'', spotifyUrl:t.external_urls?.spotify||`https://open.spotify.com/track/${t.id}` };
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  try {
    if (req.method === 'OPTIONS') {
      if (origin !== ALLOWED_ORIGIN) return send(res, 403, { error: 'Origin not allowed' });
      res.writeHead(204, { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'Origin' }); return res.end();
    }
    if (req.url === '/health') return send(res, 200, { ok: true }, origin);
    if (origin !== ALLOWED_ORIGIN) return send(res, 403, { error: 'Origin not allowed' });
    if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' }, origin);
    if (limited(req)) return send(res, 429, { error: '請求過於頻繁，請稍後再試。' }, origin);
    if ((req.url || '').length > 3000) return send(res, 414, { error: '輸入過長' }, origin);
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/track') {
      const id = url.searchParams.get('id') || '';
      if (!/^[A-Za-z0-9]{22}$/.test(id)) return send(res, 400, { error: 'Spotify Track ID 無效' }, origin);
      return send(res, 200, view(await spotify(`/tracks/${id}`)), origin);
    }
    if (url.pathname === '/api/search') {
      const q = (url.searchParams.get('q') || '').trim();
      if (!q || q.length > 180) return send(res, 400, { error: '搜尋文字無效' }, origin);
      const data = await spotify(`/search?type=track&limit=8&q=${encodeURIComponent(q)}`);
      return send(res, 200, data.tracks.items.map(view), origin);
    }
    if (url.pathname === '/api/lyrics') {
      const query = new URLSearchParams({ track_name:url.searchParams.get('track')||'', artist_name:url.searchParams.get('artist')||'', album_name:url.searchParams.get('album')||'', duration:String(Math.round(Number(url.searchParams.get('durationMs')||0)/1000)) });
      const response = await fetch(`https://lrclib.net/api/get?${query}`, { headers:{'Lrclib-Client':'LyricPair/3.0'} });
      if (response.status === 404) return send(res, 404, { error:'找不到相符內容，你仍可手動貼上。' }, origin);
      if (!response.ok) return send(res, 502, { error:`查詢來源暫時不可用（${response.status}）` }, origin);
      const data = await response.json(); return send(res, 200, { lyrics:data.plainLyrics||'', instrumental:data.instrumental }, origin);
    }
    return send(res, 404, { error: 'Not Found' }, origin);
  } catch (error) { return send(res, 500, { error:error.message||'伺服器錯誤' }, origin); }
});

server.listen(PORT, '0.0.0.0', () => console.log(`LyricPair API listening on ${PORT}`));
