import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,attack,fund} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>.5);
function start(n,recipient=true){
 const c=cards.find(c=>c.number===n), arts=['hBP01-050','hBP01-076'].includes(n);
 const lower=cards.find(x=>x.jpName===c.jpName&&x.stage===(c.stage==='2nd'?'1st':'Debut'));
 const s=state(arts?n:lower.number);s.phase=arts?'performance':'main';
 s.players[0].cheerDeck=[inst('hY02-001','top'),inst('hY01-001','next')];
 if(recipient){
  const r=n==='hBP01-050'?cards.find(x=>x.group==='holomem'&&x.tags.includes('#秘密結社holoX')&&x.jpName!=='風真いろは'):cards.find(x=>x.group==='holomem'&&x.tags.includes('#ID')&&x.jpName!=='アイラニ・イオフィフティーン');
  s.players[0].zones.back1=unit(r.number);
  s.players[1].zones.back1=unit('AUDIT-DUMMY');
 }
 if(arts){fund(s.players[0].zones.center,c.arts[0].cost);return act(s,attack);}
 s.players[0].hand=[inst(n,'bloom')];return act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
}
for(const n of ['hBP01-041','hBP01-050','hBP01-054'])test(n+' required top Cheer and exact recipient',()=>{
 let s=start(n);assert.equal(s.pendingChoice?.type,'eventCheerTarget');assert.equal(s.pendingChoice.optional,false);
 const target=n==='hBP01-041'?'center':'back1';
 assert.deepEqual(s.pendingChoice.options,[target]);assert.throws(()=>act(s,{type:'choose',skip:true}));
 s=act(s,{type:'choose',zone:target});assert.ok(s.players[0].zones[target].cheer.some(c=>c.id==='top'));assert.equal(s.players[0].cheerDeck[0].id,'next');
});
for(const n of ['hBP01-050','hBP01-054'])test(n+' no eligible recipient preserves Cheer',()=>{
 const s=start(n,false);assert.equal(s.pendingChoice,null);assert.equal(s.players[0].cheerDeck.length,2);
});
for(const n of ['hBP01-076','hBP01-079'])test(n+' mandatory back damage',()=>{
 let s=start(n);assert.equal(s.pendingChoice?.effect,'specialDamage');assert.equal(s.pendingChoice.optional,false);
 assert.throws(()=>act(s,{type:'choose',skip:true}));assert.throws(()=>act(s,{type:'choose',zone:'center'}));
 s=act(s,{type:'choose',zone:'back1'});assert.equal(s.players[1].zones.back1.damage,n==='hBP01-076'?10:20);assert.equal(s.players[1].life.length,5);
});
