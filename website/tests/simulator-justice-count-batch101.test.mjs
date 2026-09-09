import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const count of [5,6])test('016 stage count gate '+count,()=>{
 const s=state('hBP04-016');fund(s.players[0].zones.center,['無色']);
 for(let i=1;i<count;i++)s.players[0].zones['back'+i]=unit('AUDIT-DUMMY',{stack:[inst('AUDIT-DUMMY','member'+i)]});
 const spot=cards.find(c=>c.group==='holomem'&&c.stage==='Spot'&&c.tags.includes('#Justice'));s.players[0].mainDeck=[inst(spot.number,'spot'),inst('AUDIT-DUMMY','tail')];
 const next=applyAction(s,0,attack,pool,()=>0);
 if(count===6){assert.equal(next.pendingChoice,null);assert.equal(next.players[0].mainDeck.length,2);assert.equal(next.players[1].zones.center.damage,10);}
 else assert.ok(next.pendingChoice);
});
