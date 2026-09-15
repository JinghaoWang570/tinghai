// Bind analysis to signed source context; late responses cannot replace another topic.
let narratorJob=null,narratorSource='',narratorError='',narratorFailedSource='';
function narratorReady(){return state.firstPersonNarrator&&narratorSource===state.result?.context}
let narratorConfirming=false;
function firstPersonReady(){return narratorReady()&&!narratorJob&&!narratorConfirming&&(state.firstPersonVoices||[]).some(v=>v.id===state.firstPersonPreset)}
function firstPersonVoiceContents(){
 if(!narratorReady())return '<p class="micro narrator-status">'+(narratorJob?'正在识别视角与音色…':narratorError?esc(narratorError)+' <button type="button" data-narrator-retry>重试</button>':'内容就绪后自动识别视角')+'</p>';
 const n=state.firstPersonNarrator,voices=state.firstPersonVoices||[],selected=voices.find(v=>v.id===state.firstPersonPreset);
 return '<p class="narrator-status">视角：'+esc(n.name)+'</p>'+(voices.length?'<label for="first-person-preset">音色</label><select id="first-person-preset" aria-label="音色">'+voices.map(v=>'<option value="'+esc(v.id)+'" '+(selected?.id===v.id?'selected':'')+'>'+esc(v.name)+'</option>').join('')+'</select>'+(selected?'<audio controls preload="none" aria-label="试听音色" style="width:100%;margin-top:12px" src="/audio/voices/'+encodeURIComponent(selected.id)+'.mp3"></audio>':''):'<p class="micro">材料不足以确定角色信息，请确认后匹配音色。</p>')+
 '<details '+(!voices.length?'open':'')+'><summary>调整角色信息</summary><label for="narrator-gender">角色性别</label><select id="narrator-gender"><option value="" '+(!["male","female"].includes(n.gender)?'selected':'')+'>请选择</option><option value="male" '+(n.gender==='male'?'selected':'')+'>男性</option><option value="female" '+(n.gender==='female'?'selected':'')+'>女性</option></select><label for="narrator-age">故事中的年龄段</label><select id="narrator-age">'+[['unknown','不明确'],['young','青年'],['adult','成年'],['senior','年长']].map(([v,label])=>'<option value="'+v+'" '+((n.ageGroup||'unknown')===v?'selected':'')+'>'+label+'</option>').join('')+'</select><button type="button" class="text-button" data-narrator-confirm '+(narratorConfirming?'disabled':'')+'>'+(narratorConfirming?'正在更新…':'确认并匹配音色')+'</button></details>'+(narratorError?'<p class="error">'+esc(narratorError)+'</p>':'');
}
function firstPersonVoiceSelection(){return '<div class="setting clapper-voice">'+firstPersonVoiceContents()+'</div>'}
function paintNarrator(){
 const box=document.querySelector('.clapper-voice');if(!box||state.style!=='first')return;
 box.innerHTML=firstPersonVoiceContents();
 const generateButton=document.querySelector('[data-action="generate"]');if(generateButton)generateButton.disabled=!state.answerReady||!!state.busy||!firstPersonReady();
}
function applyNarratorResult(result){state.result.context=result.context;narratorSource=result.context;state.firstPersonNarrator=result.narrator;state.firstPersonVoices=result.voices||[];state.firstPersonPreset=result.voicePreset;}
async function ensureNarrator(force=false){
 if(state.style!=='first'||!state.answerReady||!state.result?.context)return false;
 if(narratorReady()&&!force)return true;
 const source=state.result.context;
 if(narratorJob?.source===source)return narratorJob.promise;
 if(narratorFailedSource===source&&!force){paintNarrator();return false}
 narratorJob?.controller.abort();
 const current={source,controller:new AbortController()};narratorJob=current;narratorError='';
 current.promise=(async()=>{try{
  const result=await request('/api/narrator',{context:source},current.controller.signal);
  if(narratorJob!==current||state.result?.context!==source)return false;
  applyNarratorResult(result);
  state.performanceDescriptions??={};state.performanceDescriptions.first=result.narrator.voiceDescription;
  narratorFailedSource='';return true;
 }catch(error){if(narratorJob===current&&state.result?.context===source&&error.name!=='AbortError'){narratorError=error.message||'角色分析暂时失败';narratorFailedSource=source}return false}
 finally{if(narratorJob===current){narratorJob=null;paintNarrator()}}})();
 paintNarrator();return current.promise;
}
const renderBeforeNarrator=render;
render=function(){renderBeforeNarrator();if(state.page==='answer'||state.page==='configure'){paintNarrator();queueMicrotask(()=>ensureNarrator())}};
const generateBeforeNarrator=generate;
generate=async function(){if(state.style==='first'&&(!await ensureNarrator()||!firstPersonReady())){paintNarrator();return}return generateBeforeNarrator()};
document.addEventListener('change',e=>{if(e.target.name==='style'){paintNarrator();ensureNarrator()}});
document.addEventListener('click',e=>{if(e.target.closest('[data-narrator-retry]'))ensureNarrator(true)});

document.addEventListener('change',e=>{if(e.target.id==='first-person-preset'&&(state.firstPersonVoices||[]).some(v=>v.id===e.target.value)){state.firstPersonPreset=e.target.value;paintNarrator()}});
document.addEventListener('click',async e=>{if(!e.target.closest('[data-narrator-confirm]')||narratorConfirming||!narratorReady())return;const gender=document.getElementById('narrator-gender').value,ageGroup=document.getElementById('narrator-age').value;if(!gender){narratorError='请选择角色性别';paintNarrator();return}const source=state.result.context;narratorConfirming=true;narratorError='';paintNarrator();try{const result=await request('/api/narrator-confirm',{context:source,gender,ageGroup});if(state.result?.context===source)applyNarratorResult(result)}catch(error){if(state.result?.context===source)narratorError=error.message}finally{narratorConfirming=false;paintNarrator()}});
