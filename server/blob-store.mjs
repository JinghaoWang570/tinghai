import * as blob from '@vercel/blob';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
function localPath(name){const root=path.resolve(process.env.TINGHAI_DATA_DIR);const file=path.resolve(root,name);if(!file.startsWith(root+path.sep))throw Error('Invalid storage path');return file}
export async function get(name,options){if(!process.env.TINGHAI_DATA_DIR)return blob.get(name,options);try{const bytes=await fs.readFile(localPath(name));return {stream:new Response(bytes).body}}catch(e){if(e.code==='ENOENT')return null;throw e}}
export async function put(name,text,options){if(!process.env.TINGHAI_DATA_DIR)return blob.put(name,text,options);const file=localPath(name);await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});const tmp=file+'.'+randomUUID()+'.tmp';await fs.writeFile(tmp,text,{mode:0o600});await fs.rename(tmp,file);return {pathname:name}}
export async function del(name){if(!process.env.TINGHAI_DATA_DIR)return blob.del(name);await fs.rm(localPath(name),{force:true})}
