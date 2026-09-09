import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state,attack} from './fixtures/simulator-audit.mjs';
for(const stage of ['Debut','Spot','1st','2nd'])test('095 HP bonus stage '+stage,()=>{
 const card=cards.find(c=>c.group==='holomem'&&c.stage===stage&&!c.keyword&&c.hp>=100);assert.ok(card);
 const s=state('AUDIT-DUMMY',card.number);s.players[1].zones.center.damage=card.hp-100;s.players[1].zones.center.attachments=[inst('hBP03-095','tool')];
 const next=applyAction(s,0,attack,pool,()=>0);
 assert.equal(next.players[1].zones.center!==null,['Debut','Spot'].includes(stage));
});
