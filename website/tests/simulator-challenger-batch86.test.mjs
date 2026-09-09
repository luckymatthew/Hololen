import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
for(const mode of ['pay','skip','wrongOshi','short'])test('035 challenger '+mode,()=>{
 let s=state('hBP03-035');fund(s.players[0].zones.center,['紅','無色']);
 if(mode!=='wrongOshi')s.players[0].oshi=inst(cards.find(c=>c.group==='oshi'&&c.jpName==='鷹嶺ルイ').number);
 s.players[0].hand=[inst('AUDIT-DUMMY','a'),inst('AUDIT-DUMMY','b')].slice(0,mode==='short'?1:2);
 s=act(s,attack);
 if(mode==='pay'||mode==='skip'){
 assert.equal(s.pendingChoice.effect,'artHandArchiveCost');
 if(mode==='pay')assert.throws(()=>act(s,{type:'choose',cardIds:['a']}));
 s=act(s,mode==='pay'?{type:'choose',cardIds:['a','b']}:{type:'choose',skip:true});
 }
 assert.equal(s.pendingChoice,null);
 assert.equal(s.players[0].hand.length,mode==='pay'?3:mode==='short'?1:2);
 assert.equal(s.players[0].archive.length,mode==='pay'?2:0);
 assert.equal(s.players[0].mainDeck.length,mode==='pay'?27:30);
 assert.equal(s.players[1].zones.center.damage,50);
});
