import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
const code=fs.readFileSync('public/library.js','utf8');
function setup(saved=null){
 const storage=new Map(saved?[['tinghai-library-v1',saved]]:[]),handlers={};let now=100;
 const c=vm.createContext({state:{index:0,page:'library'},icons:{},crypto:{randomUUID},episodeAudio:{currentTime:12},listenPosition:()=>({elapsed:12,total:100,complete:true}),listenClock:n=>String(n),localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},document:{addEventListener:(n,f)=>handlers[n]=f,querySelector:()=>null},window:{addEventListener(){}},Date:{now:()=>++now},setInterval(){},render(){},toast(){},icon:()=>'',esc:String,head:()=>'',AbortSignal,URL});
 vm.runInContext(code,c);return {c,storage,handlers};
}
test('history includes only played episodes, deduplicates, and returns the latest three',()=>{
 const {c}=setup();c.state.episode={catalogId:'unplayed',title:'未播放'};vm.runInContext('rememberListening()',c);
 assert.equal(vm.runInContext('recentListening().length',c),0);
 for(const id of ['a','b','c','d','b']){c.state.episode={catalogId:id,title:id};vm.runInContext('rememberListening(true)',c)}
 assert.equal(vm.runInContext("recentListening().map(r=>r.id).join(',')",c),'catalog:b,catalog:d,catalog:c');
 assert.equal(vm.runInContext("readLibrary().history.filter(r=>r.id==='catalog:b').length",c),1);
});
test('favorite without playback does not fabricate a listening record and survives reload',async()=>{
 const {c,storage}=setup();c.state.episode={catalogId:'a',title:'A'};
 await vm.runInContext('toggleLibraryFavorite()',c);
 assert.equal(vm.runInContext('recentListening().length',c),0);
 const next=setup(storage.get('tinghai-library-v1'));next.c.state.episode={catalogId:'a',title:'A'};
 assert.equal(vm.runInContext('readLibrary().favorites.length',next.c),1);
 await vm.runInContext('toggleLibraryFavorite()',next.c);assert.equal(vm.runInContext('readLibrary().favorites.length',next.c),0);
});
test('progress and completion are retained; non-playing progress updates do not reorder history',()=>{
 const {c,storage}=setup();c.state.episode={catalogId:'a',title:'A'};vm.runInContext('rememberListening(true)',c);
 c.state.index=2;c.state.episode.listenEnded=true;c.episodeAudio.currentTime=27;
 vm.runInContext('rememberListening()',c);
 const d=JSON.parse(storage.get('tinghai-library-v1'));assert.equal(d.history[0].index,2);assert.equal(d.history[0].offset,27);assert.equal(d.history[0].ended,true);assert.equal(d.history[0].lastHeard,101);
 c.episodeAudio=null;vm.runInContext('rememberListening()',c);
 assert.equal(JSON.parse(storage.get('tinghai-library-v1')).history[0].offset,27);
});
test('generated episode identity stays stable; malformed storage falls back to guest safely',()=>{
 const {c}=setup('{broken');c.state.episode={title:'节目'};
 const key=vm.runInContext('libraryEpisodeId(state.episode)',c);assert.match(key,/^episode:[a-f0-9-]{36}$/);assert.equal(vm.runInContext('libraryEpisodeId(state.episode)',c),key);
 assert.equal(vm.runInContext('readLibrary().profile.name',c),'听海听友');
});
test('connected accounts use the Zhihu nickname and avatar on My',()=>{
 const {c}=setup();c.state.oauth={authenticated:true,profile:{name:'知乎上的我',avatarUrl:'https://picx.zhimg.com/avatar.png'}};
 assert.equal(vm.runInContext('activeLibraryProfile().name',c),'知乎上的我');assert.equal(vm.runInContext('activeLibraryProfile().avatar',c),'https://picx.zhimg.com/avatar.png');
 const html=vm.runInContext('library()',c);assert.match(html,/知乎上的我/);assert.match(html,/picx\.zhimg\.com\/avatar\.png/);
});
test('settings persist nickname without preset avatars, and reject an empty nickname',()=>{
 const {c,storage,handlers}=setup();let nickname='新的听友';
 c.document.getElementById=()=>({value:nickname});c.FormData=class {get(){return '/assets/kanshan-listening-50844f827e.webp'}};c.nav=()=>{};
 handlers.submit({target:{id:'library-profile-form'},preventDefault(){}});
 assert.deepEqual(JSON.parse(storage.get('tinghai-library-v1')).profile,{name:'新的听友',avatar:'/assets/kanshan-player-default-eee0ee7689.webp'});
 nickname='   ';handlers.submit({target:{id:'library-profile-form'},preventDefault(){}});
 assert.equal(JSON.parse(storage.get('tinghai-library-v1')).profile.name,'新的听友');
});
test('logout acts only on an authenticated account and stops playback before leaving',()=>{
 const {c,handlers}=setup();const calls=[];c.stopInterrupt=()=>calls.push('interrupt');c.pauseCloudAudio=()=>calls.push('pause');c.oauthLogout=()=>calls.push('logout');
 const e={target:{closest:()=>({dataset:{},hasAttribute:n=>n==='data-library-logout'})}};
 handlers.click(e);assert.equal(calls.length,0);c.state.oauth={authenticated:true};handlers.click(e);assert.deepEqual(calls,['interrupt','pause','logout']);
});

test('custom avatar overrides only its owner and invalid image data is rejected',()=>{
 const {c}=setup();c.state.oauth={authenticated:true,profile:{name:'A',avatarUrl:'https://picx.zhimg.com/a.png'}};
 vm.runInContext("const s=readLibrary();s.profile.customAvatar='data:image/png;base64,AAAA';s.profile.customOwner='A';writeLibrary(s)",c);
 assert.equal(vm.runInContext('activeLibraryProfile().avatar',c),'data:image/png;base64,AAAA');
 c.state.oauth.profile={name:'B',avatarUrl:'https://picx.zhimg.com/b.png'};
 assert.equal(vm.runInContext('activeLibraryProfile().avatar',c),'https://picx.zhimg.com/b.png');
 assert.equal(vm.runInContext("validCustomAvatar('data:image/svg+xml;base64,AAAA')",c),false);
});
