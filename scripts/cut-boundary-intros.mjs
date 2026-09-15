import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const root='.local-cache/boundary-edit',ffmpeg=process.env.FFMPEG_PATH||'C:/Users/王/AppData/Roaming/bilibili/ffmpeg/ffmpeg.exe';fs.mkdirSync(root,{recursive:true});
const plan=JSON.parse(fs.readFileSync('content/edits/boundary-cleanup.json')),manifest=JSON.parse(fs.readFileSync('public/data/discovery.json'));const prepared=[];
for(const id of new Set(plan.map(r=>r.id))){const path='content/catalog/'+id+'.json',saved=JSON.parse(fs.readFileSync(path));const ep=saved.episode;if(ep.editRevision==='boundary-cleanup-v1')continue;const oldDuration=ep.audio.reduce((n,a)=>n+a.seconds,0);fs.writeFileSync(root+'/'+id+'-original.json',JSON.stringify(saved));
 for(const row of plan.filter(r=>r.id===id).sort((a,b)=>b.segmentIndex-a.segmentIndex)){
  const i=row.segmentIndex,segment=ep.segments[i];if(segment.text!==row.original)throw Error('Source changed '+id+' '+i);
  const parent=saved.ctx.script[segment.sourceIndex];const clean=parent.text.replace(/\[S\d+\]/g,'');if(!clean.includes(row.remove))throw Error('Parent mismatch '+id);parent.text=clean.replace(row.remove,'').trim();
  if(!row.keep){ep.segments.splice(i,1);ep.audio.splice(i,1);continue;}
  const input=root+'/'+id+'-source.mp3',output=root+'/'+id+'-cut.mp3';fs.writeFileSync(input,Buffer.from(ep.audio[i].data,'base64'));
  const r=spawnSync(ffmpeg,['-y','-v','error','-i',input,'-af',`atrim=start=${row.trimStartSeconds},asetpts=PTS-STARTPTS,afade=t=in:d=0.008`,'-c:a','libmp3lame','-b:a','128k',output]);if(r.status)throw Error('Cut failed '+id);
  const decoded=spawnSync(ffmpeg,['-v','error','-i',output,'-ar','16000','-ac','1','-f','s16le','pipe:1'],{maxBuffer:4000000});if(decoded.status||!decoded.stdout.length)throw Error('Decode failed '+id);
  segment.text=row.keep;ep.audio[i]={data:fs.readFileSync(output).toString('base64'),seconds:decoded.stdout.length/32000};
 }
 const indexMap=new Map();saved.ctx.script=saved.ctx.script.filter((s,i)=>{if(!s.text.trim())return false;indexMap.set(i,indexMap.size);return true});
 for(const segment of ep.segments){if(!indexMap.has(segment.sourceIndex))throw Error('Orphan segment');segment.sourceIndex=indexMap.get(segment.sourceIndex);}
 if(ep.audio.length!==ep.segments.length)throw Error('Mapping mismatch');ep.editRevision='boundary-cleanup-v1';
 const seconds=ep.audio.reduce((n,a)=>n+a.seconds,0),item=manifest.categories.flatMap(c=>c.items).find(x=>x.id===id);item.durationSeconds=Math.round(seconds);item.updatedAt=new Date().toISOString();item.editRevision=ep.editRevision;
 prepared.push([path,JSON.stringify(saved)]);console.log(id+' '+oldDuration.toFixed(2)+'s -> '+seconds.toFixed(2)+'s; '+ep.segments.length+' segments');
}
for(const [path,data]of prepared)fs.writeFileSync(path,data);fs.writeFileSync('public/data/discovery.json',JSON.stringify(manifest,null,2));console.log('Updated '+prepared.length+' episodes without synthesis');
