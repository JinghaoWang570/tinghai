import test from 'node:test';
import assert from 'node:assert/strict';
import {api,seal,unseal} from '../server/app.mjs';
import {ensurePerformanceProfile,loadPerformanceProfile,performanceProfile} from '../server/performance-profile.mjs';
import {createPerformanceStore} from '../server/performance-store.mjs';
import {sanitize} from '../scripts/api-log.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

function fixture(){
 const rows=new Map(),calls=[];
 const env={PUBLIC_DEPLOYMENT:true,ZHIHU_ACCESS_SECRET:'profile-test',VOLC_API_KEY:'test',
  PERFORMANCE_STORE:{read:async k=>rows.get(k),create:async(k,v)=>{if(!rows.has(k))rows.set(k,v);return rows.get(k)}},
  VOICE_FETCH:async(u,o)=>{const body=JSON.parse(o.body);calls.push(body);return Response.json({audio:Buffer.from('audio-'+calls.length).toString('base64'),duration:15})}};
 const ctx={style:'clapper',voiceRevision:crypto.randomUUID(),clapperVoice:'浑厚男声',script:[{text:'开篇说来一段话。'},{text:'故事接着往下讲。'},{text:'收尾说得清又亮。'}]};
 const owner=crypto.randomUUID();
 async function post(route,body){return api(new Request('https://test/api/voice/'+route,{method:'POST',headers:{'oai-authenticated-user-id':owner},body:JSON.stringify(body)}),env)}
 return {rows,calls,env,ctx,owner,post};
}
const events=async r=>(await r.text()).split('\n').filter(s=>s.startsWith('data:')).map(s=>JSON.parse(s.slice(5)));

test('public multi-request performance reuses one persisted reference and global first/last directions',async()=>{
 const f=fixture();let context=await seal(f.ctx,f.env.ZHIHU_ACCESS_SECRET,f.owner);
 const prepared=await f.post('profile',{context});assert.equal(prepared.status,200);const d=await prepared.json();context=d.context;
 assert.equal(f.calls.length,1);assert.equal(d.voiceProfile.mode,'reference');assert.ok(!JSON.stringify(d).includes('audio_data'));
 const audio=[];
 for(let start=0;start<3;start++){const e=await events(await f.post('episode',{context,start,clapperVoice:'恶意换演员'}));assert.equal(e.at(-1).type,'complete');assert.equal(e.find(x=>x.type==='round-end').index,start);audio.push(e.find(x=>x.type==='audio').data)}
 assert.equal(f.calls.length,4);const bodies=f.calls.slice(1);
 assert.equal(new Set(bodies.map(b=>b.references[0].audio_data)).size,1);
 assert.match(bodies[0].text_prompt,/两小节竹板独奏/);assert.doesNotMatch(bodies[0].text_prompt,/短促有力地收板/);
 assert.doesNotMatch(bodies[1].text_prompt,/两小节竹板独奏|短促有力地收板/);
 assert.match(bodies[2].text_prompt,/短促有力地收板/);assert.doesNotMatch(bodies[2].text_prompt,/两小节竹板独奏/);
 // A fresh context/environment reads the same persisted audio without re-synthesis.
 const replay=await events(await f.post('episode',{context,start:1}));assert.equal(replay.find(x=>x.type==='audio').data,audio[1]);assert.equal(f.calls.length,4);
 const again=await (await f.post('profile',{context})).json();assert.deepEqual(again.voiceProfile,d.voiceProfile);assert.equal(f.calls.length,4);
});

test('failed segment retries the same reference; missing sample never silently creates another',async()=>{
 const f=fixture();const p=await ensurePerformanceProfile(f.env,f.ctx,f.owner);f.ctx.voiceProfile=p;
 const session=await loadPerformanceProfile(f.env,f.ctx,f.owner);
 await assert.rejects(session.cached({text:'one'},()=>{throw Error('upstream failed')}));
 assert.equal([...f.rows.keys()].filter(k=>k.startsWith('voice-segments')).length,0);
 assert.equal((await loadPerformanceProfile({...f.env},f.ctx,f.owner)).references[0].audio_data,session.references[0].audio_data);
 f.rows.clear();await assert.rejects(ensurePerformanceProfile(f.env,f.ctx,f.owner),/不会自动/);assert.equal(f.calls.length,1);
});

test('identity changes with owner, script, description or version; signed profile is bound to script',async()=>{
 const f=fixture(),base=await performanceProfile(f.ctx,f.owner);
 for(const [ctx,owner] of [[f.ctx,'another'],[{...f.ctx,clapperVoice:'女声'},f.owner],[{...f.ctx,script:[{text:'不同'}]},f.owner],[{...f.ctx,voiceRevision:'new'},f.owner]])assert.notEqual((await performanceProfile(ctx,owner)).id,base.id);
 f.ctx.voiceProfile=await ensurePerformanceProfile(f.env,f.ctx,f.owner);
 await assert.rejects(loadPerformanceProfile(f.env,{...f.ctx,clapperVoice:'女声'},f.owner),/准备/);
 const signed=await seal(f.ctx,f.env.ZHIHU_ACCESS_SECRET,f.owner);await assert.rejects(unseal(signed,f.env.ZHIHU_ACCESS_SECRET,'another'));
});

test('concurrent profile preparation selects one sample and rejects overlong samples',async()=>{
 const f=fixture();const profiles=await Promise.all([ensurePerformanceProfile(f.env,f.ctx,f.owner),ensurePerformanceProfile(f.env,f.ctx,f.owner)]);
 assert.deepEqual(profiles[0],profiles[1]);assert.equal(f.calls.length,1);
 const bad=fixture();bad.env.VOICE_FETCH=async()=>Response.json({audio:'YWJj',duration:31});await assert.rejects(ensurePerformanceProfile(bad.env,bad.ctx,bad.owner),/时长/);assert.equal(bad.rows.size,0);
 const ctrl=new AbortController();ctrl.abort();await assert.rejects(ensurePerformanceProfile(f.env,{...f.ctx,voiceRevision:'aborted'},f.owner,ctrl.signal));assert.equal(f.calls.length,1);
});

test('disk storage atomically preserves the first sample across instances',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'tinghai-voice-test-'));
 try{const a=createPerformanceStore({TINGHAI_DATA_DIR:root}),b=createPerformanceStore({TINGHAI_DATA_DIR:root});const results=await Promise.all([a.create('voice-profiles/test.json',{audio:'first'}),b.create('voice-profiles/test.json',{audio:'second'})]);assert.deepEqual(results[0],results[1]);assert.deepEqual(await b.read('voice-profiles/test.json'),results[0]);}
 finally{await fs.rm(root,{recursive:true,force:true})}
});

test('reference audio is summarized in diagnostic logs',()=>{const result=sanitize({references:[{audio_data:'A'.repeat(1000)}]});assert.deepEqual(result.references,[{audio_data:{base64Bytes:750}}]);});
