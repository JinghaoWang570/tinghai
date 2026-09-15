// Bind analysis to signed source context; late responses cannot replace another topic.
let narratorJob=null,narratorSource='',narratorError='',narratorFailedSource='';
function narratorReady(){return state.firstPersonNarrator&&narratorSource===state.result?.context}
function paintNarrator(){
 const box=document.querySelector('.clapper-voice');if(!box||state.style!=='first')return;
 let status=box.querySelector('.narrator-status');if(!status){status=document.createElement('p');status.className='narrator-status';status.setAttribute('role','status');box.append(status)}
 status.innerHTML=narratorJob?'正在识别讲述角色与音色…':narratorReady()?'本期由「'+esc(state.firstPersonNarrator.name)+'」以第一人称讲述':narratorError?esc(narratorError)+' <button type="button" data-narrator-retry>重试角色分析</button>':'内容就绪后自动识别讲述角色';
 const field=box.querySelector('textarea');if(field){field.disabled=!!narratorJob;if(narratorReady()&&document.activeElement!==field)field.value=performanceDescription()}
 const generateButton=document.querySelector('[data-action="generate"]');if(generateButton)generateButton.disabled=!state.answerReady||!!state.busy||!narratorReady();
}
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
  state.result.context=result.context;narratorSource=result.context;state.firstPersonNarrator=result.narrator;
  state.performanceDescriptions??={};state.performanceDescriptions.first=result.narrator.voiceDescription;
  narratorFailedSource='';return true;
 }catch(error){if(narratorJob===current&&state.result?.context===source&&error.name!=='AbortError'){narratorError=error.message||'角色分析暂时失败';narratorFailedSource=source}return false}
 finally{if(narratorJob===current){narratorJob=null;paintNarrator()}}})();
 paintNarrator();return current.promise;
}
const renderBeforeNarrator=render;
render=function(){renderBeforeNarrator();if(state.page==='answer'||state.page==='configure'){paintNarrator();queueMicrotask(()=>ensureNarrator())}};
const generateBeforeNarrator=generate;
generate=async function(){if(state.style==='first'&&!await ensureNarrator()){paintNarrator();return}return generateBeforeNarrator()};
document.addEventListener('change',e=>{if(e.target.name==='style'){paintNarrator();ensureNarrator()}});
document.addEventListener('click',e=>{if(e.target.closest('[data-narrator-retry]'))ensureNarrator(true)});
