import http from 'node:http';
import {Readable} from 'node:stream';
import {WebSocketServer} from 'ws';
import {api} from '../server/app.mjs';
import {cloudStorage} from '../server/cloud-storage.mjs';
import {visitor} from '../server/cloud-identity.mjs';
import {nodeVoiceConnect} from '../scripts/voice-node.mjs';
import {cloudOAuthEnv} from '../server/cloud-oauth.mjs';

function request(req, signal) {
  const url = new URL(req.url, 'https://' + req.headers.host);
  const route = url.searchParams.get('route');
  if (route && /^\/(api|auth|__local)\//.test(route)) {url.pathname = route; url.searchParams.delete('route');}
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) if (value) headers.set(key, String(value));
  headers.delete('oai-authenticated-user-id');
  const identity = visitor(headers.get('cookie'), process.env.ZHIHU_ACCESS_SECRET || process.env.TINGHAI_SESSION_SECRET);
  headers.set('oai-authenticated-user-id', identity.owner);
  return {identity, req: new Request(url, {method:req.method,headers,signal,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})})};
}
const env = () => ({...process.env, PUBLIC_DEPLOYMENT:true, VOICE_CONNECT:nodeVoiceConnect, VOICE_FETCH:fetch, FETCH:fetch});
const server = http.createServer(async (incoming, res) => {
  const controller = new AbortController();
  res.on('close', () => {if (!res.writableEnded) controller.abort();});
  try {
    if (!process.env.ZHIHU_ACCESS_SECRET) {res.writeHead(503, {'Content-Type':'application/json'});res.end(JSON.stringify({error:'知乎服务尚未配置'}));return;}
    const {identity, req} = request(incoming, controller.signal);
    if (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) {res.writeHead(403).end('Origin mismatch'); return;}
    const runtime = await cloudOAuthEnv(req,env(),identity.owner);
    const response = new URL(req.url).pathname === '/api/session' ? Response.json({ready:true}, {headers:{'Cache-Control':'no-store'}}) : await cloudStorage(req, runtime, identity.owner) || await api(req, runtime);
    res.statusCode = response.status;
    for (const [key,value] of response.headers) if (key !== 'set-cookie') res.setHeader(key,value);
    const cookies = response.headers.getSetCookie();
    cookies.push(...runtime.extraCookies);
    if (identity.cookie) cookies.push(identity.cookie);
    if (cookies.length) res.setHeader('Set-Cookie',cookies);
    if (response.body) Readable.fromWeb(response.body).pipe(res); else res.end();
  } catch {if (!res.headersSent) res.writeHead(500); res.end('Service unavailable');}
});
const wss = new WebSocketServer({noServer:true,maxPayload:600000});
server.on('upgrade', async (incoming,socket,head) => {
  try {
    const {req,identity} = request(incoming);
    if (identity.cookie) {socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');return;}
    const upgrade = attach => {wss.handleUpgrade(incoming,socket,head,ws=>{ws.binaryType='arraybuffer';attach(ws);});return new Response(null);};
    const response = await api(req,{...await cloudOAuthEnv(req,env(),identity.owner),ASR_UPGRADE:upgrade,DUPLEX_UPGRADE:upgrade});
    if (response.status !== 200) socket.end(`HTTP/1.1 ${response.status} Error\r\nConnection: close\r\n\r\n`);
  } catch {socket.destroy();}
});
export default server;
