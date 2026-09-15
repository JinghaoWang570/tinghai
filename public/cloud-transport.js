// Cloud saves travel in small requests so long episodes also fit function limits.
(() => {
  if (!window.__TINGHAI_CLOUD__) return;
  const rawFetch = window.fetch.bind(window);
  const original = async (...args) => {
    const response=await rawFetch(...args);
    if(response.status===401 && new URL(response.url || location.href).origin===location.origin){
      document.documentElement.style.visibility='hidden';
      document.querySelectorAll('audio,video').forEach(media=>media.pause());
      window.top.location.replace('/auth/login');
    }
    return response;
  };
  const sessionReady = original('/api/session').then(r => {if (!r.ok) throw Error('云端服务尚未就绪，请稍后刷新');});
  sessionReady.catch(() => {});
  window.fetch = async (input, options = {}) => {
    const url = typeof input === 'string' ? new URL(input, location.href) : null;
    if (url?.origin === location.origin && /^\/(api|__local)\//.test(url.pathname)) await sessionReady;
    if (!url || url.origin !== location.origin || !url.pathname.startsWith('/__local/')) return original(input, options);
    const method = (options.method || 'GET').toUpperCase();
    if (method === 'POST' && /^\/__local\/(share|episodes\/[a-f0-9-]{36})$/.test(url.pathname)) {
      const data = JSON.parse(options.body), share = url.pathname === '/__local/share';
      const payload = share ? {title:data.title,audio:data.audio} : data;
      const text = JSON.stringify(payload).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
      const start = await original('/__local/transfer', {method:'POST', signal:options.signal, headers:{'Content-Type':'application/json'}, body:JSON.stringify({kind:share?'share':'episodes', id:url.pathname.split('/').pop(), length:text.length, context:data.context})});
      if (!start.ok) return start;
      const {ticket, partSize} = await start.json();
      for (let i = 0; i < text.length; i += partSize) {
        const r = await original('/__local/transfer/part?index=' + i / partSize, {method:'POST', signal:options.signal, headers:{'Content-Type':'text/plain', 'X-Tinghai-Transfer':ticket}, body:text.slice(i,i+partSize)});
        if (!r.ok) return r;
      }
      return original('/__local/transfer/finish', {method:'POST', signal:options.signal, headers:{'X-Tinghai-Transfer':ticket}});
    }
    const response = await original(input, options);
    if (method !== 'GET' || !response.ok || !/^\/__local\/(share|episodes)\//.test(url.pathname)) return response;
    const manifest = await response.clone().json();
    if (!manifest._tinghaiChunks) return response;
    const chunks = [];
    for (let i=0; i<manifest._tinghaiChunks; i++) {
      const r = await original(url.pathname + '?chunk=' + i, {signal:options.signal});
      if (!r.ok) return r;
      chunks.push(await r.text());
    }
    const data = JSON.parse(chunks.join(''));
    return Response.json(manifest.kind === 'episodes' ? {episode:{...data,context:manifest.context}} : {title:data.title,audio:data.audio});
  };
})();
