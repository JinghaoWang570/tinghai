import {traceSocket,logEvent} from './api-log.mjs';
import {nodeVoiceConnect} from './voice-node.mjs';
export const voiceLog=[];
export function recordVoice(stage,details={}){logEvent({kind:'voice.diagnostic',phase:stage,...details});voiceLog.push({time:new Date().toISOString(),stage,...details});if(voiceLog.length>160)voiceLog.shift()}
export async function diagnosticConnect(url,headers){
 const id=crypto.randomUUID().slice(0,8),service=url.includes('/duplex/')?'duplex':url.includes('podcast')?'podcast':'speech';
 const record=(stage,extra={})=>recordVoice(stage,{id,service,endpoint:url,...extra});record('开始上游连接');
 try{
  const ws=await nodeVoiceConnect(url,headers);record('上游已连接',{requestId:ws.requestId});traceSocket(ws,{url});
  let audio=0,inputBytes=0,closedBy='upstream',peak=0,energy=0,samples=0,firstAudio=false;
  const send=ws.send;ws.send=function(data,...args){
   if(service==='duplex')try{const m=JSON.parse(data);if(m.type==='input_audio_buffer.append'){const pcm=Buffer.from(m.audio,'base64');inputBytes+=pcm.length;for(let i=0;i+1<pcm.length;i+=2){const value=pcm.readInt16LE(i);peak=Math.max(peak,Math.abs(value));energy+=value*value;samples++}}else if(m.type==='session.create')record('创建双工会话',{model:m.session?.model,voice:m.session?.audio?.output?.voice});else if(m.type==='input_audio_buffer.commit')record('提交录音',{inputBytes,inputSeconds:inputBytes/32000,pcmPeak:peak,pcmRms:samples?Math.round(Math.sqrt(energy/samples)):0});else if(m.type==='session.close'){closedBy='client';record('本地结束会话')}}catch{}
   return send.call(this,data,...args);
  };
  ws.on('message',(data,binary)=>{
   if(service!=='duplex'){if(binary)audio+=data.byteLength||data.length||0;return}
   try{const m=JSON.parse(Buffer.from(data).toString());
    if(m.type==='response.output_audio.delta'){audio+=Buffer.from(m.delta||'','base64').length;if(!firstAudio){firstAudio=true;record('收到首段回答音频',{audioBytes:audio})}return}
    if(['session.created','conversation.item.input_audio_transcription.started','input_audio_buffer.committed','conversation.item.input_audio_transcription.completed','response.function_call_arguments.done','response.done','response.output_audio.done','error'].includes(m.type))record(m.type,{audioBytes:audio,...(m.type==='error'?{error:m.error?.message||m.message,code:m.error?.code}: {})});
   }catch{}
  });
  ws.on('close',code=>record('上游关闭',{code,closedBy,inputBytes,...(service==='duplex'?{audioBytes:audio}:{receivedBinaryBytes:audio})}));return ws;
 }catch(e){record('上游连接失败',{error:e.message});throw e}
}
