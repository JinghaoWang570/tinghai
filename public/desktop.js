function desktopNavigation(){const mine=['library','favorites','settings','player'].includes(state.page);return `<aside class="desktop-sidebar" aria-label="桌面导航"><button class="desktop-brand" data-nav="home"><img src="/assets/tinghai-favicon-rounded-ba051779af.webp" alt=""><span>听海<small>TINGHAI</small></span></button><nav>${[['home','发现','globe',!mine&&state.page!=='discover'],['discover','热榜','flame',state.page==='discover'],['library','我的','headphones',mine]].map(([page,title,glyph,on])=>`<button data-nav="${page}" ${on?'aria-current="page"':''}><span class="desktop-nav-icon">${icon(glyph)}</span><span>${title}</span></button>`).join('')}</nav><button class="desktop-create" data-nav="question">${icon('mic')}把好奇变成声音</button><div class="desktop-sidebar-mascot" aria-hidden="true"><img src="/assets/kanshan-listening-50844f827e.webp" alt=""></div><div class="desktop-sidebar-bottom"><button data-nav="settings">${icon('settings')}<span>设置</span></button></div></aside>`}
function mountDesktopReading(){
 const page=document.querySelector('.listen-page'),wide=window.matchMedia('(min-width:1000px)').matches;
 const existing=document.querySelector('.desktop-reading');
 const region=page?.querySelector('.listen-switch-region');
 if(!page||!wide){existing?.remove();page?.querySelector('.desktop-cover')?.remove();if(region){region.setAttribute('aria-label','切换封面与讲稿');region.tabIndex=0}return}
 region?.setAttribute('aria-label','节目封面');if(region)region.tabIndex=-1;
 const stage=page.querySelector('.listen-stage');
 if(stage&&!stage.querySelector('.listen-cover')){const cover=document.createElement('div');cover.className='listen-cover desktop-cover';cover.innerHTML=listenCoverMarkup(state.episode);stage.prepend(cover)}
 if(existing)return;
 const reading=document.createElement('aside');reading.className='desktop-reading';
 reading.innerHTML='<div class="desktop-reading-head"><h2>本期讲稿</h2><button data-listen="playlist" aria-label="章节目录">'+icon('list')+'</button></div><div class="listen-script desktop-script" aria-label="本期讲稿">'+state.episode.segments.map((s,i)=>`<p data-segment-index="${i}">${i===0||s.chapterTitle!==state.episode.segments[i-1]?.chapterTitle?'<b class="desktop-chapter">'+esc(s.chapterTitle||'正文')+'</b>':''}${scriptCharacters(s.text)}</p>`).join('')+'</div>';
 page.append(reading);
}
const renderBeforeDesktop=render;
render=function(){renderBeforeDesktop();mountDesktopReading()};
window.addEventListener('resize',mountDesktopReading);
document.addEventListener('click',e=>{const b=e.target.closest('[data-desktop-category]');if(b){const max=(discoveryCatalog?.categories.length||1)-1;setDiscoveryCategory(Math.max(0,Math.min(max,discoveryCategory+Number(b.dataset.desktopCategory))))}});
const performanceDefaults={first:'年轻讲述者，声音温暖自然，用第一人称角色化讲述，语气细腻、有亲近感。',story:'沉稳的评书演员，声音浑厚清晰，抑扬顿挫，悬念处稍作停顿，叙事有画面感。',clapper:'中年男性快板演员，声音洪亮有力，吐字清晰，亲切幽默，有传统曲艺韵味。'};
function performanceDescription(){return state.performanceDescriptions?.[state.style]||performanceDefaults[state.style]||''}
function clapperVoiceSelection(){return `<div class="setting clapper-voice"><label for="performance-description">声音与表演描述</label><textarea id="performance-description" maxlength="240" rows="3" placeholder="描述声音、语气与表演方式">${esc(performanceDescription())}</textarea><p class="micro">用文字定义这期节目的讲述方式</p></div>`}
document.addEventListener('input',e=>{if(e.target.id==='performance-description'){state.performanceDescriptions??={};state.performanceDescriptions[state.style]=e.target.value}});
