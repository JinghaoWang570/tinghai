import test from 'node:test';
import assert from 'node:assert/strict';
import {api,unseal} from '../server/app.mjs';
const item={Url:'https://www.zhihu.com/question/1/answer/2',Title:'测试收藏',Summary:'只有摘要',Author:{Name:'作者'}};
const call=(body,env)=>api(new Request('https://test.example/api/collection-prepare',{method:'POST',body:JSON.stringify(body)}),env);
test('collection conversion requires OAuth and rejects content outside the returned folder',async()=>{
 const env={ZHIHU_ACCESS_SECRET:'secret',IDENTITY_OWNER:'visitor:test',PUBLIC_DEPLOYMENT:true,FETCH:async()=>Response.json({Code:0,Data:{Items:[item]}})};
 assert.equal((await call({id:'1',urls:[item.Url]},env)).status,401);
 env.OAUTH_STORE={};env.OAUTH_SESSION={id:'test',accessToken:'token',expiresAt:Date.now()+60000};
 assert.equal((await call({id:'1',urls:['https://example.com/forged']},env)).status,409);
 const r=await call({id:'1',urls:[item.Url]},env);assert.equal(r.status,200);
 const result=await r.json(),ctx=await unseal(result.context,'secret','visitor:test');
 assert.equal(ctx.references[0].text,'只有摘要');assert.equal(ctx.references[0].author,'作者');assert.equal(ctx.references[0].kind,'摘要');assert.ok(ctx.answer);
});

