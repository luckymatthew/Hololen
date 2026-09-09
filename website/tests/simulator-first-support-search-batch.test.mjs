import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
function setup(n,power=true){
 const s=state('hBP01-015');s.phase='main';s.players[0].oshi=inst('hBP01-002');
 s.players[0].hand=[inst(n,'support')];s.players[0].holoPower=power?[inst('AUDIT-DUMMY','power')]:[];
 s.players[0].mainDeck=['hBP01-015','hBP01-017','hBP01-020','hBP01-027','hBP01-024'].map((n,i)=>inst(n,'d'+i));
 s.players[0].cheerDeck=[inst('hY01-001','white'),inst('hY04-001','blue'),inst('hY03-001','red')];
 return s;
}
for(const n of ['hBP01-103','hBP01-105'])test(n+' requires and consumes Power',()=>{
 assert.throws(()=>act(setup(n,false),{type:'play',cardId:'support'}));
 const s=act(setup(n),{type:'play',cardId:'support'});assert.equal(s.players[0].holoPower.length,0);
 assert.ok(s.players[0].archive.some(c=>c.id==='power'));
});
test('103 exact white non-Buzz Debut/1st search',()=>{
 let s=act(setup('hBP01-103'),{type:'play',cardId:'support'});
 assert.deepEqual(s.pendingChoice.selectableIds,['d0','d1','d4']);
 assert.throws(()=>act(s,{type:'choose',cardIds:['d3']}));
 s=act(s,{type:'choose',cardIds:['d1']});assert.equal(s.players[0].hand[0].id,'d1');
});
test('104 Debut placement and exclusion',()=>{
 let s=act(setup('hBP01-104'),{type:'play',cardId:'support'});
 assert.deepEqual(s.pendingChoice.options,['hBP01-015','hBP01-024']);
 assert.throws(()=>act(s,{type:'choose',cardNumber:'hBP01-017',zone:'back1'}));
 s=act(s,{type:'choose',cardNumber:'hBP01-024',zone:'back1'});
 assert.equal(s.players[0].zones.back1.stack[0].number,'hBP01-024');
});
test('105 same stage color and required attachment',()=>{
 let s=act(setup('hBP01-105'),{type:'play',cardId:'support'});
 assert.deepEqual(s.pendingChoice.selectableIds,['white']);
 s=act(s,{type:'choose',cardIds:['white']});assert.throws(()=>act(s,{type:'choose',skip:true}));
 s=act(s,{type:'choose',zone:'center'});assert.equal(s.players[0].zones.center.cheer[0].id,'white');
});
for(const n of ['hBP01-103','hBP01-104','hBP01-105'])test(n+' hidden search decline shuffles',()=>{
 const s=act(setup(n),{type:'play',cardId:'support'});
 const key=n==='hBP01-105'?'cheerDeck':'mainDeck',before=s.players[0][key].map(c=>c.id);
 const e=act(s,{type:'choose',skip:true});assert.equal(e.pendingChoice,null);assert.notDeepEqual(e.players[0][key].map(c=>c.id),before);
});
