import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards,pool,inst,state } from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
function ready(number) {
 const card=cards.find(c=>c.number===number);
 const base=cards.find(c=>c.jpName===card.jpName&&c.stage==='Debut');
 const s=state(base.number); s.phase='main'; s.players[0].hand=[inst(number,'bloom')]; return s;
}
const bloom=s=>act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
for(const type of ['supportTool','supportItem','supportItemLimited',null]) test('033 tool damage '+type,()=>{
 const s=ready('hBP03-033');
 if(type)s.players[1].zones.center.attachments=[inst(cards.find(c=>c.typeCode===type).number,'attached')];
 assert.equal(bloom(s).players[1].zones.center.damage,type==='supportTool'?30:10);
});
test('038 Debut Bloom searches only first-stage Fuwawa and returns selected card',()=>{
 const s=ready('hBP03-038');
 const valid=cards.find(c=>c.jpName==='フワワ・アビスガード'&&c.stage==='1st');
 s.players[0].mainDeck=[inst(valid.number,'valid'),inst('hBP03-040','debut'),inst('hBP03-038','wrongName')];
 const next=bloom(s);
 assert.deepEqual(next.pendingChoice.cards.map(c=>c.id),['valid']);
 const done=act(next,{type:'choose',cardIds:['valid']});
 assert.equal(done.players[0].hand.some(c=>c.id==='valid'),true);
 assert.equal(done.players[0].mainDeck.length,2);
});
