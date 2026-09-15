import fs from 'node:fs/promises';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
const file='public/data/discovery.json',catalog=JSON.parse(await fs.readFile(file,'utf8'));
let totalBefore=0,totalAfter=0;
await Promise.all(catalog.categories.flatMap(c=>c.items).filter(i=>i.coverImage?.startsWith('https://')).map(async item=>{
 try{
  const response=await fetch(item.coverImage,{signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('HTTP '+response.status);
  const input=Buffer.from(await response.arrayBuffer());if(input.length>10000000)throw Error('Image too large');
  const output=await sharp(input).rotate().resize(480,480,{fit:'cover',withoutEnlargement:true}).webp({quality:80}).toBuffer();
  const target='/assets/cover-'+item.id+'-'+createHash('sha256').update(output).digest('hex').slice(0,10)+'.webp';
  await fs.writeFile('public'+target,output);item.coverOriginal=item.coverImage;item.coverImage=target;totalBefore+=input.length;totalAfter+=output.length;
 }catch(error){console.warn(item.id+': retained original ('+error.message+')')}
}));
await fs.writeFile(file,JSON.stringify(catalog,null,2)+'\n');console.log(JSON.stringify({totalBefore,totalAfter}));
