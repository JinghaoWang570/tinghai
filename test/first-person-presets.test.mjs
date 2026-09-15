import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {FIRST_PERSON_CATALOG,firstPersonVoiceOptions,resolveFirstPersonVoice,narratorVoiceResult} from '../server/first-person-voices.mjs';
import {FIRST_PERSON_SAMPLES} from '../server/first-person-samples.mjs';
import {parseNarrator} from '../server/first-person.mjs';
import {ensurePerformanceProfile,loadPerformanceProfile} from '../server/performance-profile.mjs';
import {api,seal,unseal} from '../server/app.mjs';
const narrator={name:'苏轼',kind:'person',gender:'male',ageGroup:'adult',perspective:'我在黄州讲述生活',voiceDescription:'从容自然'};
test('gender is a hard filter, unknown ages use adult voices, animals may choose all six',()=>{
 assert.equal(FIRST_PERSON_CATALOG.length,6);
 for(const gender of ['male','female'])for(const ageGroup of ['young','adult','senior','unknown']){const n={...narrator,gender,ageGroup};assert.equal(firstPersonVoiceOptions(n).length,3);assert.equal(resolveFirstPersonVoice(n).id,`first-${gender}-${ageGroup==='unknown'?'adult':ageGroup}-${gender==='female'?'v2':'v1'}`);assert.throws(()=>resolveFirstPersonVoice(n,`first-${gender==='male'?'female':'male'}-adult-v1`),/不匹配/)}
 assert.throws(()=>resolveFirstPersonVoice({...narrator,gender:'unknown'}),/确认/);
 assert.equal(firstPersonVoiceOptions({kind:'object',gender:'unknown'}).length,6);
});
test('unsubstantiated gender claims become unknown',()=>{
 const raw={...narrator,genderBasis:'explicit',genderEvidence:'他是一位男性'};
 assert.equal(parseNarrator(JSON.stringify(raw),{answer:'这是一位书商。'}).gender,'unknown');
 assert.equal(parseNarrator(JSON.stringify({...raw,genderBasis:'unknown'})).gender,'unknown');
 assert.equal(parseNarrator(JSON.stringify({...raw,genderBasis:'established_identity',genderEvidence:'苏轼是北宋男性文人'}),{query:'苏轼的生活'}).gender,'male');
});
test('all six packaged samples are reused without per-episode synthesis',async()=>{
 const rows=new Map(),env={PERFORMANCE_STORE:{read:async k=>rows.get(k),create:async(k,v)=>{rows.set(k,v);return v}},VOICE_FETCH:()=>{throw Error('must not generate')}};
 for(const voice of FIRST_PERSON_CATALOG){const n={...narrator,gender:voice.gender,ageGroup:voice.age};const ctx={style:'first',narrator:n,script:[{text:'我讲述眼前的故事。'}],voicePreset:voice.id};ctx.voiceProfile=await ensurePerformanceProfile(env,ctx,'owner');const sample=FIRST_PERSON_SAMPLES.find(v=>v.id===voice.id);assert.ok(sample.seconds>0&&sample.seconds<=30);assert.equal((await loadPerformanceProfile(env,ctx,'owner')).references[0].audio_data,sample.audio)}
 assert.equal(rows.size,6);
});
test('script endpoint rejects wrong-gender or unknown-person voices before model calls; confirmation is signed',async()=>{
 let calls=0;const env={LOCAL_DEV:true,ZHIHU_ACCESS_SECRET:'first-preset-api',FETCH:()=>{calls++;throw Error('not expected')}};
 const call=(route,body)=>api(new Request('https://test/api/'+route,{method:'POST',body:JSON.stringify(body)}),env);
 const context=await seal({narrator,answer:'内容',references:[]},env.ZHIHU_ACCESS_SECRET,'local-preview');
 assert.equal((await call('script',{context,style:'first',voicePreset:'first-female-adult-v2',gender:'female'})).status,400);assert.equal(calls,0);
 const unknown=await seal({narrator:{...narrator,gender:'unknown'},answer:'内容'},env.ZHIHU_ACCESS_SECRET,'local-preview');
 assert.equal((await call('script',{context:unknown,style:'first'})).status,400);
 const response=await call('narrator-confirm',{context:unknown,gender:'female',ageGroup:'senior'});assert.equal(response.status,200);
 const data=await response.json(),ctx=await unseal(data.context,env.ZHIHU_ACCESS_SECRET,'local-preview');assert.equal(data.voicePreset,'first-female-senior-v2');assert.equal(ctx.narrator.genderBasis,'user_confirmed');assert.ok(data.voices.every(v=>v.gender==='female'));
});
test('viewpoint label omits gender and async analysis installs the matching voice options',async()=>{
 const c=vm.createContext({state:{style:'first',answerReady:true,result:{context:'source'}},document:{addEventListener(){},querySelector(){return null}},render(){},generate(){},AbortController,esc:String,queueMicrotask,request:async()=>({...narratorVoiceResult(narrator),context:'signed'})});
 vm.runInContext(fs.readFileSync('public/first-person.js','utf8'),c);await vm.runInContext('ensureNarrator()',c);
 assert.equal(c.state.firstPersonPreset,'first-male-adult-v1');assert.equal(c.state.firstPersonVoices.length,3);
 const html=vm.runInContext('firstPersonVoiceContents()',c);assert.match(html,/视角：苏轼<\/p>/);assert.doesNotMatch(html,/视角：苏轼[ ·]+男性/);assert.doesNotMatch(html,/<textarea/);assert.equal(vm.runInContext('firstPersonReady()',c),true);
});

