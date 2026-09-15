// Prepare real, sourced podcasts once; reruns reuse completed episodes.
import fs from 'node:fs/promises';
import {seal,unseal} from '../server/app.mjs';
try{process.loadEnvFile('.env.local')}catch{}
const manifestPath='public/data/discovery.json',root='.local-cache/catalog';
const catalog=JSON.parse(await fs.readFile(manifestPath,'utf8'));
await fs.mkdir(root,{recursive:true});
const base='http://127.0.0.1:4173';
async function post(path,body){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(240000)});if(!r.ok)throw Error((await r.json()).error);return r}
const json=async(p,b)=>(await post(p,b)).json();
const voices=['zh_female_vv_uranus_bigtts','zh_male_liufei_uranus_bigtts'];
let writeQueue=Promise.resolve();
function saveManifest(){writeQueue=writeQueue.then(()=>fs.writeFile(manifestPath,JSON.stringify(catalog,null,2)));return writeQueue}
async function seed(item){
 try{await fs.access(root+'/'+item.id+'.json');item.ready=true;await saveManifest();console.log('CACHED '+item.id);return}catch{}
 try{
 let draft;try{draft=JSON.parse(await fs.readFile(root+'/'+item.id+'.draft.json','utf8'))}catch{}
 let script,answer;
 if(draft){script={...draft.script,context:await seal(draft.ctx,process.env.ZHIHU_ACCESS_SECRET,'local-preview')};answer={citedIds:draft.citedIds};console.log('REUSE SCRIPT '+item.id)}else{
 console.log('SEARCH '+item.id);
 const search=await json('/api/search',{query:item.query,channels:['zhihu','web'],scopes:['public'],baseIds:[]});
 if(!search.references?.length)throw Error('没有检索到可用来源');
 answer=await json('/api/answer',{context:search.context,model:'zhida-fast-1p5'});
 script=await json('/api/script',{context:answer.context,style:'duo',depth:'short'});
 if(script.style!=='duo')throw Error('未获得双人讲稿');
 const draftCtx=await unseal(script.context,process.env.ZHIHU_ACCESS_SECRET,'local-preview');await fs.writeFile(root+'/'+item.id+'.draft.json',JSON.stringify({script:{...script,context:undefined},ctx:draftCtx,citedIds:answer.citedIds}));
 }
 console.log('AUDIO '+item.id);
 const r=await post('/api/voice/episode',{context:script.context,duoVoices:voices});
 const decoder=new TextDecoder();let buffer='',complete=false,segments=[],audio=[],chunks=new Map();
 for await(const bytes of r.body){buffer+=decoder.decode(bytes,{stream:true});let n;while((n=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,n).trim();buffer=buffer.slice(n+1);if(!line.startsWith('data:'))continue;const e=JSON.parse(line.slice(5));if(e.type==='error')throw Error(e.error);if(e.type==='manifest')segments=e.segments;if(e.type==='round')chunks.set(e.index,[]);if(e.type==='audio'){const parts=chunks.get(e.index)||[];parts.push(Buffer.from(e.data,'base64'));chunks.set(e.index,parts)}if(e.type==='round-end'){const data=Buffer.concat(chunks.get(e.index)||[]);if(!data.length)throw Error('音频片段为空');audio[e.index]={data:data.toString('base64'),duration:e.duration};chunks.delete(e.index)}if(e.type==='complete')complete=true;}}
 if(!complete||!segments.length||audio.length!==segments.length||Array.from({length:segments.length},(_,i)=>audio[i]).some(x=>!x))throw Error('音频不完整');
 const ctx=await unseal(script.context,process.env.ZHIHU_ACCESS_SECRET,'local-preview');
 const episode={...script,title:item.title,segments,audio,duoVoices:voices,engine:'podcast',audioStatus:'ready',citedIds:answer.citedIds,curatedId:item.id};delete episode.context;
 await fs.writeFile(root+'/'+item.id+'.json',JSON.stringify({ctx,episode}));
 item.ready=true;item.sourceCount=script.references.length;item.style='双人播客';item.createdAt=new Date().toISOString();delete item.error;await saveManifest();console.log('READY '+item.id+' '+audio.length+' segments');
 }catch(e){item.ready=false;item.error='节目准备中';await saveManifest();console.log('FAILED '+item.id+' '+e.message)}
}
const items=catalog.categories.flatMap(c=>c.items);let next=0;
await Promise.all(Array.from({length:2},async()=>{while(next<items.length)await seed(items[next++])}));
console.log('FINISHED '+items.filter(x=>x.ready).length+'/'+items.length);
