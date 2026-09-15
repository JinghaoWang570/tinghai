import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root = path.resolve('public'), output = path.resolve('.vercel-static');
await fs.mkdir(output, {recursive: true});
await fs.cp(root, output, {recursive: true, filter: source => !/marker-comparison|podcast-selected-verification|kanshan-navigation-v2\.png|tinghai-favicon\.jpg/.test(source)});
for (const name of ['index.html', 'shared.html']) {
  const file = path.join(output, name);
  let text = await fs.readFile(file, 'utf8');
  text = text.replace('<script', '<script>window.__TINGHAI_CLOUD__=true;</script><script src="/cloud-transport.js"></script><script');
  const assets=[...text.matchAll(/(?:src|href)="(\/[^"?]+\.(?:js|css))"/g)];
  for(const match of assets){const bytes=await fs.readFile(path.join(output,match[1]));const version=createHash('sha256').update(bytes).digest('hex').slice(0,12);text=text.replaceAll('"'+match[1]+'"','"'+match[1]+'?v='+version+'"')}
  await fs.writeFile(file, text);
}
console.log('Vercel static assets prepared; local diagnostics and credentials excluded.');
