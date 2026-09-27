import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
function start(number,deck,previousStage='Debut'){
 const c=cards.find(c=>c.number===number),lower=cards.find(x=>x.jpName===c.jpName&&x.stage===previousStage);
 const s=state(lower.number);s.phase='main';s.players[0].hand=[inst(number,'bloom')];s.players[0].mainDeck=deck;
 return act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
}
for(const n of ['hBP02-011','hBP02-016'])test(n+' exact local-text search candidates',()=>{
 const eligible=cards.filter(c=>n==='hBP02-011'?c.tags.includes("#白上'sキャラクター"):c.group==='holomem'&&c.tags.includes('#3期生')&&['Debut','1st','Spot'].includes(c.stage));
 assert.ok(eligible.length);
 const deck=eligible.slice(0,5).map((c,i)=>inst(c.number,'yes'+i));
 deck.push(inst('AUDIT-DUMMY','wrong'));
 if(n==='hBP02-016')deck.push(inst(cards.find(c=>c.stage==='2nd'&&c.tags.includes('#3期生')).number,'wrongStage'));
 let e=start(n,deck);assert.equal(e.pendingChoice.optional,false,`${n} Bloom search is mandatory under its local text`);assert.deepEqual(e.pendingChoice.selectableIds,deck.filter(c=>c.id.startsWith('yes')).map(c=>c.id));
 assert.throws(()=>act(e,{type:'choose',skip:true}));
 const failedToFind=act(e,{type:'choose',cardIds:[]});assert.equal(failedToFind.pendingChoice,null);assert.equal(failedToFind.players[0].hand.length,0);assert.ok(failedToFind.players[0].mainDeck.some(c=>c.id.startsWith('yes')));
 assert.throws(()=>act(e,{type:'choose',cardIds:['wrong']}));
 e=act(e,{type:'choose',cardIds:['yes0']});assert.deepEqual(e.players[0].hand.map(c=>c.id),['yes0']);
 assert.equal(e.players[0].mainDeck.length,deck.length-1);
});
for(const n of ['hBP02-011','hBP02-016'])test(n+' absent candidates cannot search unrelated cards',()=>{
 const e=start(n,[inst('AUDIT-DUMMY','wrong')]);
 assert.equal(e.pendingChoice,null);assert.equal(e.players[0].hand.length,0);assert.equal(e.players[0].mainDeck[0].id,'wrong');
});

test('hBP02-016 does not run its Debut-only search when Blooming from 1st',()=>{
 const eligible=cards.find(c=>c.group==='holomem'&&c.tags.includes('#3期生')&&['Debut','1st','Spot'].includes(c.stage));
 assert.ok(eligible);
 const e=start('hBP02-016',[inst(eligible.number,'yes')],'1st');
 assert.equal(e.pendingChoice,null);
});
