import fs from 'node:fs/promises';
const root=new URL('../.local-cache/shares/',import.meta.url);
export async function localShare(req,res){
 const path=new URL(req.url,'http://localhost').pathname;if(!path.startsWith('/__local/share'))return false;
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
 if(!['localhost:4173','127.0.0.1:4173'].includes(req.headers.host)||(req.headers.origin&&req.headers.origin!=='http://'+req.headers.host)){send(403,{error:'仅允许本机同源访问'});return true}
 try{if(req.method==='POST'&&path==='/__local/share'){
 let size=0,parts=[];for await(const part of req){size+=part.length;if(size>32e6)throw Error('节目超过32MB分享上限');parts.push(part)}const d=JSON.parse(Buffer.concat(parts));
 if(typeof d.title!=='string'||!Array.isArray(d.audio)||!d.audio.length||d.audio.length>200||d.audio.some(a=>typeof a!=='string'||!a.length||!/^[A-Za-z0-9+/=]+$/.test(a)))throw Error('请等待节目音频完整生成');
 const id=crypto.randomUUID();await fs.mkdir(root,{recursive:true});await fs.writeFile(new URL(id+'.json',root),JSON.stringify({title:d.title.slice(0,500),audio:d.audio}));send(200,{url:'/shared.html?id='+id});
 }else if(req.method==='GET'&&/^\/__local\/share\/[0-9a-f-]{36}$/.test(path)){const id=path.split('/').pop();send(200,JSON.parse(await fs.readFile(new URL(id+'.json',root),'utf8')))}else send(404,{error:'分享不存在'});
 }catch(e){send(400,{error:e.code==='ENOENT'?'分享不存在':e.message})}return true;
}
