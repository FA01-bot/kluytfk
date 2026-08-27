const $ = s => document.querySelector(s);
const auth = window.LYRICPAIR_CONFIG || {};
let mode = 'link';
let currentLyrics = '';

const promptText = text => `將下方文字逐行轉寫為羅馬拼音並翻譯成自然的繁體中文。收到內容後立刻從第一行結果開始輸出。\n\n每個非空白原文行固定連續輸出三行：\n原文：完整保留該行\n羅馬拼音：該行的羅馬化讀音\n繁中：該行的繁體中文翻譯\n\n必須遵守：\n1. 第一個輸出字元必須是「原文：」，不得在前面加入任何文字。\n2. 不得加入標題、歌曲名稱、作者、作品辨識、前言、摘要、解說、註解、免責聲明、搜尋建議、Markdown、引號、括號或結語。\n3. 嚴格保持原文順序，不合併、不拆分、不省略、不調換任何非空白行。\n4. 每組三行之間及相鄰兩組之間都不要插入空白行。\n5. 原文中的空白行只輸出一個空白行，不要輸出空的「原文：」「羅馬拼音：」「繁中：」。\n6. 日文使用 Hepburn 羅馬字；韓文使用修訂羅馬字；中文使用漢語拼音；其他非拉丁文字使用最常見的標準羅馬化。\n7. 原文已使用拉丁字母時，羅馬拼音保持相同拼寫。\n8. 翻譯必須忠於上下文並自然流暢；俚語、隱喻與省略依語境處理，不自行增加原文沒有的意思。\n9. 重複行也要在原本位置完整輸出，不得用「同上」代替。\n10. 最後一組「繁中：」完成後立即停止，不得附加任何文字。\n\n待處理文字如下：\n${text}`;

function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function spotifyId(value){return String(value).match(/(?:open\.spotify\.com\/track\/|spotify:track:)([A-Za-z0-9]{22})/)?.[1]||null}
async function copy(text,label){if(!text.trim())return toast('目前沒有可複製的內容');await navigator.clipboard.writeText(text);toast(label)}
function setCopyButtons(enabled){$('#copyOriginal').disabled=!enabled;$('#copyPrompt').disabled=!enabled}
function ensureToken(){if(!auth.accessToken)throw new Error('GitHub Actions 尚未產生 Spotify 憑證');if(Number(auth.expiresAt)<Date.now())throw new Error('Spotify 短效憑證已過期，請稍後等待 GitHub Actions 自動更新')}
async function spotify(path){ensureToken();const response=await fetch(`https://api.spotify.com/v1${path}`,{headers:{authorization:`Bearer ${auth.accessToken}`}});if(response.status===401)throw new Error('Spotify 短效憑證已過期，請稍後再試');if(!response.ok)throw new Error(`Spotify 回應 ${response.status}`);return response.json()}
function trackView(t){return{id:t.id,name:t.name,artists:t.artists.map(a=>a.name).join(', '),album:t.album.name,durationMs:t.duration_ms,image:t.album.images?.[0]?.url||'',spotifyUrl:t.external_urls?.spotify||`https://open.spotify.com/track/${t.id}`}}

async function findLyrics(t){const query=new URLSearchParams({track_name:t.name,artist_name:t.artists,album_name:t.album,duration:String(Math.round(t.durationMs/1000))});const response=await fetch(`https://lrclib.net/api/get?${query}`,{headers:{'Lrclib-Client':'LyricPair-GitHub-Pages/4.0'}});if(response.status===404)throw new Error('找不到相符內容');if(response.status===429)throw new Error('查詢過於頻繁，請稍後再試');if(!response.ok)throw new Error(`查詢來源暫時不可用（${response.status}）`);return response.json()}

document.querySelectorAll('.tab').forEach(tab=>tab.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));tab.classList.add('active');mode=tab.dataset.tab;$('#findInput').placeholder=mode==='link'?'https://open.spotify.com/track/…':'輸入歌名或歌手'});
$('#findForm').onsubmit=async e=>{e.preventDefault();const value=$('#findInput').value.trim();$('#results').innerHTML='<p class="hint">正在尋找…</p>';try{if(mode==='link'){const id=spotifyId(value);if(!id)throw new Error('這不是有效的 Spotify 歌曲連結');selectTrack(trackView(await spotify(`/tracks/${id}`)))}else{if(!value)throw new Error('請輸入歌曲或歌手名稱');const data=await spotify(`/search?type=track&limit=8&q=${encodeURIComponent(value)}`);renderResults(data.tracks.items.map(trackView))}}catch(err){$('#results').innerHTML=`<p class="notice">${escapeHtml(err.message)}</p>`}};
function renderResults(items){$('#results').innerHTML=items.length?items.map((t,i)=>`<button class="result" data-i="${i}"><img src="${t.image}" alt=""><strong>${escapeHtml(t.name)}<span>${escapeHtml(t.artists)} · ${escapeHtml(t.album)}</span></strong></button>`).join(''):'<p class="notice">找不到相符歌曲</p>';document.querySelectorAll('.result').forEach(b=>b.onclick=()=>selectTrack(items[Number(b.dataset.i)]))}
async function selectTrack(t){$('#workspace').classList.remove('hidden');$('#cover').src=t.image;$('#trackName').textContent=t.name;$('#trackMeta').textContent=`${t.artists} · ${t.album}`;$('#spotifyLink').href=t.spotifyUrl;$('#results').innerHTML='';currentLyrics='';setCopyButtons(false);$('#sourceBadge').textContent='查詢中';$('#lyricsStatus').textContent='正在取得歌詞…';window.scrollTo({top:$('#workspace').offsetTop-20,behavior:'smooth'});try{const d=await findLyrics(t);currentLyrics=(d.plainLyrics||'').trim();if(!currentLyrics)throw new Error(d.instrumental?'純音樂':'沒有可用歌詞');const lineCount=currentLyrics.split(/\r?\n/).filter(line=>line.trim()).length;$('#sourceBadge').textContent='已取得';$('#lyricsStatus').textContent=`${lineCount} 行，可直接複製`;setCopyButtons(true)}catch(err){currentLyrics='';$('#sourceBadge').textContent='未取得';$('#lyricsStatus').textContent=err.message;setCopyButtons(false)}}
$('#copyOriginal').onclick=()=>copy(currentLyrics,'已複製原文');
$('#copyPrompt').onclick=()=>copy(promptText(currentLyrics),'已複製 AI 指令');
$('#original')?.remove();
const lyricsHeading=$('#workspace .section-head h2');
if(lyricsHeading)lyricsHeading.textContent='歌詞';
setCopyButtons(false);
if(!auth.accessToken){$('#configHint').textContent='尚未連線';$('#findForm').querySelector('button').disabled=true}else if(Number(auth.expiresAt)<Date.now()){$('#configHint').textContent='憑證更新中'}else{$('#configHint').textContent='已連線'}