test('automatic narrator matching keeps the latest selection when responses arrive out of order',async()=>{
 const pending=[],listeners={};
 const c=vm.createContext({state:{style:'first',answerReady:true,result:{context:'source'}},document:{addEventListener(type,fn){(listeners[type]??=[]).push(fn)},querySelector(){return null}},render(){},generate(){},AbortController,esc:String,queueMicrotask,request:async(url,body)=>url==='/api/narrator'?{...narratorVoiceResult(narrator),context:'signed'}:new Promise(resolve=>pending.push({body,resolve}))});
 vm.runInContext(fs.readFileSync('public/first-person.js','utf8'),c);await vm.runInContext('ensureNarrator()',c);
 const change=(id,value)=>listeners.change.forEach(fn=>fn({target:{id,value}}));
 change('narrator-gender','male');change('narrator-gender','female');
 assert.equal(pending.length,2);assert.equal(pending[1].body.gender,'female');assert.equal(pending[1].body.ageGroup,'adult');assert.equal(vm.runInContext('firstPersonReady()',c),false);
 pending[1].resolve({...narratorVoiceResult({...narrator,gender:'female',ageGroup:'adult'}),context:'newest'});await new Promise(r=>setImmediate(r));
 pending[0].resolve({...narratorVoiceResult({...narrator,gender:'female'}),context:'stale'});await new Promise(r=>setImmediate(r));
 assert.equal(c.state.result.context,'newest');assert.equal(c.state.firstPersonPreset,'first-female-adult-v2');assert.equal(vm.runInContext('firstPersonReady()',c),true);
 const html=vm.runInContext('firstPersonVoiceContents()',c);assert.doesNotMatch(html,/<details|确认并匹配|材料不足|narrator-age|请选择|已选择/);assert.ok(html.indexOf('角色性别')<html.indexOf('first-person-preset'));
 change('narrator-gender','');assert.equal(c.state.firstPersonVoices.length,0);assert.equal(vm.runInContext('firstPersonReady()',c),false);
});

test('active female presets use approved v2 sample files and male presets remain v1',()=>{
 for(const voice of FIRST_PERSON_CATALOG){assert.ok(voice.id.endsWith(voice.gender==='female'?'-v2':'-v1'));const sample=FIRST_PERSON_SAMPLES.find(v=>v.id===voice.id);assert.equal(fs.readFileSync('public/audio/voices/'+voice.id+'.mp3').toString('base64'),sample.audio)}
});
test('saved v1 female episodes retain their historical sample while new choices use v2',async()=>{
 const rows=new Map(),env={PERFORMANCE_STORE:{read:async k=>rows.get(k),create:async(k,v)=>{rows.set(k,v);return v}},VOICE_FETCH:()=>{throw Error('must not regenerate sample')}};
 const ctx={style:'first',narrator:{...narrator,gender:'female'},voicePreset:'first-female-young-v1',script:[{text:'我走进纸箱。'}]};
 ctx.voiceProfile=await ensurePerformanceProfile(env,ctx,'owner');assert.equal(ctx.voiceProfile.preset,'first-female-young-v1');
 const saved=await loadPerformanceProfile(env,ctx,'owner');assert.equal(saved.references[0].audio_data,FIRST_PERSON_SAMPLES.find(v=>v.id===ctx.voicePreset).audio);
});
