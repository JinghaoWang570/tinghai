import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync('public/voice.js','utf8');
const implementation=source.slice(source.indexOf('async function makeEpisodeAudio()'),source.indexOf('function pauseCloudAudio()'));
function setup(previous){
 const calls=[],profile={id:'episode-1',sampleHash:'sample-1'},segments=[{text:'一'},{text:'二'}];
 const ep={context:'old',style:'first',segments,audio:[{url:'existing'}],voiceProfile:previous};
 const c=vm.createContext({state:{episode:ep,page:'preparing',index:0},voiceJob:null,voiceGeneration:0,episodeAudio:null,AbortController,Map,Audio:class{},render(){},voiceBlob(){return 'new'},async request(){return {context:'signed-new',voiceProfile:profile}},async readVoiceStream(p,body,s,onEvent){calls.push(body);if(!body.start)onEvent({type:'manifest',segments,voiceProfile:profile,engine:'seed-audio'});for(let index=body.start;index<2;index++){onEvent({type:'round',index});onEvent({type:'audio',index,data:'YWJj'});onEvent({type:'round-end',index,seconds:10});}}});
 vm.runInContext(implementation,c);return {c,ep,calls,profile};
}
test('same voice retry resumes after completed audio and passes the new signed context',async()=>{
 const f=setup({id:'episode-1',sampleHash:'sample-1'});await vm.runInContext('makeEpisodeAudio()',f.c);
 assert.equal(f.calls[0].start,1);assert.equal(f.calls[0].context,'signed-new');assert.equal(f.ep.audio[0].url,'existing');assert.equal(f.ep.audioStatus,'ready');
});
test('legacy or different voice discards old partial audio before restarting',async()=>{
 const f=setup(undefined);await vm.runInContext('makeEpisodeAudio()',f.c);
 assert.equal(f.calls[0].start,0);assert.equal(f.ep.audio[0].url,'new');assert.equal(f.ep.voiceProfile.sampleHash,'sample-1');
});
