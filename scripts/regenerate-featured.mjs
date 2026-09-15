// Stage a complete catalog revision before promoting any content to production.
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {api,seal,unseal} from '../server/app.mjs';
import {nodeVoiceConnect} from './voice-node.mjs';
import {createPerformanceStore} from '../server/performance-store.mjs';
process.loadEnvFile('../tinghai-site/.env.local');
const env={...process.env,LOCAL_DEV:true,VOICE_CONNECT:nodeVoiceConnect};
env.PERFORMANCE_STORE=createPerformanceStore(env);
const root=process.env.FEATURED_STAGE||'.local-cache/featured-v2';await fs.mkdir(root,{recursive:true});
const catalog=JSON.parse(await fs.readFile('public/data/discovery.json','utf8'));
const styles={photography:'solo',gps:'solo','noise-cancel':'solo','blue-sky':'solo',coffee:'duo',music:'duo','ai-hallucination':'duo',procrastination:'duo','song-city':'story','silk-road':'story',declutter:'clapper',fridge:'clapper','cat-box':'first','sea-wave':'first',museum:'first'};
const labels={solo:'单人讲解',duo:'双人播客',story:'评书',clapper:'快板',first:'第一人称'};
const roles={'cat-box':['猫','animal','first-female-young-v2','从我钻进纸箱的动作讲安全感、保温和伏击本能。'],'sea-wave':['一滴海水','object','first-male-young-v1','从我随波上下和前后运动讲清波浪传播与海水运动，区分潮汐和洋流。'],museum:['鹳鱼石斧图彩绘陶缸','object','first-male-senior-v1','由我引导听众观察我的材质、画面和用途，再把观察方法迁移到其他文物；不编造主人、制作经过或战役。']};
const duoVoices=['zh_female_sophie_uranus_bigtts','zh_male_liufei_uranus_bigtts'];
const voice='zh_male_liufei_uranus_bigtts';
async function post(route,body){const response=await api(new Request('http://localhost'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(600000)}),env);if(!response.ok){const e=await response.json();throw Error(route+': '+e.error)}return response;}
async function json(route,body){return (await post(route,body)).json()}
const sign=ctx=>seal(ctx,env.ZHIHU_ACCESS_SECRET,'local-preview');
const decode=context=>unseal(context,env.ZHIHU_ACCESS_SECRET,'local-preview');
async function read(file){try{return JSON.parse(await fs.readFile(root+'/'+file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}}
async function write(file,value){await fs.writeFile(root+'/'+file,JSON.stringify(value))}
async function draft(item){
 if(await read(item.id+'.draft.json'))return;
 console.log('DRAFT '+item.id+' '+styles[item.id]);
 const saved=JSON.parse(await fs.readFile('content/catalog/'+item.id+'.json','utf8'));
 let ctx={query:item.query,references:saved.ctx.references,channels:['zhihu','web'],scopes:['public'],baseIds:[]};
 if(item.id==='museum')ctx.references.push({id:'S6',title:'鹳鱼石斧图彩绘陶缸｜中国国家博物馆',url:'https://www.chnmuseum.cn/zp/zpml/kgfjp/202008/t20200824_247232.shtml',author:'中国国家博物馆',channel:'web',channels:['web'],kind:'article',sourceHost:'www.chnmuseum.cn',text:'馆方说明要点：陶缸属于仰韶文化瓮棺葬具，主要用于成人。外表红色，直壁、平底、圆筒形。外壁彩绘左边是白鹳衔鱼，右边是一柄石斧。画家用大块白色表现鹳，用轮廓线和填色表现鱼、石斧。可从造型、材质、纹饰和用途观察文物。图腾战争和首领身世属于解释性推测，不应讲成确定事实。'});
 const answer=await json('/api/material-prepare',{context:await sign(ctx)});ctx=await decode(answer.context);
 if(roles[item.id]){const [name,kind,preset,perspective]=roles[item.id];ctx.narrator={name,kind,perspective,gender:'unknown',genderBasis:'unknown',genderEvidence:'',ageGroup:'unknown',voiceDescription:'自然清晰，沉浸式第一人称'};}
 const script=await json('/api/script',{context:await sign(ctx),style:styles[item.id],depth:'short',...(roles[item.id]?{voicePreset:roles[item.id][2]}:{})});
 if(script.style!==styles[item.id])throw Error('Style mismatch '+item.id);
 ctx=await decode(script.context);delete script.context;
 await write(item.id+'.draft.json',{ctx,script,citedIds:answer.citedIds});console.log('DRAFT_READY '+item.id);
}
async function audio(item){
 if(await read(item.id+'.json')){console.log('CACHED '+item.id);return}
 const d=await read(item.id+'.draft.json');let ctx=d.ctx;
 if(['first','story','clapper'].includes(ctx.style)){const p=await json('/api/voice/profile',{context:await sign(ctx)});ctx=await decode(p.context)}
 let progress=await read(item.id+'.progress.json')||{segments:[],audio:[],engine:null};
 let start=0;while(progress.audio[start])start++;
 if(progress.segments.length&&start===progress.segments.length){await finish();return}
 console.log('AUDIO '+item.id+' from '+start);
 let complete=false,buffer='',chunks=new Map();const decoder=new TextDecoder();
 const response=await post('/api/voice/episode',{context:await sign(ctx),start,voice,duoVoices});
 for await(const bytes of response.body){buffer+=decoder.decode(bytes,{stream:true});let n;while((n=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,n).trim();buffer=buffer.slice(n+1);if(!line.startsWith('data:'))continue;const e=JSON.parse(line.slice(5));if(e.type==='error')throw Error(e.error);if(e.type==='manifest')progress={segments:e.segments,audio:[],engine:e.engine,voiceProfile:e.voiceProfile,duoVoices:e.duoVoices};if(e.type==='audio'){const a=chunks.get(e.index)||[];a.push(Buffer.from(e.data,'base64'));chunks.set(e.index,a)}if(e.type==='round-end'){const data=Buffer.concat(chunks.get(e.index)||[]);if(!data.length)throw Error('Empty audio');progress.audio[e.index]={data:data.toString('base64'),duration:e.duration,seconds:e.seconds,subtitle:e.subtitle};chunks.delete(e.index);await write(item.id+'.progress.json',progress);console.log('SEGMENT '+item.id+' '+(e.index+1)+'/'+progress.segments.length)}if(e.type==='complete')complete=true;}}
 if(!complete)throw Error('Incomplete stream '+item.id);await finish();
 async function finish(){if(!progress.segments.length||progress.audio.length!==progress.segments.length||Array.from(progress.segments,(_,i)=>!progress.audio[i]).some(Boolean))throw Error('Missing segments '+item.id);const expected=ctx.style==='duo'?'podcast':ctx.style==='solo'?'tts':'seed-audio';if(progress.engine!==expected)throw Error('Wrong engine '+item.id);const episode={...d.script,...progress,title:item.title,style:ctx.style,voice,voicePreset:ctx.voicePreset,narrator:ctx.narrator,audioStatus:'ready',citedIds:d.citedIds,curatedId:item.id,revision:'featured-v2'};await write(item.id+'.json',{ctx,episode});console.log('READY '+item.id+' '+expected)}
}
function textCoverage(expected,actual){
 const clean=s=>s.replace(/（[^）]*）|\([^)]*\)|\[S\d+\]/g,'').replace(/[^\p{Script=Han}a-z0-9]/giu,'');
 const a=clean(expected),b=clean(actual);let previous=new Uint16Array(b.length+1);
 for(const ch of a){const row=new Uint16Array(b.length+1);for(let j=1;j<=b.length;j++)row[j]=ch===b[j-1]?previous[j-1]+1:Math.max(previous[j],row[j-1]);previous=row;}
 return previous[b.length]/Math.max(1,a.length);
}
const items=catalog.categories.flatMap(c=>c.items).filter(item=>!process.env.FEATURED_IDS||process.env.FEATURED_IDS.split(',').includes(item.id));
const mode=process.argv[2]||'draft';
if(mode==='promote'){
 const prepared=[];
 for(const item of items){
  const d=await read(item.id+'.json');if(!d)throw Error('Missing '+item.id);
  const ep=d.episode,expected=styles[item.id];
  if(['first','story','clapper'].includes(expected)){delete ep.voice;delete ep.duoVoices;}
  if(ep.style!==expected||d.ctx.style!==expected||ep.curatedId!==item.id||ep.title!==item.title)throw Error('Catalog mismatch '+item.id);
  if(ep.engine!==(expected==='solo'?'tts':expected==='duo'?'podcast':'seed-audio'))throw Error('Wrong audio route '+item.id);
  if(['first','story','clapper'].includes(expected)&&(!ep.voiceProfile||ep.voiceProfile.preset!==d.ctx.voicePreset))throw Error('Voice mismatch '+item.id);
  if(expected==='first'&&(d.ctx.narrator.name!==roles[item.id][0]||d.ctx.voicePreset!==roles[item.id][2]))throw Error('Narrator mismatch '+item.id);
  let seconds=0;
  const compress=Buffer.byteLength(JSON.stringify(d))>3800000;
  for(const [i,row] of ep.audio.entries()){
   let data=Buffer.from(row.data,'base64');if(compress){const encoded=spawnSync(process.env.FFMPEG_PATH||'C:/Users/王/AppData/Roaming/bilibili/ffmpeg/ffmpeg.exe',['-hide_banner','-loglevel','error','-i','pipe:0','-c:a','libmp3lame','-b:a','64k','-f','mp3','pipe:1'],{input:data,maxBuffer:16000000});if(encoded.status!==0)throw Error('MP3 compression failed '+item.id);data=encoded.stdout;row.data=data.toString('base64');}const run=spawnSync(process.env.FFMPEG_PATH||'C:/Users/王/AppData/Roaming/bilibili/ffmpeg/ffmpeg.exe',['-hide_banner','-nostats','-i','pipe:0','-f','null','-'],{input:data,maxBuffer:2000000});
   const log=run.stderr?.toString()||'';const matches=[...log.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];const m=matches.at(-1);if(run.status!==0||!m)throw Error('Undecodable '+item.id+' '+i);
   row.seconds=Number(m[1])*3600+Number(m[2])*60+Number(m[3]);if(row.seconds<=0)throw Error('Empty '+item.id);seconds+=row.seconds;
   if(!ep.segments[i]||!ep.segments[i].text)throw Error('Missing text '+item.id);
   if(ep.engine==='seed-audio'){const transcript=row.subtitle?.sentences?.map(s=>s.text).join('')||'';const coverage=textCoverage(ep.segments[i].text,transcript);console.log('COVERAGE '+item.id+' '+i+' '+coverage.toFixed(3));if(coverage<0.85)throw Error('Subtitle does not match script '+item.id+' '+i);}
  }
  if(ep.audio.length!==ep.segments.length)throw Error('Incomplete '+item.id);
  item.durationSeconds=Math.round(seconds);item.style=labels[expected];item.ready=true;item.sourceCount=ep.references.length;item.createdAt=new Date().toISOString();item.revision='featured-v2';
  delete item.error;delete d.ctx.owner;delete d.ctx.expires;
  const content=JSON.stringify(d);if(Buffer.byteLength(content)>4400000)throw Error('Route response too large '+item.id);
  prepared.push([item.id,content]);console.log('VERIFIED '+item.id+' '+ep.style+' '+Math.round(seconds)+'s '+ep.audio.length+' segments '+Buffer.byteLength(content)+' bytes');
 }
 for(const [id,content] of prepared)await fs.writeFile('content/catalog/'+id+'.json',content);
 await fs.writeFile('public/data/discovery.json',JSON.stringify(catalog,null,2));
 console.log('PROMOTED '+prepared.length);process.exit(0);
}
let next=0,failures=0;
await Promise.all(Array.from({length:mode==='audio'?2:1},async()=>{while(next<items.length){const item=items[next++];try{if(mode==='draft')await draft(item);else if(mode==='audio')await audio(item);else throw Error('Use draft, audio or promote')}catch(e){failures++;console.log('FAILED '+item.id+' '+e.message)}}}));
console.log('FINISHED '+mode+' failures='+failures);if(failures)process.exitCode=1;
