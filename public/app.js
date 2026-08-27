const $ = s => document.querySelector(s);
const config = window.LYRICPAIR_CONFIG || {};
const TOKEN_KEY = 'lyricpair_spotify_token';
let mode = 'link';

const promptText = text => `請將以下由我提供的文字翻譯成自然、流暢的繁體中文。\n\n規則：\n1. 嚴格保留原文順序與分行，不合併或拆分任何一行。\n2. 每行先放原文，下一行放對應的繁體中文。\n3. 不添加解說、標題、註解、羅馬拼音或原文沒有的內容。\n4. 依語境自然翻譯；不確定時忠於原意，不自行編造。\n5. 重複的行也完整翻譯，不省略。\n\n待翻譯文字：\n${text}`;
const redirectUri = `${location.origin}${location.pathname.endsWith('/') ? location.pathname : `${location.pathname}/`}`;

function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function lines(s){return s.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)}
async function copy(text,label){if(!text.trim())return toast('目前沒有可複製的內容');await navigator.clipboard.writeText(text);toast(label)}
function tokenData(){try{return JSON.parse(localStorage.getItem(TOKEN_KEY))}catch{return null}}
function base64url(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function randomString(size=64){return base64url(crypto.getRandomValues(new Uint8Array(size)))}

async function connectSpotify(){
  const verifier=randomString();
  const challenge=base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
  const state=randomString(24);
  sessionStorage.setItem('pkce_verifier',verifier);sessionStorage.setItem('oauth_state',state);
  const url=new URL('https://accounts.spotify.com/authorize');
  url.search=new URLSearchParams({client_id:config.spotifyClientId,response_type:'code',redirect_uri:redirectUri,code_challenge_method:'S256',code_challenge:challenge,state}).toString();
  location.assign(url);
}

async function exchangeCode(code){
  const state=new URLSearchParams(location.search).get('state');
  if(!state||state!==sessionStorage.getItem('oauth_state'))throw new Error('Spotify 登入驗證失敗，請重新連接');
  const response=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.spotifyClientId,grant_type:'authorization_code',code,redirect_uri:redirectUri,code_verifier:sessionStorage.getItem('pkce_verifier')||''})});
  if(!response.ok)throw new Error('無法完成 Spotify 登入');
  const data=await response.json();saveToken(data);history.replaceState({},'',location.pathname);
  sessionStorage.removeItem('pkce_verifier');sessionStorage.removeItem('oauth_state');
}
function saveToken(data){const old=tokenData()||{};localStorage.setItem(TOKEN_KEY,JSON.stringify({accessToken:data.access_token,refreshToken:data.refresh_token||old.refreshToken,expiresAt:Date.now()+data.expires_in*1000}))}
async function accessToken(){
  const saved=tokenData();if(!saved)throw new Error('請先連接 Spotify');
  if(saved.expiresAt>Date.now()+60_000)return saved.accessToken;
  const response=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.spotifyClientId,grant_type:'refresh_token',refresh_token:saved.refreshToken})});
  if(!response.ok){localStorage.removeItem(TOKEN_KEY);throw new Error('Spotify 登入已過期，請重新連接')}
  const data=await response.json();saveToken(data);return data.access_token;
}
async function spotify(path){const response=await fetch(`https://api.spotify.com/v1${path}`,{headers:{authorization:`Bearer ${await accessToken()}`}});if(response.status===401){localStorage.removeItem(TOKEN_KEY);throw new Error('Spotify 登入已過期，請重新連接')}if(!response.ok)throw new Error(`Spotify 回應 ${response.status}`);return response.json()}
function trackView(t){return{id:t.id,name:t.name,artists:t.artists.map(a=>a.name).join(', '),album:t.album.name,durationMs:t.duration_ms,image:t.album.images?.[0]?.url||'',spotifyUrl:t.external_urls?.spotify||`https://open.spotify.com/track/${t.id}`}}
function spotifyId(value){return String(value).match(/(?:open\.spotify\.com\/track\/|spotify:track:)([A-Za-z0-9]{22})/)?.[1]||null}

async function findLyrics(t){
  const query=new URLSearchParams({track_name:t.name,artist_name:t.artists,album_name:t.album,duration:String(Math.round(t.durationMs/1000))});
  const response=await fetch(`https://lrclib.net/api/get?${query}`,{headers:{'Lrclib-Client':'LyricPair-GitHub-Pages/2.0'}});
  if(response.status===404)throw new Error('找不到相符內容，你仍可手動貼上。');
  if(response.status===429)throw new Error('查詢過於頻繁，請稍後再試。');
  if(!response.ok)throw new Error(`查詢來源暫時不可用（${response.status}）`);
  return response.json();
}

