import {PERFORMANCE_VOICES, requestPerformanceAudio} from './clapper.mjs';

export const isPerformance = style => ['first','story','clapper'].includes(style);
const profileHash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(x=>x.toString(16).padStart(2,'0')).join('');
const failure = message => Object.assign(Error(message), {status:503, code:'VOICE_ERROR'});
// A version is immutable: changing script/description creates a different identity.
export async function performanceProfile(ctx, owner) {
 const description = String(ctx.clapperVoice || PERFORMANCE_VOICES[ctx.style]).slice(0,240);
 return {version:1, id:await profileHash([owner,ctx.voiceRevision || 'legacy',ctx.style,ctx.script,description]),
  model:'seed-audio-1.0', style:ctx.style, description, mode:'reference'};
}
function performanceStore(env){if(!env.PERFORMANCE_STORE)throw failure('固定音色存储尚未配置，请稍后重试');return env.PERFORMANCE_STORE;}
const sampleKey=p=>`voice-profiles/v1/${p.id}.json`;
const inFlight=new Map();
export async function ensurePerformanceProfile(env,ctx,owner,signal){
 const profile=await performanceProfile(ctx,owner),store=performanceStore(env),key=sampleKey(profile);
 const found=await store.read(key);
 if(ctx.voiceProfile && (!found || ctx.voiceProfile.sampleHash!==found.sampleHash))throw failure('本期声音样本不可用，请稍后重试；不会自动更换声音');
 if(found)return {...profile,sampleHash:found.sampleHash};
 // Coalesce only within the same storage instance/production account. Persistence resolves cross-instance races.
 const lock=key+':'+await profileHash([env.TINGHAI_DATA_DIR,env.BLOB_READ_WRITE_TOKEN,!!env.LOCAL_DEV]);
 if(inFlight.has(lock))return inFlight.get(lock);
 const work=(async()=>{
  const result=await requestPerformanceAudio(env,{model:profile.model,
   text_prompt:`只生成一位讲述者的干净中文人声样本，10至20秒，最长25秒。声音描述：${profile.description}。自然从容、清晰稳定。没有音乐、竹板、醒木、环境音、回声或其他人声，不念声音描述。只朗读：清晨，我推开窗，看见阳光落在桌边。街上传来轻轻的脚步声，新的一天开始了。我想慢慢讲述眼前的故事，让每一句话都听得清楚，也让那些细小的变化被人记住。`,
   audio_config:{format:'mp3',sample_rate:44100,speech_rate:-10,enable_subtitle:true}},signal);
  if(!Number.isFinite(result.duration)||result.duration<=0||result.duration>30)throw failure('声音样本时长不合适，请重试');
  const sample={audio:result.audio,sampleHash:await profileHash(result.audio),seconds:result.duration};
  const committed=await store.create(key,sample);if(!committed)throw failure('声音样本保存失败，请重试');
  return {...profile,sampleHash:committed.sampleHash};
 })();inFlight.set(lock,work);
 try{return await work}finally{inFlight.delete(lock)}
}
export async function loadPerformanceProfile(env,ctx,owner){
 const expected=await performanceProfile(ctx,owner),p=ctx.voiceProfile;
 if(!p||p.version!==1||p.id!==expected.id||!p.sampleHash)throw failure('请先准备本期固定声音，再生成音频');
 const store=performanceStore(env),sample=await store.read(sampleKey(p));
 if(!sample||sample.sampleHash!==p.sampleHash||await profileHash(sample.audio)!==p.sampleHash)throw failure('本期声音样本不可用，请重试；不会自动更换声音');
 return {profile:p,references:[{audio_data:sample.audio}],
  async cached(body,generate){
   const key=`voice-segments/v1/${p.id}/${await profileHash([p.sampleHash,body])}.json`;
   const found=await store.read(key);if(found)return found;
   const result=await generate();const saved=await store.create(key,result);
   if(!saved)throw failure('节目音频保存失败，请重试');return saved;
  }};
}
