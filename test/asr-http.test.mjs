import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {api} from '../server/app.mjs';

test('HTTP recording submits PCM once on release and preserves server errors',async()=>{
 let calls=0,body;const events=[];
 const ctx=vm.createContext({Uint8Array,AbortController,Blob,setTimeout,clearTimeout,fetch:async(url,options)=>{calls++;body=options.body;assert.equal(url,'/api/voice/transcribe');assert.equal(options.credentials,'same-origin');return new Response(JSON.stringify({text:'为什么？'}))}});
 vm.runInContext(fs.readFileSync('public/asr-http.js','utf8'),ctx);
 const c=vm.runInContext('new HttpAsrConnection()',ctx);c.onmessage=e=>events.push(JSON.parse(e.data));
 c.send(new Uint8Array([1,2,3,4]).buffer);assert.equal(calls,0);
 c.send('{"type":"stop"}');c.send('{"type":"stop"}');await new Promise(r=>setTimeout(r,10));
 assert.equal(calls,1);assert.equal(body.size,4);assert.deepEqual(events.filter(e=>e.type==='transcript').map(e=>e.text),['为什么？']);assert.ok(events.some(e=>e.type==='done'));
 ctx.fetch=async()=>new Response('{"error":"请先登录后使用听海"}',{status:401});
 const failed=vm.runInContext('new HttpAsrConnection()',ctx);failed.onmessage=e=>events.push(JSON.parse(e.data));failed.send(new Uint8Array([0,0]).buffer);failed.send('{"type":"stop"}');await new Promise(r=>setTimeout(r,10));assert.equal(events.at(-1).error,'请先登录后使用听海');
 ctx.fetch=async()=>new Response('<!DOCTYPE html><title>gateway error</title>',{status:502,headers:{'content-type':'text/html'}});
 const html=vm.runInContext('new HttpAsrConnection()',ctx);html.onmessage=e=>events.push(JSON.parse(e.data));html.send(new Uint8Array([0,0]).buffer);html.send('{"type":"stop"}');await new Promise(r=>setTimeout(r,10));assert.equal(events.at(-1).error,'服务返回异常，请稍后重试');
});

test('cancel discards recording without uploading',()=>{
 const ctx=vm.createContext({Uint8Array,AbortController,Blob,setTimeout,clearTimeout,fetch:()=>{throw Error('must not upload')}});vm.runInContext(fs.readFileSync('public/asr-http.js','utf8'),ctx);const c=vm.runInContext('new HttpAsrConnection()',ctx);c.send(new Uint8Array([0,0]).buffer);c.close();c.send('{"type":"stop"}');assert.equal(c.chunks.length,0);
});

test('authenticated HTTP transcription sends final PCM and requires final provider result',async()=>{
 let closed=false;const sent=[];class Socket extends EventTarget{send(frame){sent.push(frame);if(frame[1]===0x22){queueMicrotask(()=>{const body=new TextEncoder().encode('{"result":{"text":"天空为什么是蓝色？"}}');const frame=new Uint8Array(8+body.length);frame.set([0x11,0x92,0x10,0]);new DataView(frame.buffer).setUint32(4,body.length);frame.set(body,8);this.dispatchEvent(new MessageEvent('message',{data:frame.buffer}))})}}close(){closed=true;this.dispatchEvent(new Event('close'))}}
 const env={ZHIHU_ACCESS_SECRET:'test',VOLC_API_KEY:'test',VOICE_CONNECT:async()=>new Socket()};
 const request=(body,auth=true)=>new Request('https://test/api/voice/transcribe',{method:'POST',headers:{...(auth?{'oai-authenticated-user-id':'asr-test'}:{}),origin:'https://test'},body});
 assert.equal((await api(request(new Uint8Array(4),false),env)).status,401);
 assert.equal((await api(request(new Uint8Array(3)),env)).status,400);
 assert.equal((await api(request(new Uint8Array(1920002)),env)).status,413);
 const r=await api(request(new Uint8Array(64000)),env);assert.equal(r.status,200);assert.equal((await r.json()).text,'天空为什么是蓝色？');assert.equal(sent.length,3);assert.equal(sent.at(-1)[1],0x22);assert.equal(closed,true);
});
