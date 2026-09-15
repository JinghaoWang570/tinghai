import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../server/app.mjs';
import {encryptSession,decryptSession} from '../server/cloud-oauth.mjs';

const base={LOCAL_DEV:true,ZHIHU_ACCESS_SECRET:'platform-secret',ZHIHU_OAUTH_APP_ID:'12345',ZHIHU_OAUTH_APP_KEY:'oauth-app-key',ZHIHU_OAUTH_REDIRECT_URI:'https://listen.example/auth/callback'};
test('profile uses OAuth bearer and normalizes real root-level fields without private data',async()=>{
 const env={...base,OAUTH_STORE:{set:async()=>{}},OAUTH_SESSION:{id:crypto.randomUUID(),accessToken:'user-token',expiresAt:Date.now()+60000},FETCH:async(_url,options)=>{assert.equal(options.headers.Authorization,'Bearer user-token');return Response.json({fullname:'真实昵称',avatar_path:'https://pic1.zhimg.com/user.jpg',phone:'private',email:'private'})}};
 const response=await api(new Request('https://listen.example/api/oauth/profile'),env);
 const data=await response.json();assert.equal(data.profile.name,'真实昵称');assert.equal(data.profile.avatarUrl,'https://pic1.zhimg.com/user.jpg');assert.ok(!JSON.stringify(data).includes('private'));
});

test('OAuth retries only a connection timeout before token exchange',async()=>{
 let calls=0;
 const env={...base,FETCH:async()=>{if(++calls===1)throw new TypeError('fetch failed',{cause:{code:'UND_ERR_CONNECT_TIMEOUT'}});return Response.json({access_token:'test-token'})}};
 const response=await api(new Request('https://listen.example/auth/callback?code=test-code'),env);
 assert.equal(response.status,302);assert.equal(calls,2);
});

test('optional profile and cache failures cannot invalidate authenticated status',async()=>{
 const env={...base,OAUTH_STORE:{set:async()=>{throw Error('storage unavailable')}},OAUTH_SESSION:{id:crypto.randomUUID(),accessToken:'test-token',expiresAt:Date.now()+60000},FETCH:async()=>{throw Error('profile unavailable')}};
 const response=await api(new Request('https://listen.example/api/oauth/profile'),env);
 assert.equal(response.status,200);assert.equal((await response.json()).authenticated,true);
});

test('OAuth connection failure is classified and browser recovery never exposes credentials',async()=>{
 let calls=0;
 const env={...base,FETCH:async(_url,options)=>{calls++;assert.ok(options.signal);throw new TypeError('fetch failed',{cause:{code:'ECONNRESET'}})}};
 const req=()=>new Request('https://listen.example/auth/callback?code=private-code',{headers:{accept:'text/html'}});
 const r=await api(req(),env),html=await r.text();
 assert.equal(r.status,502);assert.match(r.headers.get('content-type'),/text\/html/);
 assert.match(html,/重新登录知乎/);assert.match(html,/OAUTH_TOKEN_NETWORK_ERROR/);
 assert.ok(!html.includes('private-code'));assert.ok(!html.includes(base.ZHIHU_OAUTH_APP_KEY));assert.equal(calls,1);
 assert.equal(r.headers.get('referrer-policy'),'no-referrer');
});

test('OAuth login builds the documented authorization request',async()=>{const response=await api(new Request('https://listen.example/auth/login'),base);assert.equal(response.status,302);const target=new URL(response.headers.get('location'));assert.equal(target.origin,'https://openapi.zhihu.com');assert.equal(target.pathname,'/authorize');assert.equal(target.searchParams.get('app_id'),'12345');assert.equal(target.searchParams.get('response_type'),'code');assert.equal(target.searchParams.get('redirect_uri'),base.ZHIHU_OAUTH_REDIRECT_URI);assert.ok(target.searchParams.get('state'))});

