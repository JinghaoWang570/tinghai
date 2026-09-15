import {APIError} from './zhihu.mjs';

const sessions=new Map(),pending=new Map(),cookieName='tinghai_zhihu_session';
const cookieValue=(req,name)=>{const row=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));return row?decodeURIComponent(row.slice(name.length+1)):''};
const clean=()=>{const now=Date.now();for(const [k,v] of sessions)if(v.expiresAt<=now)sessions.delete(k);for(const [k,v] of pending)if(v.expiresAt<=now)pending.delete(k)};
const config=(req,env)=>({appId:String(env.ZHIHU_OAUTH_APP_ID||'').trim(),appKey:String(env.ZHIHU_OAUTH_APP_KEY||''),redirectUri:String(env.ZHIHU_OAUTH_REDIRECT_URI||new URL('/auth/callback',req.url)).trim()});
const publicHttps=value=>{try{return new URL(value).protocol==='https:'}catch{return false}};
async function exchangeFetch(env,url,options){
 try{return await (env.FETCH||fetch)(url,options)}catch(error){
  // A connection timeout occurs before the one-use authorization code is sent.
  // Do not replay requests after response/read failures or ambiguous resets.
  if(error?.cause?.code!=='UND_ERR_CONNECT_TIMEOUT'||options.signal.aborted)throw error;
  return (env.FETCH||fetch)(url,options);
 }
}
const sessionId=req=>cookieValue(req,cookieName);
export function oauthSession(req,env){if(env?.OAUTH_STORE)return env.OAUTH_SESSION?.expiresAt>Date.now()?env.OAUTH_SESSION:null;clean();const id=sessionId(req);return id?sessions.get(id)||null:null}
export function oauthToken(req,env){return oauthSession(req,env)?.accessToken||''}
export function oauthOwner(req,env){const s=oauthSession(req,env);return s?'zhihu:'+s.id:''}
const profileText=(value,max)=>typeof value==='string'&&value.trim()?value.trim().slice(0,max):null;
const profileUrl=value=>{try{const url=new URL(value);return url.protocol==='https:'&&url.href.length<=2048?url.href:null}catch{return null}};
function profileFrom(payload){
 const source=payload?.data||payload?.Data||payload?.user||(payload?.fullname?payload:null);
 if(!source||typeof source!=='object'||Array.isArray(source))return null;
 const profile={name:profileText(source.name||source.Fullname||source.fullname,80),avatarUrl:profileUrl(source.avatar_url||source.AvatarUrl||source.avatar_path),headline:profileText(source.headline||source.Headline,240),url:profileUrl(source.url||source.Url)};
 return profile.name||profile.avatarUrl||profile.headline||profile.url?profile:null;
}
async function storeSession(session,env){if(env.OAUTH_STORE)await env.OAUTH_STORE.set(session.id,session);else sessions.set(session.id,session)}
async function ensureProfile(req,env){
 const session=oauthSession(req,env),now=Date.now();
 if(!session?.accessToken||!env.ZHIHU_ACCESS_SECRET||session.profile||now-(session.profileCheckedAt||0)<60000)return;
 session.profileCheckedAt=now;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try{
  const response=await exchangeFetch(env,'https://openapi.zhihu.com/user',{headers:{Authorization:`Bearer ${session.accessToken}`,'X-OAuth-Token':session.accessToken,'X-Request-Timestamp':String(Math.floor(now/1000)),'Content-Type':'application/json'},signal:controller.signal});
  const payload=await response.json();
  if(response.ok)session.profile=profileFrom(payload);
 }catch(error){console.warn('oauth_profile_fetch_failed',JSON.stringify({cause:String(error?.cause?.code||error?.code||error?.name||'UNKNOWN').replace(/[^A-Za-z0-9_]/g,'').slice(0,60)}))}
 finally{clearTimeout(timer);try{await storeSession(session,env)}catch{console.warn('oauth_profile_cache_write_failed')}}
}
export function oauthStatus(req,env){const c=config(req,env),s=oauthSession(req,env);return {enabled:true,configured:!!(c.appId&&c.appKey&&publicHttps(c.redirectUri)),authenticated:!!s,redirectUri:c.redirectUri,expiresAt:s?.expiresAt||null,profile:s?.profile||null,security:'hackathon-integration',notice:'当前知乎 OAuth 未提供可靠的 state 回传、PKCE、刷新和撤销协议，仅适合黑客松临时联调。'}}
const redirect=(url,headers={})=>new Response(null,{status:302,headers:{Location:url,'Cache-Control':'no-store','Referrer-Policy':'no-referrer',...headers}});
const cookie=(id,maxAge)=>`${cookieName}=${encodeURIComponent(id)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
async function oauthRouteInternal(req,env){const url=new URL(req.url),p=url.pathname,c=config(req,env);
 if(p==='/api/oauth/status'||p==='/api/oauth/profile'){if(p.endsWith('/profile'))await ensureProfile(req,env);return Response.json(oauthStatus(req,env),{headers:{'Cache-Control':'no-store'}});}
 if(p==='/auth/logout'){const id=sessionId(req);if(id){if(env.OAUTH_STORE)await env.OAUTH_STORE.delete(id);else sessions.delete(id);}return redirect('/',{'Set-Cookie':cookie('',0)});}
 if(p==='/auth/login'){if(!c.appId)throw new APIError('尚未配置知乎 OAuth App ID',503,'OAUTH_NOT_CONFIGURED');if(!c.appKey)throw new APIError('尚未配置知乎 OAuth App Key',503,'OAUTH_NOT_CONFIGURED');if(!publicHttps(c.redirectUri))throw new APIError('知乎登录需要部署后的公网 HTTPS 回调地址；本地页面只能预览登录入口',409,'OAUTH_DEPLOYMENT_REQUIRED');const state=crypto.randomUUID();if(env.OAUTH_STORE)env.OAUTH_BEGIN(state);else pending.set(state,{expiresAt:Date.now()+10*60*1000});return redirect('https://openapi.zhihu.com/authorize?'+new URLSearchParams({redirect_uri:c.redirectUri,app_id:c.appId,response_type:'code',state}));}
 if(p==='/auth/callback'){const code=url.searchParams.get('authorization_code')||url.searchParams.get('code')||'',state=url.searchParams.get('state')||'';if(!code||code.length>2048)throw new APIError('知乎授权回调缺少有效授权码',400,'OAUTH_CODE_MISSING');if(env.OAUTH_STORE?(!env.OAUTH_FLOW||(state&&env.OAUTH_FLOW.state!==state)):(state&&!pending.has(state)))throw new APIError('知乎登录请求已过期，请重新发起授权',400,'OAUTH_STATE_INVALID');if(state)pending.delete(state);if(!c.appId||!c.appKey||!publicHttps(c.redirectUri))throw new APIError('知乎 OAuth 部署配置不完整',503,'OAUTH_NOT_CONFIGURED');const body=new URLSearchParams({app_id:c.appId,app_key:c.appKey,grant_type:'authorization_code',redirect_uri:c.redirectUri,code});let response,data;const started=Date.now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),300000);try{response=await exchangeFetch(env,'https://openapi.zhihu.com/access_token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:controller.signal});try{data=await response.json()}catch(e){if(controller.signal.aborted)throw e;throw new APIError('知乎授权服务返回异常',502,'OAUTH_TOKEN_INVALID_RESPONSE')}}catch(e){const cause=String(e.cause?.code||e.code||e.name||'UNKNOWN').replace(/[^A-Za-z0-9_]/g,'').slice(0,60);console.error('oauth_exchange_failed',JSON.stringify({stage:response?'response_body':'connect',elapsedMs:Date.now()-started,cause,timedOut:controller.signal.aborted,region:env.VERCEL_REGION||'unknown'}));if(e instanceof APIError)throw e;throw new APIError(controller.signal.aborted?'知乎授权服务响应超时，请重新登录':'暂时无法连接知乎授权服务，请重新登录',controller.signal.aborted?504:502,controller.signal.aborted?'OAUTH_TOKEN_TIMEOUT':'OAUTH_TOKEN_NETWORK_ERROR')}finally{clearTimeout(timer)}const token=data.access_token||data.Data?.access_token;if(!response.ok||!token)throw new APIError('未能完成知乎账号授权，请重新登录',502,'OAUTH_TOKEN_EXCHANGE_FAILED');const rawTtl=Number(data.expires_in||data.Data?.expires_in||3600),ttl=Number.isFinite(rawTtl)?Math.max(60,Math.min(rawTtl,86400)):3600,id=crypto.randomUUID(),session={id,accessToken:token,expiresAt:Date.now()+ttl*1000,stateReturned:!!state};if(env.OAUTH_STORE){await env.OAUTH_STORE.set(id,session);env.OAUTH_END();}else sessions.set(id,session);return redirect('/?zhihu_login=success',{'Set-Cookie':cookie(id,ttl)});}
 return null;
}

export async function oauthRoute(req,env){
 try{return await oauthRouteInternal(req,env)}catch(e){
  if(!new URL(req.url).pathname.startsWith('/auth/')||!req.headers.get('accept')?.includes('text/html'))throw e;
  const isNetwork=['OAUTH_TOKEN_TIMEOUT','OAUTH_TOKEN_NETWORK_ERROR'].includes(e.code);
  const title=isNetwork?'登录连接暂时中断':'这次登录未能完成';
  const description=isNetwork?'知乎授权页面已返回，但听海暂时没能完成登录连接。请重新发起登录，无需修改账号信息。':'授权可能已过期或未能完成，请重新发起登录。';
  const code=String(e.code||'OAUTH_FAILED').replace(/[^A-Z0-9_]/g,'');
  return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>重新连接知乎 · 听海</title><style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#f4f8f9;color:#153b50;font-family:system-ui,sans-serif}main{box-sizing:border-box;width:min(92%,440px);padding:36px 28px;background:white;border-radius:28px;text-align:center;box-shadow:0 16px 60px #153b500d}img{width:76px;border-radius:20px}h1{font-size:24px}p{line-height:1.8;color:#718995}a{display:block;margin-top:14px;padding:14px;border-radius:14px;text-decoration:none;color:#087cf0}.primary{background:#087cf0;color:white}small{display:block;margin-top:24px;color:#8198a4;font-size:11px}</style><main><img src="/assets/tinghai-favicon-rounded.svg" alt="听海"><h1>${title}</h1><p>${description}</p><a class="primary" href="/auth/login">重新登录知乎</a><a href="/">返回听海</a><small>${code}</small></main></html>`,{status:e.status||502,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}});
 }
}
