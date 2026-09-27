import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
const source=cards.find(c=>c.number==='hBP02-045'),base=cards.find(c=>c.jpName===source.jpName&&c.stage==='Debut');
const blue=cards.find(c=>c.group==='holomem'&&c.colors.includes('藍')),purple=cards.find(c=>c.group==='holomem'&&c.colors.includes('紫'));
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>.5);
function setup(noMatch=false){
 let s=state(base.number);s.phase='main';s.players[0].hand=[inst(source.number,'bloom')];
 s.players[0].mainDeck=noMatch?[inst('AUDIT-DUMMY','wrong-a'),inst('AUDIT-DUMMY','wrong-b'),inst('AUDIT-DUMMY','wrong-c'),inst('AUDIT-DUMMY','tail')]:[inst(blue.number,'blue'),inst(purple.number,'purple'),inst('AUDIT-DUMMY','wrong'),inst('AUDIT-DUMMY','tail')];
 return act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
}
for(const pick of ['blue','purple'])test('Shion blue-or-purple private look requires a qualifying card '+pick,()=>{
 let s=setup();assert.equal(s.pendingChoice?.effect,'genericTopLook');assert.deepEqual(s.pendingChoice.selectableIds,['blue','purple']);
 assert.equal(s.pendingChoice.optional,false);assert.equal(s.pendingChoice.min,1);
 assert.throws(()=>act(s,{type:'choose',skip:true}));
 assert.throws(()=>act(s,{type:'choose',cardIds:['wrong']}));
 s=act(s,{type:'choose',cardIds:[pick]});
 const rest=['blue','purple','wrong'].filter(id=>id!==pick).reverse();
 s=act(JSON.parse(JSON.stringify(s)),{type:'choose',cardIds:rest});
 assert.equal(s.pendingChoice,null);assert.deepEqual(s.players[0].mainDeck.map(c=>c.id),['tail',...rest]);assert.deepEqual(s.players[0].hand.map(c=>c.id),[pick]);
});

test('Shion blue-or-purple private look bottoms every revealed card when no match exists',()=>{
 let s=setup(true);
 assert.equal(s.pendingChoice?.effect,'bottomOrder');
 s=act(s,{type:'choose',cardIds:['wrong-a','wrong-b','wrong-c']});
 assert.deepEqual(s.players[0].mainDeck.map(c=>c.id),['tail','wrong-a','wrong-b','wrong-c']);
});
