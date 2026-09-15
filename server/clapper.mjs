export const CLAPPER_VOICE='中年男性快板演员，声音洪亮、结实有弹性，吐字干净，带传统曲艺的京味儿和亲切的幽默感；一位演员贯穿全场，不模仿真实艺人。';
function clapperError(message,status=502){return Object.assign(new Error(message),{status,code:'VOICE_ERROR'})}
export function clapperScriptTask(ctx,depth){return `你是听海的快板编剧。根据下方原回答与 reference_data 中可核实的材料，写一段有竹板伴奏的单人知识快板。
先简短问候听众，再从生活场景带出问题；正文分“问题引入”“问题分析”“结论总结”三个连续章节。speaker始终为A。${depth==='deep'?'总计500—650':'总计260—360'}个汉字，每章一段，每段用换行分隔韵句，不用段落散文充当快板。
押韵操作：先为每章选一个适合内容的主韵（例如江阳韵：上、想、讲、样、强），至少每对句的后一句落在同韵；大多数句子7—10字，长短句交错，一口气能说完，落板处要明确。可以在章间换韵，不在同一对句中随意换韵。先保证事实再调整语序、换同义词押韵，严禁为凑韵造事实、生造词或硬加“呀啊嘛”。不输出选韵过程。
每章至少两组上下句形成因果、对照、递进或包袱。用具体观察制造幽默，不攻击群体，不把不确定结论唱成确定事实。信息密集处通过短句和轻微停顿让听众听清。
表演标记可用中文括号，例如（竹板开场，两小节）（笑）（顿一拍）（竹板收尾）；这是全要素音频生成模型，允许明确的音乐、节奏和语气说明。每章最多三处必要标记，别每句加标签。竹板贯穿但低于人声。开场与收尾各一次，中间章节不再次问候、不重复片头。
末章回答最初问题，给出边界与可用的结论，然后自然收板，不以新问题吊胃口。发声人物由音频阶段统一定义，讲稿不写人名或“演员：”前缀。
输出前默读检查：相邻对句是否顺口，韵脚是否一致，有没有硬塞语气词，是否保留材料中的限制条件。只输出合法JSON：
{"segments":[{"chapterTitle":"问题引入","speaker":"A","text":"（竹板开场）\\n韵句一，\\n韵句二。","sourceIds":[]},{"chapterTitle":"问题分析","speaker":"A","text":"韵句","sourceIds":["S1"]},{"chapterTitle":"结论总结","speaker":"A","text":"韵句（竹板收尾）","sourceIds":[]}]}
sourceIds仅使用本段实际依据的现有材料编号，正文不读引用编号。材料不足就缩短，不伪造数据、亲身经历和专家身份。
原回答：${String(ctx.answer||'').slice(0,14000)}`}

