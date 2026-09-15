import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../server/app.mjs';

const env={ZHIHU_ACCESS_SECRET:'test-only',FETCH:()=>{throw Error('unexpected upstream call')}};
const request=(path,owner='rate-test')=>new Request('https://test.example'+path,{method:'POST',headers:{'oai-authenticated-user-id':owner},body:'{}'});
test('busy search cannot consume answer or voice rate budgets',async()=>{
 for(let i=0;i<12;i++)assert.equal((await api(request('/api/search'),env)).status,400);
 const limited=await api(request('/api/search'),env);
 assert.equal(limited.status,429);
 assert.match((await limited.json()).error,/\d+ 秒后重试/);
 for(const path of ['/api/answer','/api/voice/episode']){
  const response=await api(request(path),env);
  assert.equal(response.status,400);
  assert.equal((await response.json()).code,'INVALID_CONTEXT');
 }
});
test('local testing allows sixty calls per route while retaining a limit',async()=>{
 const local={...env,LOCAL_DEV:true};
 for(let i=0;i<60;i++)assert.equal((await api(request('/api/search'),local)).status,400);
 assert.equal((await api(request('/api/search'),local)).status,429);
 assert.equal((await api(request('/api/answer'),local)).status,400);
});
