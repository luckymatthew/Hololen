import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,state,attack} from './fixtures/simulator-audit.mjs';
const fuwawa=cards.find(c=>c.group==='holomem'&&c.jpName==='フワワ・アビスガード').number;
for(const position of ['center','back1','none'])test('Mococo free Arts Fuwawa '+position,()=>{
 const s=state();s.players[0].zones.collab=unit('hBP05-038');if(position!=='none')s.players[0].zones[position]=unit(fuwawa);
 const act=()=>applyAction(s,0,{...attack,sourceZone:'collab'},pool,()=>0);
 if(position==='center'){const r=act();assert.equal(r.players[1].zones.center.damage,30);assert.equal(r.players[0].zones.collab.cheer.length,0);}
 else assert.throws(act);
});
