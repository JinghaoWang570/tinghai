import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {get, put} from '@vercel/blob';
export function createPerformanceStore(env) {
 if(env.PERFORMANCE_STORE)return env.PERFORMANCE_STORE;
 const root=env.TINGHAI_DATA_DIR || (env.LOCAL_DEV ? path.resolve('.local-cache/voices') : null);
 if(!root&&!env.BLOB_READ_WRITE_TOKEN)return null;
 return {
  async read(key){
   if(root){try{return JSON.parse(await fs.readFile(path.join(root,key),'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}}
   const found=await get(key,{access:'private',useCache:false,token:env.BLOB_READ_WRITE_TOKEN});
   return found?JSON.parse(await new Response(found.stream).text()):null;
  },
  async create(key,value){
   if(root){
    const file=path.join(root,key),tmp=file+'.'+randomUUID()+'.tmp';
    await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(tmp,JSON.stringify(value));
    try{await fs.link(tmp,file)}catch(e){if(e.code!=='EEXIST')throw e}finally{await fs.unlink(tmp)}
   }else{
    try{await put(key,JSON.stringify(value),{access:'private',token:env.BLOB_READ_WRITE_TOKEN,addRandomSuffix:false,allowOverwrite:false,contentType:'application/json'})}
    catch(e){if(!await this.read(key))throw e}
   }
   // Concurrent requests must all use the first committed sample, never their losing draft.
   return this.read(key);
  }
 };
}
