import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,unit,attack} from './fixtures/simulator-audit.mjs';
for(const zone of ['center','collab'])test('Takodachi Arts bonus in '+zone,()=>{
 let s=state();s.players[0].zones[zone]=unit('AUDIT-DUMMY',{attachments:[inst('hBP08-110','fan1'),inst('hBP08-110','fan2')]});
 s=applyAction(s,0,{...attack,sourceZone:zone},pool,()=>0);assert.equal(s.players[1].zones.center.damage,120);
});

for(const holder of ['center','collab'])for(const target of ['center','collab'])test('Takodachi color advantage '+holder+' to '+target,()=>{
 const attacker={...pool.find(c=>c.number==='AUDIT-DUMMY'),number:'COLOR-ATTACK',arts:[{name:'Color probe',damage:100,cost:[],effect:'',specialTargets:['紫'],specialValues:[50]}]};
 let s=state('COLOR-ATTACK');s.players[0].zones.collab=unit('AUDIT-DUMMY');s.players[0].zones[holder].attachments=[inst('hBP08-110','fan')];s.players[1].zones.collab=unit('AUDIT-DUMMY');
 s=applyAction(s,0,{...attack,targetZone:target},[...pool,attacker],()=>0);assert.equal(s.players[1].zones[target].damage,holder==='center'?160:100);
});

for(const enabled of [true,false])test('Takodachi changes opposing color-gated SP '+enabled,()=>{
 let s=state();s.phase='main';s.players[0].oshi=inst('hBP03-003');s.players[0].holoPower=Array.from({length:10},(_,i)=>inst('AUDIT-DUMMY','power'+i));
 s.players[1].zones.center.attachments=enabled?[inst('hBP08-110','fan')]:[];
 if(enabled){s=applyAction(s,0,{type:'spOshiSkill'},pool,()=>0);assert.equal(s.players[0].hand.length,5);}else assert.throws(()=>applyAction(s,0,{type:'spOshiSkill'},pool,()=>0),/紅色/);
});

test('Takodachi effective colors captured before DOWN',()=>{
 const fragile={...pool.find(c=>c.number==='AUDIT-DUMMY'),number:'FRAGILE',hp:50,colors:['白']};let s=state('AUDIT-DUMMY','FRAGILE');s.players[0].zones.center.attachments=[inst('hBP08-110','fan')];s.players[1].zones.back1=unit('AUDIT-DUMMY');
 s=applyAction(s,0,attack,[...pool,fragile],()=>0);assert.ok(s.knockouts[0].card.colors.includes('紫'));assert.ok(s.knockouts[0].card.colors.includes('紅'));assert.deepEqual(fragile.colors,['白']);
});
for(const change of ['move','remove'])test('Takodachi live color ends on '+change,()=>{
 let s=state();s.phase='main';s.players[0].oshi=inst('hBP03-003');s.players[0].holoPower=Array.from({length:10},(_,i)=>inst('AUDIT-DUMMY','power'+i));s.players[1].zones.center.attachments=[inst('hBP08-110','fan')];
 const probe=applyAction(s,0,{type:'spOshiSkill'},pool,()=>0);assert.equal(probe.players[0].hand.length,5);
 if(change==='move'){s.players[1].zones.back1=s.players[1].zones.center;s.players[1].zones.center=unit('AUDIT-DUMMY');}else s.players[1].zones.center.attachments=[];
 assert.throws(()=>applyAction(s,0,{type:'spOshiSkill'},pool,()=>0),/紅色/);
});
