const $ = s => document.querySelector(s);
const API = (window.LYRICPAIR_CONFIG?.apiBaseUrl || '').replace(/\/$/, '');
let mode = 'link';

const promptText = text => `請將以下由我提供的文字翻譯成自然、流暢的繁體中文。\n\n規則：\n1. 嚴格保留原文順序與分行，不合併或拆分任何一行。\n2. 每行先放原文，下一行放對應的繁體中文。\n3. 不添加解說、標題、註解、羅馬拼音或原文沒有的內容。\n4. 依語境自然翻譯；不確定時忠於原意，不自行編造。\n5. 重複的行也完整翻譯，不省略。\n\n待翻譯文字：\n${text}`;

function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function lines(s){return s.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)}
function spotifyId(value){return String(value).match(/(?:open\.spotify\.com\/track\/|spotify:track:)([A-Za-z0-9]{22})/)?.[1]||null}
async function copy(text,label){if(!text.trim())return toast('目前沒有可複製的內容');await navigator.clipboard.writeText(text);toast(label)}
async function api(path){if(!API)throw new Error('尚未設定 API_BASE_URL');const response=await fetch(`${API}${path}`);let data;try{data=await response.json()}catch{throw new Error(`後端回應異常（${response.status}）`)}if(!response.ok)throw new Error(data.error||`後端回應 ${response.status}`);return data}

document.querySelectorAll('.tab').forEach(tab=>tab.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));tab.classList.add('active');mode=tab.dataset.tab;$('#findInput').placeholder=mode==='link'?'https://open.spotify.com/track/…':'輸入歌名或歌手'});
$('#findForm').onsubmit=async e=>{e.preventDefault();const value=$('#findInput').value.trim();$('#results').innerHTML='<p class="hint">正在尋找…</p>';try{if(mode==='link'){const id=spotifyId(value);if(!id)throw new Error('這不是有效的 Spotify 歌曲連結');selectTrack(await api(`/api/track?id=${encodeURIComponent(id)}`))}else{if(!value)throw new Error('請輸入歌曲或歌手名稱');renderResults(await api(`/api/search?q=${encodeURIComponent(value)}`))}}catch(err){$('#results').innerHTML=`<p class="notice">${escapeHtml(err.message)}</p>`}};
function renderResults(items){$('#results').innerHTML=items.length?items.map((t,i)=>`<button class="result" data-i="${i}"><img src="${t.image}" alt=""><strong>${escapeHtml(t.name)}<span>${escapeHtml(t.artists)} · ${escapeHtml(t.album)}</span></strong></button>`).join(''):'<p class="notice">找不到相符歌曲</p>';document.querySelectorAll('.result').forEach(b=>b.onclick=()=>selectTrack(items[Number(b.dataset.i)]))}
async function selectTrack(t){$('#workspace').classList.remove('hidden');$('#cover').src=t.image;$('#trackName').textContent=t.name;$('#trackMeta').textContent=`${t.artists} · ${t.album}`;$('#spotifyLink').href=t.spotifyUrl;$('#results').innerHTML='';$('#original').value='';$('#sourceBadge').textContent='查詢中';$('#lyricsStatus').textContent='正在查詢…';window.scrollTo({top:$('#workspace').offsetTop-20,behavior:'smooth'});try{const d=await api(`/api/lyrics?track=${encodeURIComponent(t.name)}&artist=${encodeURIComponent(t.artists)}&album=${encodeURIComponent(t.album)}&durationMs=${t.durationMs}`);$('#original').value=d.lyrics;$('#sourceBadge').textContent='LRCLIB';$('#lyricsStatus').textContent=d.instrumental?'此曲目被標示為純音樂。':'已取得原文，可先確認內容。'}catch(err){$('#sourceBadge').textContent='可手動貼上';$('#lyricsStatus').textContent=err.message}}
$('#copyOriginal').onclick=()=>copy($('#original').value,'已複製原文');
$('#copyPrompt').onclick=()=>copy(promptText($('#original').value),'已複製 AI 翻譯提示與原文');
$('#makeCompare').onclick=()=>{const originals=lines($('#original').value),raw=lines($('#translation').value);let chinese=[];if(raw.length===originals.length)chinese=raw;else if(raw.length>=originals.length*2){for(let i=0;i<raw.length;i+=2)chinese.push(raw[i+1]||'')}else chinese=raw;$('#compare').classList.remove('empty');$('#compare').innerHTML=originals.map((line,i)=>`<div class="pair"><div>${escapeHtml(line)}</div><div class="zh">${escapeHtml(chinese[i]||'—')}</div></div>`).join('');if(chinese.length!==originals.length)toast('行數不同，請檢查未配對內容')};
$('#copyChinese').onclick=()=>{const originals=lines($('#original').value),raw=lines($('#translation').value);copy((raw.length>=originals.length*2?raw.filter((_,i)=>i%2===1):raw).join('\n'),'已複製中文譯文')};
if(!API){$('#configHint').textContent='尚未設定 API_BASE_URL，請先完成後端部署。';$('#findForm').querySelector('button').disabled=true}
