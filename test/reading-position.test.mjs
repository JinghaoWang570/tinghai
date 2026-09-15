import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
test('ready episode transitions never replace the player DOM',()=>{
 let writes=0,progress=0;const script={scrollTop:260};
 const c=vm.createContext({document:{querySelector:selector=>selector==='.listen-page'?{}:script,querySelectorAll:()=>[],getElementById:()=>null},$:()=>({set innerHTML(v){writes++}}),state:{page:'player',episode:{audioStatus:'ready'},index:0,rate:1},updateListenProgress(){progress++}});
 const code=fs.readFileSync('public/live.js','utf8').split('\n').find(s=>s.startsWith('function render()'));vm.runInContext('let renderedEpisode=state.episode;'+code,c);
 for(let i=1;i<=3;i++){c.state.index=i;vm.runInContext('render()',c)}assert.equal(writes,0);assert.equal(script.scrollTop,260);assert.equal(progress,3);
});
test('player rerender keeps reading scroll only for the same episode',()=>{
 let reading={scrollTop:240};const app={set innerHTML(value){reading={scrollTop:0}}};const page=()=>'';
 const c=vm.createContext({document:{querySelector:()=>reading},$:()=>app,state:{page:'player',episode:{}},frame:x=>x,home:page,discover:page,answer:page,configure:page,player:page,library:page});
 const code=fs.readFileSync('public/live.js','utf8').split('\n').find(s=>s.startsWith('function render()'));
 vm.runInContext('let renderedEpisode=state.episode;'+code,c);vm.runInContext('render()',c);assert.equal(reading.scrollTop,240);
 c.state.episode={};vm.runInContext('render()',c);assert.equal(reading.scrollTop,0);
});
