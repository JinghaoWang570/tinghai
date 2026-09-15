import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import {localLibrary} from '../scripts/local-library.mjs';
import {seal,unseal} from '../server/app.mjs';
process.env.ZHIHU_ACCESS_SECRET='library-test-secret';
async function call(method,id,body,headers={}){const req=Readable.from(body?[Buffer.from(JSON.stringify(body))]:[]);Object.assign(req,{method,url:'/__local/episodes/'+id,headers:{host:'127.0.0.1:4173',...headers}});let status,result;const res={writeHead(s){status=s},end(text){result=JSON.parse(text)}};await localLibrary(req,res);return {status,data:result}}
test('multiple local episodes remain retrievable with newly signed contexts',async()=>{
 const ids=[randomUUID(),randomUUID()];
 try{for(const [i,id] of ids.entries()){const ctx={query:'episode '+i,script:[{text:'内容'}],references:[]};const context=await seal(ctx,process.env.ZHIHU_ACCESS_SECRET,'local-preview');const r=await call('POST',id,{context,title:ctx.query,segments:ctx.script,audioStatus:'ready',audio:[{data:'YXVkaW8='}]});assert.equal(r.status,200)}
 for(const [i,id] of ids.entries()){const r=await call('GET',id);assert.equal(r.status,200);assert.equal(r.data.episode.title,'episode '+i);const context=await unseal(r.data.episode.context,process.env.ZHIHU_ACCESS_SECRET,'local-preview');assert.equal(context.query,'episode '+i);assert.equal(r.data.episode.libraryId,id)}
 }finally{for(const id of ids)await fs.rm(new URL('../.local-cache/episodes/'+id+'.json',import.meta.url),{force:true})}
});
test('local archive rejects cross-origin, unsafe paths, and unverified/incomplete audio',async()=>{
 assert.equal((await call('GET','..%2Flatest')).status,400);
 assert.equal((await call('GET',randomUUID(),null,{origin:'https://other.example'})).status,403);
 assert.equal((await call('POST',randomUUID(),{context:'invalid'})).status,400);
 const context=await seal({query:'x'},process.env.ZHIHU_ACCESS_SECRET,'local-preview');
 assert.equal((await call('POST',randomUUID(),{context,segments:[{}],audio:[]})).status,400);
});
