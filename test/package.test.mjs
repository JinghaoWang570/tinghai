import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('HTML references only packaged scripts and styles',()=>{
 const html=fs.readFileSync('public/index.html','utf8');
 const files=[...html.matchAll(/<script[^>]+src="\/(.+?\.js)"/g),...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\/(.+?\.css)"/g)].map(match=>match[1]);
 assert.ok(files.includes('library.js'));assert.ok(files.includes('library.css'));
 for(const file of files)assert.ok(fs.existsSync(path.join('public',file)),file+' is missing');
});

test('all fifteen curated episodes include complete audio',()=>{
 const files=fs.readdirSync('content/catalog').filter(file=>file.endsWith('.json'));
 assert.equal(files.length,15);
 for(const file of files){const saved=JSON.parse(fs.readFileSync(path.join('content/catalog',file),'utf8'));assert.ok(saved.ctx?.query,file);assert.ok(saved.episode?.segments?.length,file);assert.equal(saved.episode.audio.length,saved.episode.segments.length,file);assert.ok(saved.episode.audio.every(row=>typeof row.data==='string'&&row.data.length>1000),file)}
});