document.querySelectorAll('.tab').forEach(tab=>tab.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));tab.classList.add('active');mode=tab.dataset.tab;$('#findInput').placeholder=mode==='link'?'https://open.spotify.com/track/…':'輸入歌名或歌手'});
$('#spotifyAuth').onclick=()=>tokenData()?(localStorage.removeItem(TOKEN_KEY),location.reload()):connectSpotify();
$('#findForm').onsubmit=async e=>{e.preventDefault();const value=$('#findInput').value.trim();$('#results').innerHTML='<p class="hint">正在尋找…</p>';try{if(mode==='link'){const id=spotifyId(value);if(!id)throw new Error('這不是有效的 Spotify 歌曲連結');selectTrack(trackView(await spotify(`/tracks/${id}`)))}else{const data=await spotify(`/search?type=track&limit=8&q=${encodeURIComponent(value)}`);renderResults(data.tracks.items.map(trackView))}}catch(err){$('#results').innerHTML=`<p class="notice">${escapeHtml(err.message)}</p>`}};
function renderResults(items){$('#results').innerHTML=items.length?items.map((t,i)=>`<button class="result" data-i="${i}"><img src="${t.image}" alt=""><strong>${escapeHtml(t.name)}<span>${escapeHtml(t.artists)} · ${escapeHtml(t.album)}</span></strong></button>`).join(''):'<p class="notice">找不到相符歌曲</p>';document.querySelectorAll('.result').forEach(b=>b.onclick=()=>selectTrack(items[Number(b.dataset.i)]))}
async function selectTrack(t){$('#workspace').classList.remove('hidden');$('#cover').src=t.image;$('#trackName').textContent=t.name;$('#trackMeta').textContent=`${t.artists} · ${t.album}`;$('#spotifyLink').href=t.spotifyUrl;$('#results').innerHTML='';$('#original').value='';$('#sourceBadge').textContent='查詢中';$('#lyricsStatus').textContent='正在查詢…';window.scrollTo({top:$('#workspace').offsetTop-20,behavior:'smooth'});try{const d=await findLyrics(t);$('#original').value=d.plainLyrics||'';$('#sourceBadge').textContent='LRCLIB';$('#lyricsStatus').textContent=d.instrumental?'此曲目被標示為純音樂。':'已取得原文，可先確認內容。'}catch(err){$('#sourceBadge').textContent='可手動貼上';$('#lyricsStatus').textContent=err.message}}
$('#copyOriginal').onclick=()=>copy($('#original').value,'已複製原文');
$('#copyPrompt').onclick=()=>copy(promptText($('#original').value),'已複製 AI 翻譯提示與原文');
$('#makeCompare').onclick=()=>{const originals=lines($('#original').value),raw=lines($('#translation').value);let chinese=[];if(raw.length===originals.length)chinese=raw;else if(raw.length>=originals.length*2){for(let i=0;i<raw.length;i+=2)chinese.push(raw[i+1]||'')}else chinese=raw;$('#compare').classList.remove('empty');$('#compare').innerHTML=originals.map((line,i)=>`<div class="pair"><div>${escapeHtml(line)}</div><div class="zh">${escapeHtml(chinese[i]||'—')}</div></div>`).join('');if(chinese.length!==originals.length)toast('行數不同，請檢查未配對內容')};
$('#copyChinese').onclick=()=>{const originals=lines($('#original').value),raw=lines($('#translation').value);copy((raw.length>=originals.length*2?raw.filter((_,i)=>i%2===1):raw).join('\n'),'已複製中文譯文')};

async function init(){
  if(!config.spotifyClientId){$('#configHint').textContent='尚未設定 Spotify Client ID';$('#spotifyAuth').disabled=true;return}
  const code=new URLSearchParams(location.search).get('code');
  try{if(code)await exchangeCode(code)}catch(err){toast(err.message);history.replaceState({},'',location.pathname)}
  const connected=Boolean(tokenData());$('#authState').textContent=connected?'Spotify 已連接':'尚未連接 Spotify';$('#spotifyAuth').textContent=connected?'中斷連接':'連接 Spotify';$('#configHint').textContent=connected?'現在可以解析連結或搜尋歌曲。':'第一次使用請先連接 Spotify。';
}
init();
