import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {visitor, signed, verified} from '../server/cloud-identity.mjs';
import {api, seal, unseal} from '../server/app.mjs';
import {validateSavedEpisode} from '../server/cloud-storage.mjs';

test('cloud visitor persists and rejects forged or expired identities', () => {
  const first=visitor('', 'secret'), cookie=first.cookie.split(';')[0];
  assert.equal(visitor(cookie,'secret').owner,first.owner);
  assert.notEqual(visitor(cookie,'other').owner,first.owner);
  assert.equal(verified(signed({expires:1},'secret'),'secret'),null);
});
test('public deployment cannot use owner credentials for personal APIs', async () => {
  let calls=0;
  for(const path of ['/api/personal','/api/quota','/api/base-items']) {
    const r=await api(new Request('https://test.example'+path,{headers:{'oai-authenticated-user-id':'visitor:test'}}),{PUBLIC_DEPLOYMENT:true,ZHIHU_ACCESS_SECRET:'test',FETCH:()=>{calls++;throw Error();}});
    assert.equal(r.status,401);
  }
  assert.equal(calls,0);
});
test('cloud archive validation rejects incomplete and non-audio payloads',()=>{
  assert.throws(()=>validateSavedEpisode({title:'a',audio:[{data:'abc='}],segments:[]},'episodes'));
  assert.throws(()=>validateSavedEpisode({title:'a',audio:['<html>']},'share'));
  validateSavedEpisode({title:'a',audio:['YWJj']},'share');
});
test('cloud audio continues with absolute clip indexes and only one manifest',async()=>{
  const context=await seal({style:'solo',script:[{text:'一句。二句。三句。四句。五句。'}]},'batch','visitor:batch');
  const env={PUBLIC_DEPLOYMENT:true,ZHIHU_ACCESS_SECRET:'batch',VOLC_API_KEY:'test',VOICE_FETCH:async()=>new Response('{"code":0,"data":"YWJj"}\n{"code":20000000}\n')};
  const call=async start=>{
    const r=await api(new Request('https://example.test/api/voice/episode',{method:'POST',headers:{'oai-authenticated-user-id':'visitor:batch'},body:JSON.stringify({context,start})}),env);
    return (await r.text()).split('\n').filter(s=>s.startsWith('data:')).map(s=>JSON.parse(s.slice(5)));
  };
  const first=await call(0),next=await call(4);
  assert.equal(first.find(e=>e.type==='manifest').segments.length,5);
  assert.equal(first.find(e=>e.type==='continue').start,4);
  assert.deepEqual(first.filter(e=>e.type==='round-end').map(e=>e.index),[0,1,2,3]);
  assert.equal(next.some(e=>e.type==='manifest'),false);
  assert.deepEqual(next.filter(e=>e.type==='round-end').map(e=>e.index),[4]);
  assert.equal(next.some(e=>e.type==='continue'),false);
});
test('cloud transport initializes identity once and never includes context in shared audio chunks', async()=>{
  const calls=[];let upload='';
  const original=async(url,opts={})=>{
    calls.push(url);
    if(url==='/api/session')return Response.json({ready:true});
    if(url==='/__local/transfer'){assert.equal(JSON.parse(opts.body).context,'private-context');return Response.json({ticket:'ticket',partSize:12});}
    if(url.startsWith('/__local/transfer/part')){upload+=opts.body;return Response.json({saved:true});}
    if(url.endsWith('/finish'))return Response.json({url:'/shared.html?id=test'});
    throw Error('unexpected '+url);
  };
  const context={window:{__TINGHAI_CLOUD__:true,fetch:original},URL,Response,location:{href:'https://test.example/',origin:'https://test.example'}};
  vm.runInNewContext(await fs.readFile(new URL('../public/cloud-transport.js',import.meta.url),'utf8'),context);
  const r=await context.window.fetch('/__local/share',{method:'POST',body:JSON.stringify({title:'你好🌊',audio:['YWJj'],context:'private-context'})});
  assert.equal(r.status,200);
  assert.deepEqual(JSON.parse(upload),{title:'你好🌊',audio:['YWJj']});
  assert.equal(calls.filter(x=>x==='/api/session').length,1);
});
test('Node deployment adapter ignores client identity headers and seals catalog for its own cookie',async()=>{
  const old=process.env.ZHIHU_ACCESS_SECRET;process.env.ZHIHU_ACCESS_SECRET='adapter-test';
  const {default:server}=await import('../api/index.mjs');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const base='http://127.0.0.1:'+server.address().port;
    const session=await fetch(base+'/api/index?route=/api/session');
    const cookie=session.headers.get('set-cookie').split(';')[0];
    const owner=visitor(cookie,'adapter-test').owner;
    const file=(await fs.readdir(new URL('../content/catalog/',import.meta.url)))[0].replace('.json','');
    const result=await fetch(base+'/api/index?route=/__local/catalog/'+file,{headers:{cookie,'oai-authenticated-user-id':'attacker'}});
    assert.equal(result.status,200);
    const data=await result.json();
    assert.ok((await unseal(data.episode.context,'adapter-test',owner)).script.length);
    await assert.rejects(unseal(data.episode.context,'adapter-test','attacker'));
    const foreign=await fetch(base+'/api/index?route=/api/session',{headers:{origin:'https://evil.example'}});
    assert.equal(foreign.status,403);
  }finally{await new Promise(resolve=>server.close(resolve));if(old===undefined)delete process.env.ZHIHU_ACCESS_SECRET;else process.env.ZHIHU_ACCESS_SECRET=old;}
});
