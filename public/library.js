const libraryStorageKey='tinghai-library-v1';
const defaultLibraryProfile={name:'听海听友',avatar:'/assets/kanshan-player-default-eee0ee7689.webp'};

let pendingLibraryAvatar=null;
function validCustomAvatar(value){return typeof value==='string'&&value.length<2900000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)}
function libraryProfileOwner(){return state.oauth?.authenticated?(state.oauth.profile?.url||state.oauth.profile?.name||''):'local'}

function activeLibraryProfile(store=readLibrary()){
 const profile=state.oauth?.authenticated?state.oauth.profile:null;
 const name=String(profile?.name||'').trim().slice(0,80);
 let avatar='';
 try{const url=new URL(profile?.avatarUrl||'');if(url.protocol==='https:'&&/(^|\.)zhimg\.com$/i.test(url.hostname))avatar=url.href}catch{}
 const custom=store.profile.customOwner===libraryProfileOwner()&&validCustomAvatar(store.profile.customAvatar)?store.profile.customAvatar:'';
 return {name:name||store.profile.name,avatar:custom||avatar||defaultLibraryProfile.avatar};
}
function readLibrary(){
 try{
  const raw=localStorage.getItem(libraryStorageKey);let value=JSON.parse(raw||'{}');
  if(!raw){const prior=JSON.parse(localStorage.getItem('tinghai.listening.v1')||'null');if(prior?.version===1&&Array.isArray(prior.episodes)){value={profile:prior.profile,history:prior.episodes.map(r=>({...r,coverImage:r.cover,duration:r.total})),favorites:prior.episodes.filter(r=>r.favorite).map(r=>r.id)}}}
  const profile={...defaultLibraryProfile,...value?.profile};profile.avatar=defaultLibraryProfile.avatar;if(!validCustomAvatar(profile.customAvatar))delete profile.customAvatar;
  profile.name=String(profile.name||defaultLibraryProfile.name).slice(0,24);
  return {profile,history:Array.isArray(value?.history)?value.history.filter(r=>r&&typeof r.id==='string'&&typeof r.title==='string'):[],favorites:Array.isArray(value?.favorites)?value.favorites.filter(id=>typeof id==='string'):[]};
 }catch{return {profile:{...defaultLibraryProfile},history:[],favorites:[]}}
}
function writeLibrary(value){try{localStorage.setItem(libraryStorageKey,JSON.stringify(value));return true}catch{toast('本机存储不可用，无法保存记录');return false}}

function libraryEpisodeId(ep){
 if(!ep)return '';
 if(ep.catalogId||ep.curatedId)return 'catalog:'+(ep.catalogId||ep.curatedId);
 if(ep.localDemo)return 'demo';
 if(!ep.libraryId)ep.libraryId=crypto.randomUUID();
 return 'episode:'+ep.libraryId;
}
function libraryEpisodeMeta(ep){const position=typeof listenPosition==='function'?listenPosition():{elapsed:0,total:0};return {id:libraryEpisodeId(ep),title:ep.title||'未命名节目',subtitle:ep.subtitle||'',coverImage:ep.coverImage||defaultLibraryProfile.avatar,style:ep.style||'solo',index:state.index,offset:Number(episodeAudio?.currentTime)||0,ended:!!ep.listenEnded,elapsed:Math.floor(position.elapsed||0),duration:Math.floor(position.total||0)}}
function recentListening(){return readLibrary().history.filter(r=>r.lastHeard).sort((a,b)=>b.lastHeard-a.lastHeard).slice(0,3)}
function rememberLibraryEpisode(ep=state.episode,started=false){
 // The audio cleanup handler runs before pagehide. Do not overwrite its saved
 // position with zero after the Audio object has already been released.
 if(!ep||(!started&&!episodeAudio))return;const store=readLibrary(),id=libraryEpisodeId(ep),old=store.history.find(r=>r.id===id);
 if(!started&&!old?.lastHeard)return;
 const item={...old,...libraryEpisodeMeta(ep),lastHeard:started?Date.now():old.lastHeard};
 store.history=[item,...store.history.filter(row=>row.id!==id)];writeLibrary(store);
 if(started&&ep.audioStatus==='ready')archiveLibraryEpisode(ep).catch(()=>{});
}
function rememberListening(started=false){rememberLibraryEpisode(state.episode,started)}

