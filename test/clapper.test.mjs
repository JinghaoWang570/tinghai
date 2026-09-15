import test from 'node:test';
import assert from 'node:assert/strict';
import {clapperAudio,clapperAudioRequest,splitClapperSegments} from '../server/clapper.mjs';
import {api,seal} from '../server/app.mjs';
import {collector} from '../scripts/api-log.mjs';
const memoryStore=()=>{const rows=new Map();return {read:async k=>rows.get(k),create:async(k,v)=>{if(!rows.has(k))rows.set(k,v);return rows.get(k)}}};
async function prepare(context,env){const r=await api(new Request('https://test/api/voice/profile',{method:'POST',body:JSON.stringify({context})}),env);assert.equal(r.status,200,await r.clone().text());return (await r.json()).context;}
const script=[{text:'（竹板开场）\n各位听友坐一旁，\n听海今儿把袜讲。',speaker:'A',sourceIds:['S1'],chapterTitle:'问题引入'}];
for(const style of ['first','story'])test(`${style} uses described Seed Audio voice and never TTS or podcast`,async()=>{
 let calls=0;
 const env={PERFORMANCE_STORE:memoryStore(),LOCAL_DEV:true,ZHIHU_ACCESS_SECRET:'test',VOLC_API_KEY:'test',VOICE_FETCH:async(url,init)=>{calls++;assert.match(url,/\/tts\/create$/);const body=JSON.parse(init.body);assert.equal(body.model,'seed-audio-1.0');assert.match(body.text_prompt,/温暖女声/);assert.equal(body.speaker,undefined);return Response.json({audio:'SUQzAAAA',duration:12})}};
 let context=await seal({answer:'回答',script:[{text:'（停顿）这是根据材料作出的角色化讲述。',speaker:'A'}],style,clapperVoice:'温暖女声',references:[]},'test','local-preview');
 context=await prepare(context,env);calls=0;
 const r=await api(new Request('https://test/api/voice/episode',{method:'POST',body:JSON.stringify({context,voice:'invalid-ignored'})}),env);const text=await r.text();assert.equal(calls,1);assert.match(text,/"engine":"seed-audio"/);assert.match(text,/"type":"complete"/);
});
test('clapper preserves performance lines, source mapping and independent HTTP parameters',()=>{
 const segments=splitClapperSegments(script);assert.equal(segments.length,1);assert.equal(segments[0].text,script[0].text);assert.equal(segments[0].sourceIndex,0);
 const body=clapperAudioRequest(segments[0],0,1,'清亮女声，利落亲切');assert.equal(body.model,'seed-audio-1.0');assert.equal(body.audio_config.speech_rate,-10);assert.equal(body.audio_config.enable_subtitle,true);assert.match(body.text_prompt,/清亮女声/);assert.match(body.text_prompt,/竹板/);assert.equal(body.references,undefined);assert.ok(body.text_prompt.length<3000);
});
test('clapper signed endpoint uses seed audio, accepts success without code and retains subtitles',async()=>{
 let calls=0;const env={PERFORMANCE_STORE:memoryStore(),LOCAL_DEV:true,ZHIHU_ACCESS_SECRET:'test',VOLC_API_KEY:'test',VOICE_FETCH:async(url,init)=>{calls++;assert.match(url,/\/tts\/create$/);const b=JSON.parse(init.body);assert.equal(b.model,'seed-audio-1.0');assert.match(b.text_prompt,/低沉男声/);assert.doesNotMatch(b.text_prompt,/不可信文本/);return Response.json({audio:'SUQzAAAA',duration:12,original_duration:10,subtitle:{text:'各位听友坐一旁'}})}};
 let context=await seal({answer:'回答',script,style:'clapper',clapperVoice:'低沉男声',references:[]},'test','local-preview');
 context=await prepare(context,env);calls=0;
 const r=await api(new Request('https://test/api/voice/episode',{method:'POST',body:JSON.stringify({context,text:'不可信文本',clapperVoice:'不可信文本'})}),env);const text=await r.text();assert.equal(calls,1);assert.match(text,/"engine":"seed-audio"/);assert.match(text,/"seconds":12/);assert.match(text,/各位听友坐一旁/);assert.match(text,/"type":"complete"/);
});
test('seed audio errors and empty success never fall back to TTS',async()=>{
 for(const data of [{code:45000030,message:'requested resource not granted'},{}]){let calls=0;await assert.rejects(async()=>{for await(const e of clapperAudio({VOLC_API_KEY:'test',VOICE_FETCH:async()=>{calls++;return Response.json(data)}},script))void e});assert.equal(calls,1)}
 const ctrl=new AbortController();ctrl.abort();await assert.rejects(async()=>{for await(const e of clapperAudio({VOLC_API_KEY:'test',VOICE_FETCH:()=>{throw Error('must not call')}},script,ctrl.signal))void e},/abort/i);
});
test('large complete audio response logs duration and subtitles, not base64',()=>{
 const c=collector('application/json');const value=JSON.stringify({audio:'A'.repeat(900000),duration:52,subtitle:{text:'测试字幕'}});for(let n=0;n<value.length;n+=64000)c.push(Buffer.from(value.slice(n,n+64000)));const result=c.result();assert.equal(result.audio.base64Bytes,675000);assert.equal(result.duration,52);assert.equal(result.subtitle.text,'测试字幕');assert.ok(JSON.stringify(result).length<300);
});
test('invalid clapper script cannot silently become a solo TTS program',async()=>{
 const env={LOCAL_DEV:true,ZHIHU_ACCESS_SECRET:'clapper-script-test',FETCH:async()=>Response.json({choices:[{message:{content:'这不是合法的JSON讲稿。'}}]})};
 let context=await seal({query:'袜子',answer:'根据场景选择。',references:[]},env.ZHIHU_ACCESS_SECRET,'local-preview');
 const response=await api(new Request('https://test/api/script',{method:'POST',body:JSON.stringify({context,style:'clapper'})}),env);assert.equal(response.status,502);assert.match(await response.text(),/INVALID_SCRIPT/);
});
