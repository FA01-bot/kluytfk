const $ = s => document.querySelector(s);
const auth = window.LYRICPAIR_CONFIG || {};
let mode = 'link';

const promptText = text => `請只處理以下由我提供的文字，不要辨識作品名稱，不要搜尋或補充未提供的內容。

請按照原文順序，為每一個非空白行提供羅馬拼音與繁體中文翻譯。

輸出格式：
第 1 行
羅馬拼音：……
繁中：……

第 2 行
羅馬拼音：……
繁中：……

規則：
1. 不要重新輸出或引用原文。
2. 每個原文行必須對應一組相同順序的結果，不得合併、拆分、省略或調換。
3. 日文使用 Hepburn 羅馬字。
4. 韓文使用修訂羅馬字。
5. 中文使用漢語拼音。
6. 其他非拉丁文字使用該語言最常見的標準羅馬化。
7. 原文已使用拉丁字母時，羅馬拼音欄填寫「同原文」，不要再次抄寫該行。
8. 繁中翻譯要自然、忠於語境，正確處理省略、俚語與隱喻，不自行編造。
9. 重複行也要按照原本位置逐行處理。
10. 只輸出指定格式，不要加入標題、作品辨識、前言、摘要、版權說明、搜尋建議、註解或總結。

以下是待處理文字：
${text}`;

function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function spotifyId(value){return String(value).match(/(?:open\.spotify\.com\/track\/|spotify:track:)([A-Za-z0-9]{22})/)?.[1]||null}
async function copy(text,label){if(!text.trim())return toast('目前沒有可複製的內容');await navigator.clipboard.writeText(text);toast(label)}
function ensureToken(){if(!auth.accessToken)throw new Error('GitHub Actions 尚未產生 Spotify 憑證');if(Number(auth.expiresAt)<Date.now())throw new Error('Spotify 短效憑證已過期，請稍後等待 GitHub Actions 自動更新')}
async function spotify(path){ensureToken();const response=await fetch(`https://api.spotify.com/v1${path}`,{headers:{authorization:`Bearer ${auth.accessToken}`}});if(response.status===401)throw new Error('Spotify 短效憑證已過期，請稍後再試');if(!response.ok)throw new Error(`Spotify 回應 ${response.status}`);return response.json()}
function trackView(t){return{id:t.id,name:t.name,artists:t.artists.map(a=>a.name).join(', '),album:t.album.name,durationMs:t.duration_ms,image:t.album.images?.[0]?.url||'',spotifyUrl:t.external_urls?.spotify||`https://open.spotify.com/track/${t.id}`}}

async function findLyrics(t){const query=new URLSearchParams({track_name:t.name,artist_name:t.artists,album_name:t.album,duration:String(Math.round(t.durationMs/1000))});const response=await fetch(`https://lrclib.net/api/get?${query}`,{headers:{'Lrclib-Client':'LyricPair-GitHub-Pages/4.0'}});if(response.status===404)throw new Error('找不到相符內容，你仍可手動貼上。');if(response.status===429)throw new Error('查詢過於頻繁，請稍後再試。');if(!response.ok)throw new Error(`查詢來源暫時不可用（${response.status}）`);return response.json()}

document.querySelectorAll('.tab').forEach(tab=>tab.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));tab.classList.add('active');mode=tab.dataset.tab;$('#findInput').placeholder=mode==='link'?'https://open.spotify.com/track/…':'輸入歌名或歌手'});
$('#findForm').onsubmit=async e=>{e.preventDefault();const value=$('#findInput').value.trim();$('#results').innerHTML='<p class="hint">正在尋找…</p>';try{if(mode==='link'){const id=spotifyId(value);if(!id)throw new Error('這不是有效的 Spotify 歌曲連結');selectTrack(trackView(await spotify(`/tracks/${id}`)))}else{if(!value)throw new Error('請輸入歌曲或歌手名稱');const data=await spotify(`/search?type=track&limit=8&q=${encodeURIComponent(value)}`);renderResults(data.tracks.items.map(trackView))}}catch(err){$('#results').innerHTML=`<p class="notice">${escapeHtml(err.message)}</p>`}};
function renderResults(items){$('#results').innerHTML=items.length?items.map((t,i)=>`<button class="result" data-i="${i}"><img src="${t.image}" alt=""><strong>${escapeHtml(t.name)}<span>${escapeHtml(t.artists)} · ${escapeHtml(t.album)}</span></strong></button>`).join(''):'<p class="notice">找不到相符歌曲</p>';document.querySelectorAll('.result').forEach(b=>b.onclick=()=>selectTrack(items[Number(b.dataset.i)]))}
async function selectTrack(t){$('#workspace').classList.remove('hidden');$('#cover').src=t.image;$('#trackName').textContent=t.name;$('#trackMeta').textContent=`${t.artists} · ${t.album}`;$('#spotifyLink').href=t.spotifyUrl;$('#results').innerHTML='';$('#original').value='';$('#sourceBadge').textContent='查詢中';$('#lyricsStatus').textContent='正在查詢…';window.scrollTo({top:$('#workspace').offsetTop-20,behavior:'smooth'});try{const d=await findLyrics(t);$('#original').value=d.plainLyrics||'';$('#sourceBadge').textContent='LRCLIB';$('#lyricsStatus').textContent=d.instrumental?'此曲目被標示為純音樂。':'已取得原文，可先確認內容。'}catch(err){$('#sourceBadge').textContent='可手動貼上';$('#lyricsStatus').textContent=err.message}}
$('#copyOriginal').onclick=()=>copy($('#original').value,'已複製原文');
$('#copyPrompt').onclick=()=>copy(promptText($('#original').value),'已複製 AI 翻譯提示與原文');
if(!auth.accessToken){$('#configHint').textContent='尚未連線';$('#findForm').querySelector('button').disabled=true}else if(Number(auth.expiresAt)<Date.now()){$('#configHint').textContent='憑證更新中'}else{$('#configHint').textContent='已連線'}
