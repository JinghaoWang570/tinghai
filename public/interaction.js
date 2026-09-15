// Animate navigation only: background renders and audio updates keep their DOM stable.
const navigateWithoutMotion=nav;
nav=function(page){
 const previous=state.page;
 navigateWithoutMotion(page);
 if(previous===state.page||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const main=document.querySelector('.shell main');
 const tabs=['home','discover','library'],from=tabs.indexOf(previous),to=tabs.indexOf(state.page);
 const horizontal=from>=0&&to>=0,direction=horizontal?Math.sign(to-from):1;
 main?.animate?.([{opacity:.25,transform:horizontal?`translateX(${direction*20}px)`:'translateY(10px)'},{opacity:1,transform:'translate(0,0)'}],{duration:240,easing:'cubic-bezier(.22,.7,.2,1)'});
};
const discoveryInspirations=['猫为什么总爱钻纸箱？','宋朝人下班后都去哪儿玩？','降噪耳机怎么让世界安静下来？','为什么一首歌会让人单曲循环？','咖啡为什么会有水果的香气？','海浪为什么总是不停地来？'];
let inspirationIndex=0;
setInterval(()=>{
 if(state.page!=='home'||document.hidden||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const hint=document.querySelector('.discovery-inspiration');
 const input=document.getElementById('discovery-query');if(input&&document.activeElement!==input&&!input.value)input.placeholder=discoveryInspirations[inspirationIndex++%discoveryInspirations.length];
 if(!hint||hint.closest('button')===document.activeElement)return;
 const exit=hint.animate?.([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-5px)'}],{duration:160,fill:'forwards'});
 if(!exit)return;
 exit.onfinish=()=>{
  if(!hint.isConnected||state.page!=='home')return;
  hint.textContent=discoveryInspirations[inspirationIndex++%discoveryInspirations.length];exit.cancel();
  hint.animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'ease-out'});
 };
},4600);
