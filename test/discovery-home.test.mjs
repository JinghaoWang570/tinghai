import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
function setup(fetch){
 const calls=[],urls=new Set();let n=0;
 const c=vm.createContext({home:()=>'<div class="home-grid">form</div>',document:{addEventListener(){},querySelector(){return null},querySelectorAll(){return []}},state:{page:'home',playing:true,episode:{title:'original'}},fetch:async(...args)=>{calls.push(args[0]);return fetch(...args)},AbortController,Blob,Uint8Array,atob,performance:{now:()=>0},URL:{createObjectURL:()=>{const u='blob:'+n++;urls.add(u);return u},revokeObjectURL:u=>urls.delete(u)},Audio:class{load(){this.duration=5;queueMicrotask(()=>this.onloadedmetadata?.())}},setTimeout:(fn,ms)=>{if(ms<2000)queueMicrotask(fn);return 1},clearTimeout(){},cancelAnimationFrame(){},nav:page=>{c.state.page=page},stopInterrupt(){},clearEpisodeAudio(){},audioUrls:new Set(),toast(){},render(){},playCloudSegment:async()=>{c.state.playing=true;c.state.paused=false}});
 vm.runInContext(fs.readFileSync('public/discovery-home.js','utf8').replace(/loadDiscovery\(\);\s*$/,''),c);
 vm.runInContext("discoveryCatalog={categories:[{items:[{id:'coffee',title:'咖啡',ready:true}]}]}",c);
 return {c,calls,urls};
}
const result=()=>({ok:true,json:async()=>({episode:{title:'咖啡',context:'signed',segments:[{text:'正文'}],audio:[{data:'AQID'}],audioStatus:'ready'}})});
test('curated episode loads cached audio and starts playing without generation calls',async()=>{
 const {c,calls}=setup(async()=>result());await vm.runInContext("openCurated('coffee')",c);
 assert.deepEqual(calls,['/__local/catalog/coffee']);assert.equal(c.state.page,'player');assert.equal(c.state.episode.title,'咖啡');assert.equal(c.state.playing,true);assert.equal(c.state.paused,false);assert.equal(c.state.episode.audio[0].seconds,5);assert.equal(c.audioUrls.size,1);
});
test('leaving cached preparation cannot replace the previous episode on late completion',async()=>{
 let resolve;const {c}=setup(()=>new Promise(r=>resolve=r));const work=vm.runInContext("openCurated('coffee')",c);vm.runInContext("stopCuratedLoad();nav('home')",c);resolve(result());await work;
 assert.equal(c.state.page,'home');assert.equal(c.state.episode.title,'original');assert.equal(c.audioUrls.size,0);
});
