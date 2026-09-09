import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state} from './fixtures/simulator-audit.mjs';
for(const [number,name,fan] of [['hBP07-032','輪堂千速','ふぐ太郎'],['hBP07-046','エリザベス・ローズ・ブラッドフレイム','Thorn'],['hBP08-077','音乃瀬奏','リコーダー']])for(const eligible of [true,false])test(number+' grouped mandatory search '+eligible,()=>{
 const first=cards.find(c=>c.jpName===name&&c.stage==='1st'),support=cards.find(c=>c.jpName===fan||c.name===fan);
 assert.ok(first&&support);
 let s=state();s.phase='main';s.firstPlayer=1;s.players[0].turnsTaken=eligible?1:2;s.players[0].zones.back1=unit(number);
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(first.number,'first'),inst(support.number,'fan')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 if(eligible){for(const id of ['first','fan']){assert.equal(s.pendingChoice.optional,false);assert.equal(s.pendingChoice.min,1);s=applyAction(s,0,{type:'choose',cardIds:[id]},pool,()=>0);}assert.equal(s.players[0].hand.length,2);}
 else assert.equal(s.pendingChoice,null);
});
