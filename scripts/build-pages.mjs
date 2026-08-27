import { cp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const privatePath = (process.env.PRIVATE_PATH || '').trim();
const clientId = (process.env.SPOTIFY_CLIENT_ID || '').trim();
const clientSecret = (process.env.SPOTIFY_CLIENT_SECRET || '').trim();

if (!/^[A-Za-z0-9_-]{12,80}$/.test(privatePath)) {
  throw new Error('PRIVATE_PATH 必須是 12–80 個英文字母、數字、底線或連字號');
}
if (!/^[A-Za-z0-9]{20,80}$/.test(clientId)) throw new Error('SPOTIFY_CLIENT_ID 未設定或格式不正確');
if (clientSecret.length < 20 || clientSecret.length > 200) throw new Error('SPOTIFY_CLIENT_SECRET 未設定或格式不正確');

const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
  method: 'POST',
  headers: {
    authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    'content-type': 'application/x-www-form-urlencoded'
  },
  body: 'grant_type=client_credentials'
});
if (!tokenResponse.ok) throw new Error(`Spotify 憑證驗證失敗（${tokenResponse.status}）`);
const token = await tokenResponse.json();

const output = join('_site', privatePath);
await mkdir(output, { recursive: true });
await cp('public', output, { recursive: true });
await writeFile(join(output, 'config.js'), `window.LYRICPAIR_CONFIG=${JSON.stringify({ accessToken:token.access_token, expiresAt:Date.now()+token.expires_in*1000 })};\n`);
await writeFile('_site/.nojekyll', '');
const notFound = '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="robots" content="noindex,nofollow,noarchive"><meta http-equiv="Cache-Control" content="no-store"><title>404</title><style>body{font-family:system-ui;display:grid;place-items:center;min-height:90vh;background:#f5f3ed;color:#17211b}main{text-align:center}h1{font-size:72px;margin:0}p{color:#68736c}</style><main><h1>404</h1><p>找不到此頁面</p></main></html>';
await writeFile('_site/index.html', notFound);
await writeFile('_site/404.html', notFound);
