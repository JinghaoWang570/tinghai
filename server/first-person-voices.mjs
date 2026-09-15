import {APIError} from './zhihu.mjs';
export const FIRST_PERSON_CATALOG=[
 ['male','young','青年男声·清朗'],['male','adult','成熟男声·沉稳'],['male','senior','年长男声·厚重'],
 ['female','young','青年女声·灵动'],['female','adult','成熟女声·知性'],['female','senior','年长女声·温和']
].map(([gender,age,name])=>({id:`first-${gender}-${age}-v1`,gender,age,name}));
export function firstPersonVoiceOptions(narrator){
 if(!narrator)return [];
 if(['male','female'].includes(narrator.gender))return FIRST_PERSON_CATALOG.filter(v=>v.gender===narrator.gender);
 return narrator.kind==='person'?[]:FIRST_PERSON_CATALOG;
}
export function resolveFirstPersonVoice(narrator,requested){
 const options=firstPersonVoiceOptions(narrator);
 if(!options.length)throw new APIError('请先确认视角角色的信息，再选择音色',400,'NARRATOR_CONFIRM_REQUIRED');
 if(requested){const voice=options.find(v=>v.id===requested);if(!voice)throw new APIError('所选音色与视角角色不匹配，请重新选择',400,'VOICE_GENDER_MISMATCH');return voice;}
 return options.find(v=>v.age===(narrator.ageGroup||'adult'))||options.find(v=>v.age==='adult')||options[0];
}
export function narratorVoiceResult(narrator){const voices=firstPersonVoiceOptions(narrator);return {narrator,voices,voicePreset:voices.length?resolveFirstPersonVoice(narrator).id:null};}
