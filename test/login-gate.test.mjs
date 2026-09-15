import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {loginGate,protectedPage} from '../server/login-gate.mjs';
const request=p=>new Request('https://tinghai.test'+p);
const env={OAUTH_STORE:{},OAUTH_SESSION:null};
test('anonymous visitors cannot access pages, previews, catalog or generation even with forged login hints',()=>{
 for(const p of ['/','/desktop-frame.html','/shared.html','/index.html?zhihu_login=success']){const r=loginGate(request(p),env);assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/auth/login')}
 for(const p of ['/api/session','/api/search','/api/voice/episode','/api/voice/asr','/__local/catalog/cat-box','/audio/voices/first-female-young-v2.mp3','/data/discovery.json'])assert.equal(loginGate(request(p),env).status,401,p);
 const forged=new Request('https://tinghai.test/api/search',{headers:{cookie:'tinghai_zhihu_session=fake','oai-authenticated-user-id':'visitor'}});assert.equal(loginGate(forged,env).status,401);
});
test('OAuth entry points stay reachable; only unexpired token sessions unlock app',()=>{
 for(const p of ['/auth/login','/auth/callback','/auth/logout','/api/oauth/status','/api/oauth/profile'])assert.equal(loginGate(request(p),env),null);
 for(const session of [null,{expiresAt:Date.now()+60000},{accessToken:'test',expiresAt:Date.now()-1}])assert.equal(loginGate(request('/api/search'),{...env,OAUTH_SESSION:session}).status,401);
 assert.equal(loginGate(request('/api/search'),{...env,OAUTH_SESSION:{accessToken:'test',expiresAt:Date.now()+60000}}),null);
});
test('protected media supports seeking, private caching and traversal rejection',async()=>{
 const serve=req=>protectedPage(req,path.resolve('public'));
 const r=await serve(new Request('https://tinghai.test/audio/voices/first-female-young-v2.mp3',{headers:{range:'bytes=0-19'}}));assert.equal(r.status,206);assert.equal((await r.arrayBuffer()).byteLength,20);assert.equal(r.headers.get('cache-control'),'private, no-store');
 const page=await serve(request('/'));assert.equal(page.status,200);assert.match(await page.text(),/app.js/);
 assert.equal((await serve(request('/audio/%2e%2e%2f%2e%2e%2fpackage.json'))).status,404);
});
