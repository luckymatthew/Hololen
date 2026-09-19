import test from 'node:test';import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
for(const yellow of [false,true])for(const assistants of [0,2])for(const number of ['hEB01-020','hEB01-024'])for(const deckSize of [1,8]){
 test(`Koyori reveal oracle ${number} yellow=${yellow} assistants=${assistants} deck=${deckSize}`,()=>{
  let s=state(number);s.players[0].oshi=inst(yellow?'hEB01-003':'hBP04-001');fund(s.players[0].zones.center,number==='hEB01-020'?['黃','白']:['黃','白','白']);
  s.players[0].zones.center.attachments=Array.from({length:assistants},(_,i)=>inst('hBP04-105','fan'+i));s.players[0].zones.center.damage=100;
  s.players[0].mainDeck=Array.from({length:deckSize},(_,i)=>inst('AUDIT-DUMMY','deck'+i));
  const base=number==='hEB01-020'?2:3,count=Math.min(deckSize,base+(yellow?assistants:0));
  s=applyAction(s,0,{...attack,artIndex:number==='hEB01-020'?1:0},pool,()=>0);
  if(number==='hEB01-024'){assert.equal(s.pendingChoice.count,count);s=applyAction(s,0,{type:'choose',allocations:{center:count}},pool,()=>0);assert.equal(s.players[0].zones.center.damage,Math.max(0,100-count*20));}
  assert.equal(s.players[1].zones.center.damage,(number==='hEB01-020'?50:120)+count*(number==='hEB01-020'?10:20));
  assert.equal(s.players[0].mainDeck.length,deckSize);
 });
}
