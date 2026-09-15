import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {seal,unseal} from '../server/app.mjs';

const root=new URL('../.local-cache/episodes/',import.meta.url);
export async function localLibrary(req,res){
 const path=new URL(req.url,'http://localhost').pathname;
 if(!path.startsWith('/__local/episodes/'))return false;
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
 if(!['127.0.0.1:4173','localhost:4173'].includes(req.headers.host)||(req.headers.origin&&req.headers.origin!=='http://'+req.headers.host)){send(403,{error:'仅允许本机同源访问'});return true}
 const id=path.slice('/__local/episodes/'.length);
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)){send(400,{error:'节目标识无效'});return true}
 const file=new URL(id+'.json',root);
 try{
  if(req.method==='GET'){
   const cached=JSON.parse(await fs.readFile(file,'utf8'));
   const context=await seal(cached.ctx,process.env.ZHIHU_ACCESS_SECRET,'local-preview');
   send(200,{episode:{...cached.episode,context}});
  }else if(req.method==='POST'){
   let bytes=0;const chunks=[];
   for await(const chunk of req){bytes+=chunk.length;if(bytes>32e6)throw Error('节目超过本地缓存的 32 MB 上限');chunks.push(chunk)}
   const ep=JSON.parse(Buffer.concat(chunks));
   const ctx=await unseal(ep.context,process.env.ZHIHU_ACCESS_SECRET,'local-preview');
   if(!ep.audio?.length||ep.audio.length!==ep.segments?.length||ep.audio.some(a=>!a.data||!/^[A-Za-z0-9+/=]+$/.test(a.data)))throw Error('节目音频尚未完整生成');
   // Store the verified context, never a temporary browser URL or follow-up session.
   const {context,followContext,...episode}=ep;
   episode.libraryId=id;
   const temp=new URL(id+'-'+randomUUID()+'.tmp',root);
   await fs.mkdir(root,{recursive:true});
   try{await fs.writeFile(temp,JSON.stringify({ctx,episode,savedAt:new Date().toISOString()}));await fs.rename(temp,file)}finally{await fs.rm(temp,{force:true})}
   send(200,{saved:true,id});
  }else send(405,{error:'不支持此操作'});
 }catch(e){send(e.code==='ENOENT'?404:400,{error:e.code==='ENOENT'?'本机尚未保存这期完整音频':e.message})}
 return true;
}