function isLibraryFavorite(ep=state.episode){const id=libraryEpisodeId(ep);return !!id&&readLibrary().favorites.includes(id)}
function libraryFavoriteButton(ep){const active=isLibraryFavorite(ep);return `<button class="listen-favorite ${active?'active':''}" data-library-favorite aria-label="${active?'取消收藏节目':'收藏节目'}" aria-pressed="${active}">${icon('heart')}</button>`}
function paintLibraryFavorite(){const button=document.querySelector('[data-library-favorite]');if(!button)return;const active=isLibraryFavorite();button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',active?'取消收藏节目':'收藏节目');button.innerHTML=icon('heart')}
async function toggleLibraryFavorite(){
 if(!state.episode)return;const ep=state.episode,id=libraryEpisodeId(ep),store=readLibrary(),active=store.favorites.includes(id);
 store.favorites=active?store.favorites.filter(value=>value!==id):[id,...store.favorites.filter(value=>value!==id)];
 if(!store.history.some(row=>row.id===id))store.history.push(libraryEpisodeMeta(ep));
 if(!writeLibrary(store))return;paintLibraryFavorite();toast(active?'已取消收藏':'已收藏到我的收听');
 if(!active&&ep.audioStatus==='ready')try{await archiveLibraryEpisode(ep)}catch(e){toast('收藏已记录，音频保存失败：'+e.message)}
}
function libraryTime(item){if(item.ended)return '已听完'+(item.duration?' · '+listenClock(item.duration):'');return (item.lastHeard?'听至 '+listenClock(item.elapsed||0):'尚未收听')+(item.duration?' · '+listenClock(item.duration):'')}

function libraryRows(items,empty){if(!items.length)return `<div class="library-empty"><img src="/assets/kanshan-listening-50844f827e.webp" alt="看山正在等你一起听"><p>${empty}</p></div>`;return `<div class="library-list">${items.map(item=>`<button class="library-episode" data-library-open="${esc(item.id)}" ${libraryOpening?'disabled':''}><img src="${esc(typeof listenCoverImage==='function'?listenCoverImage(item):item.coverImage||defaultLibraryProfile.avatar)}" alt="" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${defaultLibraryProfile.avatar}'"><span><strong>${esc(item.title)}</strong><small>${libraryTime(item)}</small><span class="library-progress"><i style="width:${item.duration?Math.min(100,(item.elapsed||0)/item.duration*100):0}%"></i></span></span>${icon('play')}</button>`).join('')}</div>`}
function library(){const store=readLibrary(),profile=activeLibraryProfile(store),history=recentListening(),connected=!!state.oauth?.authenticated;return `<section class="library-page"><header class="library-profile"><img src="${esc(profile.avatar)}" alt="${esc(profile.name)}的头像" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${defaultLibraryProfile.avatar}'"><div><h1>${esc(profile.name)}</h1><p>${connected?'知乎账号已连接':'本机资料 · 未登录'}</p></div><button data-nav="settings" aria-label="设置">${icon('settings')}</button></header><section class="library-section"><div class="library-section-head"><h2>收听历史</h2><span>最近 3 期</span></div>${libraryRows(history,'开始播放一期节目后，会出现在这里。')}</section><div class="library-actions"><button data-nav="favorites">${icon('heart')}<span><strong>我的收藏</strong><small>${store.favorites.length?store.favorites.length+' 期节目':'收藏喜欢的节目'}</small></span>${icon('arrow')}</button><button data-nav="settings">${icon('settings')}<span><strong>设置</strong><small>头像、用户名与账号</small></span>${icon('arrow')}</button><button data-library-logout ${connected?'':'disabled'}>${icon('logout')}<span><strong>退出登录</strong><small>${connected?'退出当前知乎账号':'尚未登录'}</small></span></button></div><p class="library-local-note">收听记录和收藏保存在本机</p></section>`}
function libraryFavorites(){const store=readLibrary(),byId=new Map(store.history.map(item=>[item.id,item])),items=store.favorites.map(id=>byId.get(id)).filter(Boolean);return `<section class="library-page library-subpage">${head('library','我的收藏',items.length+' 期')}<h1>留住想再听一次的声音</h1>${libraryRows(items,'还没有收藏节目。播放时点一下心形按钮，就能在这里找到。')}</section>`}
function librarySettings(){const store=readLibrary(),profile=activeLibraryProfile(store);return `<section class="library-page library-subpage">${head('library','设置','')}<h1>我的听海</h1><form id="library-profile-form" class="library-settings"><fieldset><legend>头像</legend><div class="avatar-upload"><img id="avatar-upload-preview" src="${esc(pendingLibraryAvatar?.owner===libraryProfileOwner()?pendingLibraryAvatar.data:profile.avatar)}" alt="当前头像" referrerpolicy="no-referrer"><label class="avatar-upload-button" for="library-avatar-upload" aria-label="上传自定义头像"><span aria-hidden="true" class="avatar-upload-plus">＋</span><input id="library-avatar-upload" type="file" aria-label="上传自定义头像" accept="image/png,image/jpeg,image/webp"></label></div><p class="micro">默认使用知乎头像，可上传 JPG、PNG 或 WebP（不超过 2 MB）。</p></fieldset><label for="library-name">用户名</label><input id="library-name" name="library-name" value="${esc(profile.name)}" maxlength="80" ${state.oauth?.authenticated?'readonly aria-label="知乎用户名"':'required'}><p>资料、历史与收藏目前保存在这台设备。</p><button class="primary" type="submit">保存设置</button></form><section class="library-account"><h2>账号</h2><p>${state.oauth?.authenticated?'知乎账号已连接':'当前未登录知乎账号'}</p>${state.oauth?.authenticated?'<button class="library-logout" data-action="oauth-logout">退出登录</button>':'<button class="secondary" data-action="oauth-login">登录知乎</button>'}</section></section>`}
let libraryOpening=false;
async function openLibraryEpisode(id){
 if(libraryOpening)return;
 if(id===libraryEpisodeId(state.episode)){nav('player');return}
 const item=readLibrary().history.find(row=>row.id===id);if(!item)return;
 const page=state.page,urls=[];libraryOpening=true;render();
 try{
  const path=id.startsWith('catalog:')?'/__local/catalog/'+encodeURIComponent(id.slice(8)):id==='demo'?'/__local/demo':/^episode:[a-f0-9-]{36}$/.test(id)?'/__local/episodes/'+encodeURIComponent(id.slice(8)):null;
  if(!path)throw Error('节目标识无效');
  const response=await fetch(path,{signal:AbortSignal.timeout(15000)}),data=await response.json();if(!response.ok||!data.episode)throw Error(data.error||'本机尚未保存这期完整音频');
  const ep=data.episode;ep.coverImage=item.coverImage;if(id.startsWith('catalog:'))ep.catalogId=id.slice(8);if(id==='demo')ep.localDemo=true;
  ep.audio=ep.audio.map(a=>{const url=URL.createObjectURL(new Blob([Uint8Array.from(atob(a.data),c=>c.charCodeAt(0))],{type:'audio/mpeg'}));urls.push(url);return {url,seconds:a.seconds,duration:a.duration}});
  if(state.page!==page)return;
  stopInterrupt(false);clearEpisodeAudio();for(const url of urls)audioUrls.add(url);
  state.episode=ep;state.followContext=ep.context;ep.followContext=null;ep.listenEnded=!!item.ended;state.index=item.ended?0:Math.min(item.index||0,ep.audio.length-1);state.playing=false;state.paused=true;state.waitingForAudio=null;
  nav('player');await playCloudSegment(true);
  const audio=episodeAudio;
  const restore=()=>{if(state.episode===ep&&episodeAudio===audio)audio.currentTime=item.ended?0:Math.min(item.offset||0,Number.isFinite(audio.duration)?Math.max(0,audio.duration-.05):item.offset||0)};
  if(audio.readyState)restore();else audio.addEventListener('loadedmetadata',restore,{once:true});
  for(const a of ep.audio){const probe=new Audio(a.url);probe.onloadedmetadata=()=>{a.seconds=probe.duration;probe.onloadedmetadata=null};probe.load()}
 }catch(e){toast(e.name==='TimeoutError'?'节目加载超时，请重试':e.message)}finally{libraryOpening=false;if(state.page===page)render();if(!state.episode?.audio?.some(a=>urls.includes(a.url)))urls.forEach(url=>URL.revokeObjectURL(url))}
}
const libraryArchives=new WeakMap();

async function archiveLibraryEpisode(ep){
 if(!ep||ep.audioStatus!=='ready'||!ep.audio?.length||ep.catalogId||ep.curatedId||ep.localDemo)return;
 if(libraryArchives.has(ep))return libraryArchives.get(ep);
 const run=(async()=>{const id=libraryEpisodeId(ep).slice(8),audio=await Promise.all(ep.audio.map(async row=>{const response=await fetch(row.url);if(!response.ok)throw Error('读取音频失败');const blob=await response.blob(),data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob)});return {duration:row.duration,seconds:row.seconds,data}}));const response=await fetch('/__local/episodes/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...ep,audio})});if(!response.ok)throw Error((await response.json()).error||'节目保存失败')})();
 libraryArchives.set(ep,run);try{await run}catch(e){libraryArchives.delete(ep);throw e}
}


Object.assign(icons,{logout:'M9 4H4v16h5M9 12h12m-4-4 4 4-4 4',heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',settings:'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z'});
document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.hasAttribute('data-library-favorite'))toggleLibraryFavorite();if(button.dataset.libraryOpen)openLibraryEpisode(button.dataset.libraryOpen);if(button.hasAttribute('data-library-logout')&&state.oauth?.authenticated){rememberListening();stopInterrupt(false);pauseCloudAudio();oauthLogout()}});
document.addEventListener('submit',event=>{if(event.target.id!=='library-profile-form')return;event.preventDefault();const store=readLibrary(),name=document.getElementById('library-name').value.trim();if(!name){toast('请输入用户名');return}store.profile={...store.profile,name:name.slice(0,24)};if(pendingLibraryAvatar?.owner===libraryProfileOwner()){store.profile.customAvatar=pendingLibraryAvatar.data;store.profile.customOwner=pendingLibraryAvatar.owner;}if(writeLibrary(store)){pendingLibraryAvatar=null;toast('设置已保存');nav('library')}});
setInterval(()=>{if(state.playing&&state.episode)rememberLibraryEpisode()},5000);
window.addEventListener('pagehide',()=>{rememberListening()});
render();

document.addEventListener('change',async event=>{if(event.target.id!=='library-avatar-upload')return;const file=event.target.files?.[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>2*1024*1024){toast('请选择不超过 2 MB 的 JPG、PNG 或 WebP 图片');event.target.value='';return}const owner=libraryProfileOwner();try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});await new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=reject;image.src=data});if(owner!==libraryProfileOwner())return;pendingLibraryAvatar={owner,data};const preview=document.getElementById('avatar-upload-preview');if(preview)preview.src=data;toast('头像已选择，保存设置后生效')}catch{toast('这张图片无法读取，请换一张')}});
