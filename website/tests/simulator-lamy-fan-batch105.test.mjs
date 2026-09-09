import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(s,0,a,pool,()=>0);
for(const attached of [false,true])test('048 Lamy with Yukimin recipient '+attached,()=>{
 const lamy=cards.find(c=>c.jpName==='雪花ラミィ'&&c.stage==='1st');const fan=cards.find(c=>c.jpName==='雪民'||c.name==='雪民');let s=state(lamy.number);s.phase='main';s.players[0].hand=[inst('hBP04-048','bloom')];s.players[0].cheerDeck=[inst('hY01-001','top')];
 s.players[0].zones.back1=unit(lamy.number,{attachments:attached?[inst(fan.number,'fan')]:[]});s.players[0].zones.back2=unit('AUDIT-DUMMY',{attachments:[inst(fan.number,'wrong')]});
 s=act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
 if(attached){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.options,['back1']);s=act(s,{type:'choose',zone:'back1'});assert.equal(s.players[0].zones.back1.cheer[0].id,'top');}
 else assert.equal(s.players[0].cheerDeck.length,1);
 assert.equal(s.pendingChoice,null);
});
