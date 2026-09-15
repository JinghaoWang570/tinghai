import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {get,put,del} from './blob-store.mjs';
import {signed,verified} from './cloud-identity.mjs';

export function encryptSession(data,secret){
  const iv=randomBytes(12),key=createHash('sha256').update('tinghai-oauth:'+secret).digest();
  const cipher=createCipheriv('aes-256-gcm',key,iv);
  const payload=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),payload]).toString('base64url');
}
export function decryptSession(text,secret){
  const data=Buffer.from(text,'base64url'),key=createHash('sha256').update('tinghai-oauth:'+secret).digest();
  const cipher=createDecipheriv('aes-256-gcm',key,data.subarray(0,12));
  cipher.setAuthTag(data.subarray(12,28));
  return JSON.parse(Buffer.concat([cipher.update(data.subarray(28)),cipher.final()]).toString());
}
const cookie=(req,name)=>(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';
const validId=id=>/^[a-f0-9-]{36}$/.test(id);
export async function cloudOAuthEnv(req,env,owner){
  const extraCookies=[];
  if(!env.BLOB_READ_WRITE_TOKEN&&!env.TINGHAI_DATA_DIR)return {...env,IDENTITY_OWNER:owner,extraCookies};
  const secret=env.ZHIHU_OAUTH_APP_KEY||env.ZHIHU_ACCESS_SECRET;
  const store={
    async set(id,data){await put('oauth/'+id+'.json',encryptSession(data,secret),{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/octet-stream'});},
    async delete(id){if(validId(id))await del('oauth/'+id+'.json');}
  };
  const id=cookie(req,'tinghai_zhihu_session');let session=null;
  if(validId(id)){
    const blob=await get('oauth/'+id+'.json',{access:'private',useCache:false});
    if(blob){try{const data=decryptSession(await new Response(blob.stream).text(),secret);if(data.id===id&&data.expiresAt>Date.now())session=data;}catch{}}
  }
  return {...env,IDENTITY_OWNER:owner,OAUTH_SESSION:session,OAUTH_STORE:store,extraCookies,
    OAUTH_FLOW:verified(cookie(req,'tinghai_oauth_flow'),secret),
    OAUTH_BEGIN(state){extraCookies.push('tinghai_oauth_flow='+signed({state,expires:Date.now()+600000},secret)+'; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600');},
    OAUTH_END(){extraCookies.push('tinghai_oauth_flow=; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0');}
  };
}
