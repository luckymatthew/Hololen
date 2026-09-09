import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards,pool,inst,unit,state,fund,attack } from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
for(const choice of ['noOshi','center','collab','skip']) test('Towa unconditional damage and optional tool removal: '+choice,()=>{
 const s=state('hBP03-052');fund(s.players[0].zones.center,['紫']);
 if(choice!=='noOshi')s.players[0].oshi=inst(cards.find(c=>c.group==='oshi'&&c.jpName==='常闇トワ').number);
 const tool=cards.find(c=>c.typeCode==='supportTool').number;
 const item=cards.find(c=>c.typeCode==='supportItem').number;
 s.players[1].zones.center.attachments=[inst(tool,'centerTool'),inst(item,'item')];
 s.players[1].zones.collab=unit('AUDIT-DUMMY',{attachments:[inst(tool,'collabTool')]});
 s.players[1].zones.back1=unit('AUDIT-DUMMY',{attachments:[inst(tool,'backTool')]});
 let next=act(s,attack);
 if(choice==='noOshi') {assert.equal(next.pendingChoice,null);assert.equal(next.players[1].zones.center.damage,30);return;}
 assert.deepEqual(next.pendingChoice.attachmentOptions.map(c=>c.id),['centerTool','collabTool']);
 next=act(next,choice==='skip'?{type:'choose',skip:true}:{type:'choose',attachmentId:choice+'Tool'});
 assert.equal(next.players[1].zones.center.damage,30);
 assert.equal(next.players[1].archive.length,choice==='skip'?0:1);
 if(choice!=='skip')assert.equal(next.players[1].archive[0].id,choice+'Tool');
 assert.equal(next.players[1].zones.back1.attachments.length,1);
});
