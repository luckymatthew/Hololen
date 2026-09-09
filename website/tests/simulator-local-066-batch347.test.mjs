import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,fund,attack} from './fixtures/simulator-audit.mjs';
test('hBP05-066 local Arts counts distinct generation names without dice',()=>{
 const c=cards.find(c=>c.number==='hBP05-066');const other=cards.find(x=>x.group==='holomem'&&x.tags?.includes('#3期生')&&x.jpName!==c.jpName);let s=state(c.number);fund(s.players[0].zones.center,['無色','無色']);s.players[0].zones.back1=unit(c.number);s.players[0].zones.back2=unit(other.number);
 s=applyAction(s,0,attack,pool,()=>{throw Error('unexpected die');});assert.equal(s.players[1].zones.center.damage,50);assert.equal(s.pendingChoice,null);
});
