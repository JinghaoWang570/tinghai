import test from 'node:test';
import assert from 'node:assert/strict';
import {generateStoryScript} from '../server/story.mjs';
const good=JSON.stringify({openingPoem:['一纸书来夜未央','半窗灯火照行囊','世间多少难明事','且听今宵细细讲'],segments:[{text:'话说这一天。'}]});
test('story format failures retry up to three times and return the valid fourth result',async()=>{let calls=0;const result=await generateStoryScript(async()=>++calls===4?good:'{}',[]);assert.equal(calls,4);assert.ok(result.openingPoem);});
test('exhausted story retries show only the generic error',async()=>{let calls=0;await assert.rejects(generateStoryScript(async()=>{calls++;return '{}'},[]),e=>e.message==='出现未知问题，请重试。');assert.equal(calls,4);});
test('cancel and service failures do not trigger format retries',async()=>{let calls=0;await assert.rejects(generateStoryScript(async()=>{calls++;throw Error('service failure')},[]),/service failure/);assert.equal(calls,1);const ctrl=new AbortController();ctrl.abort();await assert.rejects(generateStoryScript(async()=>{calls++;return good},[],ctrl.signal));assert.equal(calls,1);});
