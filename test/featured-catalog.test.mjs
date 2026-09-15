import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {cloudStorage} from '../server/cloud-storage.mjs';
import {unseal} from '../server/app.mjs';
const expected={photography:'solo',gps:'solo','noise-cancel':'solo','blue-sky':'solo',coffee:'duo',music:'duo','ai-hallucination':'duo',procrastination:'duo','song-city':'story','silk-road':'story',declutter:'clapper',fridge:'clapper','cat-box':'first','sea-wave':'first',museum:'first'};
const labels={solo:'单人讲解',duo:'双人播客',story:'评书',clapper:'快板',first:'第一人称'};
test('all featured routes return matching titles, styles, audio engines and signed scripts',async()=>{
 const catalog=JSON.parse(await fs.readFile('public/data/discovery.json','utf8'));
 const items=catalog.categories.flatMap(c=>c.items);assert.equal(items.length,15);assert.equal(new Set(items.map(x=>x.id)).size,15);
 for(const item of items){
  const env={ZHIHU_ACCESS_SECRET:'catalog-test-secret'};
  const response=await cloudStorage(new Request('https://test/__local/catalog/'+item.id),env,'catalog-test');assert.equal(response.status,200);
  const {episode:ep}=await response.json(),ctx=await unseal(ep.context,env.ZHIHU_ACCESS_SECRET,'catalog-test');
  assert.equal(ep.title,item.title);assert.equal(ep.curatedId,item.id);assert.equal(ep.style,expected[item.id]);assert.equal(ctx.style,ep.style);assert.equal(item.style,labels[ep.style]);
  assert.equal(ep.engine,ep.style==='duo'?'podcast':ep.style==='solo'?'tts':'seed-audio');assert.equal(ep.audio.length,ep.segments.length);assert.ok(ep.audio.length>0);
  assert.ok(ep.audio.every(a=>a.data&&a.seconds>0));assert.ok(Math.abs(ep.audio.reduce((s,a)=>s+a.seconds,0)-item.durationSeconds)<=1);
  for(const segment of ep.segments){assert.ok(Number.isInteger(segment.sourceIndex));assert.ok(ctx.script[segment.sourceIndex]);}
  if(['first','story','clapper'].includes(ep.style)){assert.ok(ep.voiceProfile?.sampleHash);assert.equal(ep.voicePreset,ctx.voicePreset);assert.equal(ep.voiceProfile.preset,ctx.voicePreset);assert.equal(ep.voiceProfile.mode,'builtin')}
  if(ep.style==='first'){assert.equal(ep.narrator.name,ctx.narrator.name);assert.doesNotMatch(ep.segments.map(s=>s.text).join(''),/作为AI|我不是北宋人|角色化想象|仅供参考/)}
 }
});
test('featured cards show duration followed by the actual style and keep their catalog route',async()=>{
 const source=await fs.readFile('public/discovery-home.js','utf8');
 const ctx=vm.createContext({home(){},document:{addEventListener(){}},esc:String,icon:()=>'',fetch:()=>new Promise(()=>{})});vm.runInContext(source,ctx);
 ctx.item={id:'fridge',title:'冰箱里的食物，为什么要分区？',ready:true,durationSeconds:90,style:'快板',coverText:'冰箱'};ctx.category={color:'#fff'};
 const html=vm.runInContext('discoveryCard(item,category)',ctx);assert.match(html,/01:30 · 快板/);assert.match(html,/data-curated="fridge"/);
});
