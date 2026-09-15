import test from 'node:test';import assert from 'node:assert/strict';
import {episodeVoice,VOICES,voiceFrame,voiceDecode,splitPodcastSegments} from '../server/voice.mjs';
test('custom voices and complete turns go to podcast, without TTS fallback',async()=>{
 const voices=[VOICES[2].id,VOICES[0].id];let payload;
 class Socket extends EventTarget{send(raw){voiceDecode(raw).then(m=>{if(m.event===100)payload=m.data;this.dispatchEvent(new MessageEvent('message',{data:voiceFrame(m.event===100?150:152,{},'test')}))})}close(){}}
 const env={VOLC_API_KEY:'test',VOICE_CONNECT:async url=>{assert.match(url,/sami\/podcasttts$/);return new Socket()},VOICE_FETCH:()=>{throw Error('TTS forbidden')}};
 for await(const e of episodeVoice(env,[{speaker:'B',text:'第一句。第二句。'},{speaker:'A',text:'为什么？'}],'duo','',AbortSignal.timeout(1000),voices)){}
 assert.equal(payload.action,3);assert.deepEqual(payload.speaker_info.speakers,voices);assert.equal(payload.nlp_texts[0].speaker,voices[1]);assert.equal(payload.nlp_texts[0].text,'第一句。第二句。');
 await assert.rejects(async()=>{for await(const e of episodeVoice({...env,VOICE_CONNECT:async()=>{throw Error('403')}},[{speaker:'A',text:'你好'}],'duo','',AbortSignal.timeout(1000),voices)){}},/403/);
});
test('podcast preserves turn context and enforces text limits',()=>{const text='第一句。第二句。'+'知'.repeat(600);const rows=splitPodcastSegments([{text,speaker:'B'}]);assert.ok(rows.every(s=>s.text.length<=300&&s.sourceIndex===0));assert.equal(rows.map(s=>s.text).join(''),text)});
