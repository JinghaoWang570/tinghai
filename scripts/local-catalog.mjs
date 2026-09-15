import fs from 'node:fs/promises';
import {seal} from '../server/app.mjs';
const cacheRoot=new URL('../.local-cache/catalog/',import.meta.url);
const bundledRoot=new URL('../content/catalog/',import.meta.url);
export async function localCatalog(req,res){
 const path=new URL(req.url,'http://localhost').pathname;
 if(!path.startsWith('/__local/catalog/'))return false;
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
 if(!['127.0.0.1:4173','localhost:4173'].includes(req.headers.host)||(req.headers.origin&&req.headers.origin!=='http://'+req.headers.host)){send(403,{error:'仅允许本机同源访问'});return true}
 const id=path.split('/').pop();
 if(req.method!=='GET'||!/^[-a-z0-9]{1,48}$/.test(id)){send(400,{error:'节目标识无效'});return true}
 try{let raw;try{raw=await fs.readFile(new URL(id+'.json',cacheRoot),'utf8')}catch(e){if(e.code!=='ENOENT')throw e;raw=await fs.readFile(new URL(id+'.json',bundledRoot),'utf8')}const saved=JSON.parse(raw);const context=await seal(saved.ctx,process.env.ZHIHU_ACCESS_SECRET,'local-preview');send(200,{episode:{...saved.episode,context,curatedId:id}})}catch(e){send(e.code==='ENOENT'?404:500,{error:e.code==='ENOENT'?'这期节目还在准备中':'节目暂时无法加载'})}return true;
}
