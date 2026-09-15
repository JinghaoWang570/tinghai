import {createHmac, timingSafeEqual, randomUUID} from 'node:crypto';

export function signed(value, secret) {
  const body = Buffer.from(JSON.stringify(value)).toString('base64url');
  return body + '.' + createHmac('sha256', secret).update(body).digest('base64url');
}
export function verified(value, secret) {
  try {
    const [body, signature, extra] = value.split('.');
    if (extra || !signature) return null;
    const expected = createHmac('sha256', secret).update(body).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const data = JSON.parse(Buffer.from(body, 'base64url'));
    return data.expires > Date.now() ? data : null;
  } catch { return null; }
}
export function visitor(cookie, secret) {
  const token = (cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('tinghai_visitor='))?.slice(16);
  const previous = token && verified(token, secret);
  if (previous?.id && /^[a-f0-9-]{36}$/.test(previous.id)) return {owner: 'visitor:' + previous.id};
  const identity = {id: randomUUID(), expires: Date.now() + 365 * 86400000};
  return {owner: 'visitor:' + identity.id, cookie: `tinghai_visitor=${signed(identity, secret)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`};
}
