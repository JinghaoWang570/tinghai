import test from 'node:test';
import assert from 'node:assert/strict';
import {duplexText} from '../server/duplex-text.mjs';
test('retrieved equations and quoted material cannot introduce YAML escapes',()=>{
 const result=duplexText('瑞利散射：\\frac{1}{\\lambda^4}\n作者说："蓝光"');
 assert.equal(result,'瑞利散射：＼frac{1}{＼lambda^4}\n作者说：＂蓝光＂');
});