test('OAuth callback keeps token server-side and exposes the documented public profile',async()=>{let exchanged=false,oauthHeader='';const env={...base,FETCH:async(url,options={})=>{if(String(url)==='https://openapi.zhihu.com/access_token'){exchanged=true;assert.equal(options.body.get('grant_type'),'authorization_code');assert.equal(options.body.get('code'),'callback-code');return Response.json({access_token:'private-user-token',expires_in:3600})}oauthHeader=options.headers['X-OAuth-Token'];if(String(url)==='https://openapi.zhihu.com/user')return Response.json({code:20000,data:{name:'知乎用户',avatar_url:'https://pic1.zhimg.com/avatar.jpg',headline:'认真听世界'}});return Response.json({Code:0,Data:{Items:[]}})}};const callback=await api(new Request('https://listen.example/auth/callback?authorization_code=callback-code'),env);assert.equal(callback.status,302);assert.equal(exchanged,true);assert.ok(!callback.headers.get('set-cookie').includes('private-user-token'));const cookie=callback.headers.get('set-cookie').split(';')[0];const status=await (await api(new Request('https://listen.example/api/oauth/profile',{headers:{cookie}}),env)).json();assert.equal(status.authenticated,true);assert.deepEqual(status.profile,{name:'知乎用户',avatarUrl:'https://pic1.zhimg.com/avatar.jpg',headline:'认真听世界',url:null});const personal=await api(new Request('https://listen.example/api/personal?kind=contents',{headers:{cookie}}),env);assert.equal(personal.status,200);assert.equal(oauthHeader,'private-user-token')});

test('local callback is rejected until a public HTTPS deployment is configured',async()=>{const response=await api(new Request('http://127.0.0.1:4173/auth/login'),{...base,ZHIHU_OAUTH_REDIRECT_URI:'http://127.0.0.1:4173/auth/callback'});assert.equal(response.status,409);const data=await response.json();assert.equal(data.code,'OAUTH_DEPLOYMENT_REQUIRED')});

test('cloud OAuth encryption detects tampering and wrong keys',()=>{
 const data={accessToken:'private-token',expiresAt:Date.now()+1000};const text=encryptSession(data,'key');
 assert.equal(text.includes('private-token'),false);assert.deepEqual(decryptSession(text,'key'),data);
 assert.throws(()=>decryptSession(text,'other'));
 const bytes=Buffer.from(text,'base64url');bytes[30]^=1;assert.throws(()=>decryptSession(bytes.toString('base64url'),'key'));
});
test('cloud OAuth persists across request instances and logout invalidates stored session',async()=>{
 const saved=new Map();let flow,ended=false;
 const store={async set(id,s){saved.set(id,s)},async delete(id){saved.delete(id)}};
 const env={...base,PUBLIC_DEPLOYMENT:true,IDENTITY_OWNER:'visitor:stable',OAUTH_STORE:store,OAUTH_BEGIN:s=>flow={state:s},OAUTH_END:()=>ended=true,FETCH:async()=>Response.json({access_token:'private-token',expires_in:3600})};
 await api(new Request('https://listen.example/auth/login'),env);
 let r=await api(new Request('https://listen.example/auth/callback?code=abc'),env);assert.equal(r.status,400);
 r=await api(new Request('https://listen.example/auth/callback?code=abc&state=wrong'),{...env,OAUTH_FLOW:flow});assert.equal(r.status,400);
 r=await api(new Request('https://listen.example/auth/callback?code=abc'),{...env,OAUTH_FLOW:flow});assert.equal(r.status,302);assert.equal(ended,true);
 const cookie=r.headers.get('set-cookie').split(';')[0],session=[...saved.values()][0];assert.ok(session);
 const fresh={...env,OAUTH_SESSION:session};
 const status=await (await api(new Request('https://listen.example/api/oauth/profile',{headers:{cookie}}),fresh)).json();assert.equal(status.authenticated,true);
 await api(new Request('https://listen.example/auth/logout',{headers:{cookie}}),fresh);assert.equal(saved.size,0);
 const expired=await (await api(new Request('https://listen.example/api/oauth/profile'),{...env,OAUTH_SESSION:{...session,expiresAt:1}})).json();assert.equal(expired.authenticated,false);
});