export function splitClapperSegments(segments){
 const out=[];
 for(const [index,s] of segments.entries()){
  const text=String(s.text||'').replace(/\[S\d+\]/g,'').trim();if(!text)continue;
  // Keep rhyming lines together instead of sending every sentence to a TTS call.
  const lines=text.match(/[^\n。！？]+[\n。！？]*|[^\n。！？]+$/g)||[text];let part='';
  const push=()=>{if(part.trim())out.push({...s,speaker:'A',sourceIndex:index,text:part.trim()});part=''};
  for(let line of lines){if(part.length+line.length>360)push();while(line.length>360){part=line.slice(0,360);push();line=line.slice(360)}part+=line}push();
 }
 if(!out.length||out.reduce((n,s)=>n+s.text.length,0)>10000)throw clapperError('快板讲稿为空或过长',400);
 return out;
}
export const PERFORMANCE_VOICES={first:'一位年轻的讲述者，声音温暖自然、有亲近感，用第一人称角色化讲述，情绪细腻，吐字清晰，不模仿真实人物。',story:'一位沉稳的评书演员，声音浑厚清晰，抑扬顿挫，悬念处稍作停顿，叙事有画面感，不模仿真实艺人。',clapper:CLAPPER_VOICE};
export function clapperAudioRequest(segment,index,count,profile,style='clapper'){
 if(style!=='clapper'){
 const direction=style==='story'?'中文单人评书，叙事有起伏，悬念处停顿，可有轻微醒木声，不要竹板伴奏，不要双人对话。':'中文单人第一人称角色化讲述，亲近自然，情绪细腻，不伪造真实个人经历，不要竹板或评书伴奏，不要双人对话。';
 return {model:'seed-audio-1.0',text_prompt:`${direction}只表演给定内容，不添加内容。人物声音与表演描述：${String(profile||PERFORMANCE_VOICES[style]).slice(0,240)}。同一人物贯穿全段，括号内为表演指令，执行但不要念出。保持吐字清晰，20至90秒内完整讲完，最长120秒。表演内容：\n${segment.text}`,audio_config:{format:'mp3',sample_rate:44100,speech_rate:-10,enable_subtitle:true}};
 }
 const text_prompt=`一段传统中国快板表演，中文，单人表演。只表演给定内容，不扩写、不重复、不添加广告或旁白。预计时长20—90秒，完整说完本段并收住，不超过120秒。
人物音色简介：${String(profile||CLAPPER_VOICE).slice(0,240)}
伴奏：清脆竹板的大板和节子贯穿全段，有板有眼，节奏稳定，竹板清晰但不能盖过人声。${index===0?'先以两小节竹板独奏起板，再自然进人声。':'直接承接上一段的板眼，别重新开场或自我介绍。'}${index===count-1?'最后一句落板，短促有力地收板，干净结束。':'段尾留半拍过门，衔接下一章，不说再见。'}
表演：说唱结合、有传统曲艺韵味，洪亮但不喊叫，句尾韵脚清楚，按上下句落板。节奏明快而吐字从容，不抢拍，不逐字念。必要时有轻微笑意、语气词和停顿；括号内是表演指令，执行动作但不要把括号内容念出来。人声始终是一位演员，无第二人、无观众掌声、无其他配乐。
表演内容：
${segment.text}
整体氛围：幽默、亲切、讲得明白，尊重原文事实与韵脚。`;
 if(Array.from(text_prompt).length>3000)throw clapperError('快板提示词超过3000字符',400);
 return {model:'seed-audio-1.0',text_prompt,audio_config:{format:'mp3',sample_rate:44100,speech_rate:-10,enable_subtitle:true}};
}
export async function requestPerformanceAudio(env,body,signal){
 const apiKey=env.SEED_AUDIO_API_KEY||env.VOLC_API_KEY;
 if(!apiKey)throw clapperError('全要素音频服务尚未配置',503);
 signal?.throwIfAborted();
 const controller=new AbortController(),abort=()=>controller.abort(signal?.reason);signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>controller.abort(),240000);
 try{
  const r=await (env.VOICE_FETCH||fetch)('https://openspeech.bytedance.com/api/v3/tts/create',{method:'POST',headers:{'Content-Type':'application/json','X-Api-Key':apiKey,'X-Api-Request-Id':crypto.randomUUID()},body:JSON.stringify(body),signal:controller.signal});
  const data=await r.json();
  if(!r.ok||(data.code!=null&&![0,20000000].includes(data.code)))throw clapperError('表演音频生成失败（'+(data.code||r.status)+'），请重试或检查服务权限');
  if(typeof data.audio!=='string'||!data.audio.length||data.audio.length>24000000||!/^[A-Za-z0-9+/=]+$/.test(data.audio))throw clapperError('音频模型未返回有效音频');
  return {audio:data.audio,duration:data.duration,subtitle:data.subtitle,original_duration:data.original_duration};
 }catch(e){if(controller.signal.aborted&&!signal?.aborted)throw clapperError('表演音频生成超时，请重试',504);throw e}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
export async function* clapperAudio(env,segments,signal,profile,style='clapper',session){
 for(const [index,segment] of segments.entries()){
  signal?.throwIfAborted();yield {type:'round',index};
  const body=clapperAudioRequest(segment,(session?.start||0)+index,session?.total||segments.length,profile,style);
  if(session){body.references=session.references;body.text_prompt='参考音频中的唯一讲述者就是本期演员。严格保持参考音色、发声位置、口音与年龄感；文字描述只控制表演。只讲下方新正文，不复述参考样本内容。\n'+body.text_prompt;}
  const generate=()=>requestPerformanceAudio(env,body,signal);
  const data=session?await session.cached(body,generate):await generate();
  signal?.throwIfAborted();
  yield {type:'audio',index,data:data.audio};
  yield {type:'round-end',index,seconds:data.duration,subtitle:data.subtitle};
 }
}
