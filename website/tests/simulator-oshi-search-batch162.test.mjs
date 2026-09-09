import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state} from './fixtures/simulator-audit.mjs';
for(const pay of [true,false])test('078 paid Oshi-name search '+pay,()=>{
 const oshi=cards.find(c=>c.group==='oshi'&&c.jpName==='大空スバル'),target=cards.find(c=>c.jpName===oshi.jpName&&c.stage==='Debut'),wrongStage=cards.find(c=>c.jpName===oshi.jpName&&c.stage==='1st');
 let s=state();s.phase='main';s.players[0].oshi=inst(oshi.number);s.players[0].zones.back1=unit('hBP06-078',{cheer:[inst('hY01-001','cost')]});
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(target.number,'valid'),inst(wrongStage.number,'wrongStage'),inst('hBP05-020','wrongName')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);s=applyAction(s,0,pay?{type:'choose',cheerId:'cost'}:{type:'choose',skip:true},pool,()=>0);
 if(pay){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['valid']);s=applyAction(s,0,{type:'choose',cardIds:['valid']},pool,()=>0);}
 assert.equal(s.players[0].hand.length,pay?1:0);assert.equal(s.pendingChoice,null);
});
