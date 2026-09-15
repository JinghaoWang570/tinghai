import test from 'node:test';
import assert from 'node:assert/strict';
import {api,seal,unseal} from '../server/app.mjs';
import {narratorTask,parseNarrator} from '../server/first-person.mjs';
import {episodeScriptTask} from '../server/host-prompts.mjs';
const narrator={name:'宋朝书商',kind:'person',perspective:'我在书市解释印刷术如何改变书籍流通',voiceDescription:'温润的中音，口齿清晰，语速舒缓，带着书商分享见闻的亲切与好奇。'};
test('narrator analyzes people first and validates structured voice data',()=>{
 assert.match(narratorTask({query:'印刷术',answer:'宋朝书商'}),/优先选择.*人/);
 assert.deepEqual(parseNarrator(JSON.stringify(narrator)),narrator);
 assert.throws(()=>parseNarrator('{"name":"书商"}'),/格式不完整/);
 const prompt=episodeScriptTask({answer:'印刷术',narrator},'first','short');
 assert.match(prompt,/所有章节正文始终从这个角色的“我”/);
 assert.match(prompt,/禁止任何免责声明、身份否认、创作说明/);
 assert.doesNotMatch(prompt,/明确想象性质|开头只用/);
});
test('narrator is sealed to context and propagated into the first-person script and audio',async()=>{
 const secret='narrator-test',context=await seal({query:'印刷术',answer:'宋朝书商',references:[]},secret,'local-preview');let prompts=[];
 const env={LOCAL_DEV:true,ZHIHU_ACCESS_SECRET:secret,FETCH:async(_url,init)=>{const prompt=JSON.parse(init.body).messages[0].content;prompts.push(prompt);return Response.json({choices:[{message:{content:prompts.length===1?JSON.stringify(narrator):JSON.stringify({segments:[{chapterTitle:'问题引入',speaker:'A',text:'我是宋朝书商。我手中的书得益于印刷术。',sourceIds:[]}]})}}]})}};
 const call=(route,body)=>api(new Request('https://test'+route,{method:'POST',body:JSON.stringify(body)}),env);
 assert.equal((await call('/api/script',{context,style:'first'})).status,400);
 const analysis=await (await call('/api/narrator',{context})).json();assert.deepEqual(analysis.narrator,narrator);
 const result=await (await call('/api/script',{context:analysis.context,style:'first',clapperVoice:'清晰而温暖的低音'})).json();
 assert.equal(result.style,'first');assert.match(prompts[1],/宋朝书商/);
 const decoded=await unseal(result.context,secret,'local-preview');assert.equal(decoded.clapperVoice,'清晰而温暖的低音');assert.equal(decoded.narrator.name,narrator.name);
});
