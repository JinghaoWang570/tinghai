// A session queue of playable catalogue episodes; chapter navigation stays separate.
const episodeQueue=[];
let continuousPlayback=false,queueOpening=false;
function queueCatalogue(){return (discoveryCatalog?.categories||[]).flatMap(c=>c.items).filter(item=>item.ready)}
function enqueueEpisode(id){
 if(id===state.episode?.catalogId||episodeQueue.includes(id)||!queueCatalogue().some(item=>item.id===id))return false;
 episodeQueue.push(id);return true;
}
function onQueuedEpisodeOpened(id){const index=episodeQueue.indexOf(id);if(index>=0)episodeQueue.splice(index,1)}
function showEpisodeQueue(){
 const catalogue=queueCatalogue(),available=catalogue.filter(item=>item.id!==state.episode?.catalogId&&!episodeQueue.includes(item.id));
 showDialog('待播节目',`<div class="queue-heading"><span>整期播完后</span><label><input type="checkbox" data-continuous ${continuousPlayback?'checked':''}> 连续播放</label></div><p class="micro">${continuousPlayback?'按下面的顺序接着听，列表播完后停止。':'默认停在已听完，再点播放从第一章重播。'}</p>${state.episode?`<div class="queue-current"><small>${state.episode.listenEnded?'已听完':'当前节目'}</small><strong>${esc(state.episode.title)}</strong><button class="text-button" data-listen="playlist">查看本期章节 →</button></div>`:''}<h3>接下来 · ${episodeQueue.length}</h3>${episodeQueue.length?episodeQueue.map((id,index)=>{const item=catalogue.find(x=>x.id===id);return item?`<div class="queue-item"><span>${index+1}</span><div><strong>${esc(item.title)}</strong><small>${discoveryDuration(item.durationSeconds)}</small></div><button data-queue-up="${esc(id)}" ${index===0?'disabled':''} aria-label="上移：${esc(item.title)}">↑</button><button data-queue-remove="${esc(id)}" aria-label="移除：${esc(item.title)}">${icon('close')}</button></div>`:''}).join(''):'<p class="micro">还没有待播节目，选几期排进来吧。</p>'}<div class="queue-add"><select id="queue-choice" aria-label="选择待播节目" ${available.length?'':'disabled'}><option value="">选择一期节目</option>${available.map(item=>`<option value="${esc(item.id)}">${esc(item.title)}</option>`).join('')}</select><button class="text-button" data-queue-add>加入</button></div><p class="micro">当前可加入首页已备好音频的节目。队列保留在本次打开的页面中。</p>`);
}
async function onEpisodeFinished(ep){
 if(!continuousPlayback||!episodeQueue.length||queueOpening||state.episode!==ep)return;
 const id=episodeQueue[0];queueOpening=true;
 try{closeDialog();await openCurated(id,{autoplay:true})}finally{queueOpening=false}
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.hasAttribute('data-queue-open'))showEpisodeQueue();
 if(b.hasAttribute('data-queue-add')){const id=document.getElementById('queue-choice')?.value;if(enqueueEpisode(id))showEpisodeQueue()}
 if(b.dataset.queueRemove){const index=episodeQueue.indexOf(b.dataset.queueRemove);if(index>=0)episodeQueue.splice(index,1);showEpisodeQueue()}
 if(b.dataset.queueUp){const index=episodeQueue.indexOf(b.dataset.queueUp);if(index>0)[episodeQueue[index-1],episodeQueue[index]]=[episodeQueue[index],episodeQueue[index-1]];showEpisodeQueue()}
});
document.addEventListener('change',e=>{if(e.target.hasAttribute('data-continuous')){continuousPlayback=e.target.checked;showEpisodeQueue()}});
