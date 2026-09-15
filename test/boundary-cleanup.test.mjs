import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('approved boundary edits remove only the selected text and retain valid chapter mappings',()=>{
 const plan=JSON.parse(fs.readFileSync('content/edits/boundary-cleanup.json'));
 for(const id of new Set(plan.map(x=>x.id))){const d=JSON.parse(fs.readFileSync('content/catalog/'+id+'.json')),ep=d.episode;assert.equal(ep.editRevision,'boundary-cleanup-v1');assert.equal(ep.audio.length,ep.segments.length);
  for(const row of plan.filter(x=>x.id===id)){for(const text of [ep.segments.map(x=>x.text).join(''),d.ctx.script.map(x=>x.text).join('')]){assert.ok(!text.includes(row.remove));if(row.keep)assert.ok(text.includes(row.keep));}}
  for(const segment of ep.segments){const parent=d.ctx.script[segment.sourceIndex];assert.ok(parent);assert.equal(parent.speaker,segment.speaker);assert.ok(parent.text.replace(/\[S\d+\]/g,'').includes(segment.text));}
 }
});
