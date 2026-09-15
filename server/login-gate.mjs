import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {oauthSession} from './oauth.mjs';

const pages=new Set(['/','/index.html','/desktop-frame.html','/shared.html']);
const openRoutes=new Set(['/auth/login','/auth/callback','/auth/logout','/api/oauth/status','/api/oauth/profile']);
export function loginGate(req,env){
  if(openRoutes.has(new URL(req.url).pathname)||oauthSession(req,env)?.accessToken)return null;
  const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
  if(pages.has(new URL(req.url).pathname))return new Response(null,{status:302,headers:{...headers,Location:'/auth/login','Set-Cookie':'tinghai_return='+encodeURIComponent(new URL(req.url).pathname+new URL(req.url).search)+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600'}});
  return Response.json({error:'请先登录知乎账号',code:'OAUTH_REQUIRED'},{status:401,headers});
}

export async function protectedPage(req,root=path.resolve('content/protected')){
  let name=new URL(req.url).pathname;
  if(!pages.has(name)&&!/^\/(audio|data)\//.test(name))return null;
  if(!['GET','HEAD'].includes(req.method))return new Response(null,{status:405});
  try{name=decodeURIComponent(name)}catch{return new Response(null,{status:400})}
  if(name==='/')name='/index.html';
  const file=path.resolve(root,'.'+name);
  if(!file.startsWith(root+path.sep))return new Response(null,{status:404});
  let bytes;try{bytes=await readFile(file)}catch{return new Response(null,{status:404})}
  const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','Content-Type':({'.html':'text/html; charset=utf-8','.json':'application/json','.mp3':'audio/mpeg','.wav':'audio/wav'})[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes'};
  let status=200;
  const range=req.headers.get('range');
  if(range){
    const m=/^bytes=(\d*)-(\d*)$/.exec(range),size=bytes.length;
    const start=m?(m[1]?Number(m[1]):Math.max(0,size-Number(m[2]))):NaN;
    const end=m?(m[1]?(m[2]?Math.min(Number(m[2]),size-1):size-1):size-1):NaN;
    if(!m||(!m[1]&&!m[2])||start>end||start>=size||!Number.isSafeInteger(start))return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${size}`}});
    bytes=bytes.subarray(start,end+1);status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length']=String(bytes.length);
  return new Response(req.method==='HEAD'?null:bytes,{status,headers});
}
