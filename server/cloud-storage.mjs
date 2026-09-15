import {get, put} from './blob-store.mjs';
import fs from 'node:fs/promises';
import {createHash, randomUUID} from 'node:crypto';
import {seal, unseal} from './app.mjs';
import {signed, verified} from './cloud-identity.mjs';

export const PART_SIZE = 1000000, MAX_BYTES = 32000000;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const json = (data, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});
const namespace = owner => createHash('sha256').update(owner).digest('hex');
async function read(path) {
  const blob = await get(path, {access: 'private', useCache: false});
  if (!blob) throw Object.assign(Error('节目尚未保存或分享不存在'), {status: 404});
  return new Response(blob.stream).text();
}
async function write(path, text) {
  await put(path, text, {access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60});
}
async function limited(req, limit) {
  const reader = req.body?.getReader();
  if (!reader) return '';
  const parts = []; let size = 0;
  try { while (true) { const {done, value} = await reader.read(); if (done) break; size += value.length; if (size > limit) throw Error('节目超过大小上限'); parts.push(value); } }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return Buffer.concat(parts).toString('utf8');
}
export function validateSavedEpisode(data, kind) {
  const audio = data.audio;
  if (!Array.isArray(audio) || !audio.length || audio.length > 200) throw Error('节目音频尚未完整生成');
  if (audio.some(row => {const value = kind === 'share' ? row : row?.data; return typeof value !== 'string' || !value.length || !/^[A-Za-z0-9+/=]+$/.test(value);})) throw Error('节目音频格式无效');
  if (typeof data.title !== 'string' || data.title.length > 500) throw Error('节目标题无效');
  if (kind === 'episodes' && audio.length !== data.segments?.length) throw Error('节目段落尚未完整生成');
}
export async function cloudStorage(req, env, owner) {
  const url = new URL(req.url), p = url.pathname;
  if (!p.startsWith('/__local/')) return null;
  try {
    if (p.startsWith('/__local/catalog/')) {
      const id = p.slice('/__local/catalog/'.length);
      if (req.method !== 'GET' || !/^[-a-z0-9]{1,48}$/.test(id)) return json({error: '节目标识无效'}, 400);
      const saved = JSON.parse(await fs.readFile(new URL('../content/catalog/' + id + '.json', import.meta.url), 'utf8'));
      return json({episode: {...saved.episode, context: await seal(saved.ctx, env.ZHIHU_ACCESS_SECRET, owner), curatedId: id}});
    }
    if (!env.BLOB_READ_WRITE_TOKEN && !env.TINGHAI_DATA_DIR) return json({error: '云端节目存储尚未配置'}, 503);
    if (p === '/__local/transfer' && req.method === 'POST') {
      const b = JSON.parse(await limited(req, 600000));
      if (!['share', 'episodes'].includes(b.kind) || !Number.isInteger(b.length) || b.length < 1 || b.length > MAX_BYTES || (b.kind === 'episodes' && !uuid.test(b.id))) throw Error('保存请求无效');
      const ctx = await unseal(b.context, env.ZHIHU_ACCESS_SECRET, owner);
      const id = b.kind === 'share' ? randomUUID() : b.id;
      const upload = randomUUID();
      await write(`uploads/${namespace(owner)}/${upload}/context.json`, JSON.stringify(ctx));
      const ticket = signed({owner, kind: b.kind, id, upload, length: b.length, count: Math.ceil(b.length / PART_SIZE), expires: Date.now() + 1800000}, env.ZHIHU_ACCESS_SECRET);
      return json({ticket, partSize: PART_SIZE});
    }
    if (p === '/__local/transfer/part' || p === '/__local/transfer/finish') {
      if (req.method !== 'POST') return json({error: '不支持此操作'}, 405);
      const ticket = verified(req.headers.get('x-tinghai-transfer') || '', env.ZHIHU_ACCESS_SECRET);
      if (!ticket || ticket.owner !== owner || !ticket.upload || !['share','episodes'].includes(ticket.kind)) return json({error: '保存会话已失效，请重试'}, 403);
      const prefix = `uploads/${namespace(owner)}/${ticket.upload}/`;
      if (p.endsWith('/part')) {
        const index = Number(url.searchParams.get('index'));
        if (!Number.isInteger(index) || index < 0 || index >= ticket.count) throw Error('音频分块无效');
        const text = await limited(req, PART_SIZE + 4);
        if (text.length !== Math.min(PART_SIZE, ticket.length - index * PART_SIZE)) throw Error('音频分块不完整');
        await write(prefix + index + '.json', text);
        return json({saved: true});
      }
      const parts = [];
      for (let i = 0; i < ticket.count; i++) parts.push(await read(prefix + i + '.json'));
      const data = JSON.parse(parts.join(''));
      validateSavedEpisode(data, ticket.kind);
      const ctx = JSON.parse(await read(prefix + 'context.json'));
      const file = ticket.kind === 'share' ? `shares/${ticket.id}.json` : `episodes/${namespace(owner)}/${ticket.id}.json`;
      await write(file, JSON.stringify({prefix, count: ticket.count, ctx, kind: ticket.kind}));
      return json(ticket.kind === 'share' ? {url: '/shared.html?id=' + ticket.id} : {saved: true, id: ticket.id});
    }
    const match = p.match(/^\/__local\/(episodes|share)\/([a-f0-9-]{36})$/);
    if (match && req.method === 'GET' && uuid.test(match[2])) {
      const [, kind, id] = match;
      const saved = JSON.parse(await read(kind === 'share' ? `shares/${id}.json` : `episodes/${namespace(owner)}/${id}.json`));
      if (url.searchParams.has('chunk')) {
        const index = Number(url.searchParams.get('chunk'));
        if (!Number.isInteger(index) || index < 0 || index >= saved.count) throw Error('分块不存在');
        return new Response(await read(saved.prefix + index + '.json'), {headers: {'Content-Type':'text/plain; charset=utf-8', 'Cache-Control':'private, no-store'}});
      }
      return json({_tinghaiChunks: saved.count, kind, ...(kind === 'episodes' ? {context: await seal(saved.ctx, env.ZHIHU_ACCESS_SECRET, owner)} : {})});
    }
    return json({error: '未找到节目'}, 404);
  } catch (e) { return json({error: e.code === 'ENOENT' ? '这期节目还在准备中' : e.message || '保存失败'}, e.code === 'ENOENT' ? 404 : e.status || 400); }
}
