import test from 'node:test';
import assert from 'node:assert/strict';
import {episodeScriptTask} from '../server/host-prompts.mjs';
import {addStoryOpening} from '../server/story.mjs';
import {ensurePerformanceProfile,loadPerformanceProfile} from '../server/performance-profile.mjs';
import {BUILTIN_CLAPPER,BUILTIN_STORY} from '../server/builtin-voices.mjs';
import {api,seal,unseal} from '../server/app.mjs';
test('story opening precedes speech and allows sparse performance actions without contradictory TTS rules',()=>{
 const task=episodeScriptTask({query:'茶香',answer:'茶叶有香气。'},'story','short');assert.match(task,/茶香/);assert.match(task,/四句七言/);assert.match(task,/拍醒木/);assert.doesNotMatch(task,/只合成人声|不使用括号表演标记/);
 const openingPoem=['一纸书来夜未央','半窗灯火照行囊','世间多少难明事','且听今宵细细讲'];
 const result=addStoryOpening(JSON.stringify({openingPoem}),{segments:[{text:'（轻拍醒木）话说这一天。'}]});assert.ok(result.segments[0].text.startsWith(openingPoem[0]));assert.match(result.segments[0].text,/（轻拍醒木）/);
 assert.throws(()=>addStoryOpening('{}',{segments:[{text:'正文'}]}),/定场诗/);
});
test('approved clapper sample is identical across new episodes without model calls',async()=>{
 const rows=new Map(),env={PERFORMANCE_STORE:{read:async k=>rows.get(k),create:async(k,v)=>{if(!rows.has(k))rows.set(k,v);return rows.get(k)}},VOICE_FETCH:()=>{throw Error('must not generate sample')}};
 const samples=[];for(const n of [1,2]){const ctx={style:'clapper',voicePreset:'clapper-v1',voiceRevision:String(n),script:[{text:'不同的节目'+n}],clapperVoice:'忽略旧描述'};ctx.voiceProfile=await ensurePerformanceProfile(env,ctx,'owner'+n);samples.push((await loadPerformanceProfile(env,ctx,'owner'+n)).references[0].audio_data);assert.equal(ctx.voiceProfile.mode,'builtin')}
 assert.equal(samples[0],BUILTIN_CLAPPER.audio);assert.equal(samples[1],samples[0]);assert.equal(rows.size,1);
});
test('new clapper scripts bind approved preset in signed context',async()=>{
 const env={LOCAL_DEV:true,ZHIHU_ACCESS_SECRET:'preset-script',FETCH:async()=>Response.json({choices:[{message:{content:JSON.stringify({segments:[{speaker:'A',text:'说起一段新文章。'}]})}}]})};
 const context=await seal({answer:'正文',query:'主题',references:[]},env.ZHIHU_ACCESS_SECRET,'local-preview');
 const r=await api(new Request('https://test/api/script',{method:'POST',body:JSON.stringify({context,style:'clapper',clapperVoice:'另一个声音'})}),env);assert.equal(r.status,200);
 const ctx=await unseal((await r.json()).context,env.ZHIHU_ACCESS_SECRET,'local-preview');assert.equal(ctx.voicePreset,'clapper-v1');assert.equal(ctx.clapperVoice,BUILTIN_CLAPPER.description);
});

test('approved story voice is reused exactly across episodes without generation',async()=>{
 const rows=new Map(),env={PERFORMANCE_STORE:{read:async k=>rows.get(k),create:async(k,v)=>{rows.set(k,v);return v}},VOICE_FETCH:()=>{throw Error('must not generate')}};
 for(const n of [1,2]){const ctx={style:'story',voicePreset:'story-v1',voiceRevision:String(n),script:[{text:'本期故事'+n}]};ctx.voiceProfile=await ensurePerformanceProfile(env,ctx,'owner'+n);assert.equal(ctx.voiceProfile.mode,'builtin');assert.equal((await loadPerformanceProfile(env,ctx,'owner'+n)).references[0].audio_data,BUILTIN_STORY.audio)}
 assert.equal(rows.size,1);
});
