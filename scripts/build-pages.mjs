import { cp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const privatePath = (process.env.PRIVATE_PATH || '').trim();
const clientId = (process.env.SPOTIFY_CLIENT_ID || '').trim();

if (!/^[A-Za-z0-9_-]{12,80}$/.test(privatePath)) {
  throw new Error('PRIVATE_PATH 必須是 12–80 個英文字母、數字、底線或連字號');
}
if (!/^[A-Za-z0-9]{20,64}$/.test(clientId)) {
  throw new Error(`SPOTIFY_CLIENT_ID 未傳入或格式不正確（目前長度：${clientId.length}）`);
}

const output = join('_site', privatePath);
await mkdir(output, { recursive: true });
await cp('public', output, { recursive: true });
await writeFile(join(output, 'config.js'), `window.LYRICPAIR_CONFIG=${JSON.stringify({ spotifyClientId: clientId })};\n`);
await writeFile('_site/.nojekyll', '');
const notFound = '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="robots" content="noindex,nofollow,noarchive"><meta http-equiv="Cache-Control" content="no-store"><title>404</title><style>body{font-family:system-ui;display:grid;place-items:center;min-height:90vh;background:#f5f3ed;color:#17211b}main{text-align:center}h1{font-size:72px;margin:0}p{color:#68736c}</style><main><h1>404</h1><p>找不到此頁面</p></main></html>';
await writeFile('_site/index.html', notFound);
await writeFile('_site/404.html', notFound);
