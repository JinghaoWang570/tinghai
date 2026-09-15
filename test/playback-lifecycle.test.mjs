import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
function setup(){
 const handlers={},elements={},created=[];
 class Audio{constructor(src){this.src=src;this.currentTime=0;this.duration=20;this.readyState=1;created.push(this)}pause(){this.paused=true}async play(){this.paused=false}}
 const c=vm.createContext({Audio,document:{addEventListener(type,fn){(handlers[type]??=[]).push(fn)},getElementById:id=>elements[id]||null,querySelector:()=>null,querySelectorAll:()=>[]},window:{addEventListener(){}},setInterval(){},setTimeout:fn=>fn(),state:{page:'player',index:0,rate:1,playing:false,episode:{audioStatus:'ready',segments:[{text:'一'},{text:'二'}],audio:[{url:'first',seconds:20},{url:'last',seconds:20}]}},icons:{},render(){},toast(){},URL:{revokeObjectURL(){}},AbortController});
 vm.runInContext(fs.readFileSync('public/voice.js','utf8'),c);
 vm.runInContext(fs.readFileSync('public/listening.js','utf8'),c);
 return {c,created,handlers,elements};
}
test('whole episode stops and replay starts at the first clip; mid-clip pause resumes in place',async()=>{
 const {c,created}=setup();await vm.runInContext('playCloudSegment()',c);
 created[0].currentTime=9;vm.runInContext('pauseCloudAudio()',c);await vm.runInContext('playCloudSegment()',c);
 assert.equal(created.length,1);assert.equal(created[0].currentTime,9);
 created[0].onended();await Promise.resolve();assert.equal(c.state.index,1);
 created[1].onended();assert.equal(c.state.episode.listenEnded,true);assert.equal(c.state.playing,false);
 await vm.runInContext('playCloudSegment()',c);assert.equal(c.state.index,0);assert.equal(created.at(-1).src,'first');assert.equal(created.at(-1).currentTime,0);assert.equal(c.state.episode.listenEnded,false);
});
test('waiting for an ungenerated chapter is not mistaken for an ended episode',async()=>{
 const {c,created}=setup();c.state.episode.audioStatus='generating';c.state.episode.audio.pop();
 await vm.runInContext('playCloudSegment()',c);created[0].onended();assert.equal(c.state.waitingForAudio,1);assert.equal(c.state.episode.listenEnded,false);
});
test('late ended events from replaced audio cannot advance the new playback',async()=>{
 const {c,created}=setup();await vm.runInContext('playCloudSegment()',c);await vm.runInContext('seekListening(25)',c);created[0].onended();assert.equal(c.state.index,1);assert.notEqual(c.state.episode.listenEnded,true);
});
test('manual seek after completion cancels replay state and retains the selected chapter',async()=>{
 const {c,created}=setup();c.state.index=1;await vm.runInContext('playCloudSegment()',c);created[0].onended();
 await vm.runInContext('seekListening(25)',c);await vm.runInContext('playCloudSegment()',c);assert.equal(c.state.index,1);assert.equal(created.at(-1).currentTime,5);
});
test('drag previews thumb, blue fill and elapsed time, then follows playback despite focus',async()=>{
 const {c,handlers,elements}=setup();const styles={};
 const bar=elements['listen-seek']={id:'listen-seek',value:'30',max:'40',dataset:{},style:{setProperty:(k,v)=>styles[k]=v}};
 elements['listen-elapsed']={};elements['listen-duration']={};c.document.activeElement=bar;
 for(const fn of handlers.input)fn({target:bar});assert.equal(styles['--played'],'75%');assert.equal(elements['listen-elapsed'].textContent,'00:30');
 vm.runInContext('updateListenProgress()',c);assert.equal(bar.value,'30');
 for(const fn of handlers.change)await fn({target:bar});assert.equal(c.state.index,1);assert.equal(styles['--played'],'75%');
 vm.runInContext('episodeAudio.currentTime=12;updateListenProgress()',c);assert.equal(bar.value,'32');assert.equal(styles['--played'],'80%');
});
