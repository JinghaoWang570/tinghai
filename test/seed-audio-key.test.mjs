import test from 'node:test';
import assert from 'node:assert/strict';
import {requestPerformanceAudio} from '../server/clapper.mjs';
import {ttsAudio} from '../server/voice.mjs';
test('Seed Audio uses dedicated key while TTS retains the original key',async()=>{
 const seen=[];const env={SEED_AUDIO_API_KEY:'seed-account',VOLC_API_KEY:'speech-account',VOICE_FETCH:async(url,init)=>{seen.push({url,key:init.headers['X-Api-Key']});return url.endsWith('/create')?Response.json({audio:'YWJj',duration:1}):new Response(JSON.stringify({code:20000000,data:'YWJj'})+'\n')}};
 await requestPerformanceAudio(env,{model:'seed-audio-1.0'},new AbortController().signal);
 for await(const event of ttsAudio(env,'测试','zh_male_liufei_uranus_bigtts',new AbortController().signal)){}
 assert.deepEqual(seen.map(x=>x.key),['seed-account','speech-account']);
});
test('Seed Audio supports existing configurations but never retries a rejected new key with the old account',async()=>{
 let calls=0;await assert.rejects(requestPerformanceAudio({SEED_AUDIO_API_KEY:'new',VOLC_API_KEY:'old',VOICE_FETCH:async()=>{calls++;return Response.json({code:401},{status:401})}},{},new AbortController().signal),/401/);assert.equal(calls,1);
 await requestPerformanceAudio({VOLC_API_KEY:'old',VOICE_FETCH:async(url,init)=>{assert.equal(init.headers['X-Api-Key'],'old');return Response.json({audio:'YWJj',duration:1})}},{},new AbortController().signal);
});
