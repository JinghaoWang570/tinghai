import test from 'node:test';
import assert from 'node:assert/strict';
import {api,seal} from '../server/app.mjs';
import {voiceFrame} from '../server/voice.mjs';

test('in-program reply retains podcast speaker, captions and next-chapter context',async()=>{
 const secret='immersive';const context=await seal({query:'蓝天',style:'duo',references:[],status:[],script:[{speaker:'B',text:'蓝光发生散射。'},{speaker:'A',text:'下一段讲晚霞。'}]},secret,'local-preview');
 let prompt='',speaker='';
 class Socket extends EventTarget{
  send(raw){const event=new DataView(raw.buffer).getUint32(4);if(event===100){const size=new DataView(raw.buffer).getUint32(8),offset=12+size;const data=JSON.parse(new TextDecoder().decode(raw.slice(offset+4)));speaker=data.nlp_texts[0].speaker}
   queueMicrotask(()=>{if(event===102)this.dispatchEvent(new MessageEvent('message',{data:voiceFrame(361,{audio:'test'},'test')}));this.dispatchEvent(new MessageEvent('message',{data:voiceFrame(event===100?150:152,{},'test')}))});
  }
  close(){}
 }
 const r=await api(new Request('https://test/api/followup',{method:'POST',body:JSON.stringify({context,query:'为什么？',chapter:0,voiceReply:true,immersive:true,engine:'podcast'})}),{LOCAL_DEV:true,ZHIHU_ACCESS_SECRET:secret,VOLC_API_KEY:'test',FETCH:async(_u,options)=>{prompt=options.body;return new Response('data: '+JSON.stringify({choices:[{delta:{content:'这个问题和蓝光的散射有关，接着我们看看晚霞。'}}]})+'\n\ndata: [DONE]\n',{headers:{'Content-Type':'text/event-stream'}})},VOICE_CONNECT:async()=>new Socket()});
 const events=(await r.text()).split('\n').filter(x=>x.startsWith('data:')).map(x=>JSON.parse(x.slice(5)));
 assert.match(prompt,/下一段讲晚霞/);assert.match(prompt,/不是独立问答/);assert.match(prompt,/从被打断句子的开头继续播放/);assert.equal(speaker,'zh_male_liufei_uranus_bigtts');assert.ok(events.some(x=>x.type==='audio'));assert.equal(events.find(x=>x.type==='speech-end').speaker,'B');assert.equal(events.find(x=>x.type==='result').result.resumeChapter,0);
});
