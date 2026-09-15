import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const line=fs.readFileSync('public/voice.js','utf8').split('\n').find(x=>x.startsWith('function episodePlaybackRate'));
const c=vm.createContext({});vm.runInContext(line,c);
test('female compensation follows selected voice, composes with user speed and leaves unknown voices alone',()=>{
 const ep={style:'duo',segments:[{speaker:'A'},{speaker:'B'}],duoVoices:['zh_male_liufei_uranus_bigtts','zh_female_sophie_uranus_bigtts']};
 assert.equal(c.episodePlaybackRate(ep,0,1),1);assert.equal(c.episodePlaybackRate(ep,1,1),1.15);assert.equal(c.episodePlaybackRate(ep,1,1.2),1.2*1.15);assert.equal(c.episodePlaybackRate({...ep,style:'solo'},1,1),1);assert.equal(c.episodePlaybackRate({...ep,duoVoices:undefined},1,1),1);
});
