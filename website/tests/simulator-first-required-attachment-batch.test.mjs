import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,attack} from './fixtures/simulator-audit.mjs';
const isolated=pool.map(c=>({...c,keyword:null,arts:[{name:'attack',damage:100,cost:[],effect:''}]}));
const act=(s,a,p=0)=>applyAction(structuredClone(s),p,a,isolated,()=>.5);
const aki=cards.find(c=>c.jpName==='アキ・ローゼンタール'&&c.stage==='Debut').number;
const azki=cards.find(c=>c.jpName==='AZKi'&&c.stage==='Debut').number;
test('Jobs requires healing an injured own Holomen',()=>{
 const s=state(aki);s.players[0].zones.center.attachments=[inst('hBP01-119')];
 s.players[0].zones.back1=unit('AUDIT-DUMMY',{damage:20});
 let e=act(s,attack);assert.equal(e.pendingChoice.type,'healTarget');assert.equal(e.pendingChoice.optional,false);
 assert.throws(()=>act(e,{type:'choose',skip:true}));
 e=act(e,{type:'choose',zone:'back1'});assert.equal(e.players[0].zones.back1.damage,10);
});
for(const n of ['hBP01-122','hBP01-124'])test(n+' requires its knockout Cheer action',()=>{
 const holder=n==='hBP01-122'?aki:azki,s=state();
 s.players[1].zones.back1=unit(holder,{damage:10000,attachments:[inst(n)],cheer:[inst('hY04-001','old')]});
 s.players[1].zones.back2=unit(holder);s.players[1].cheerDeck=[inst('hY04-001','top')];
 s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone:'back1',sourceZone:'center',amount:10,loseLife:false,sourceName:'ability'}];
 let e=act(s,attack);assert.equal(e.pendingChoice.optional,false);
 assert.throws(()=>act(e,{type:'choose',skip:true},1));
 if(n==='hBP01-124')e=act(e,{type:'choose',cardIds:['old']},1);
 e=act(e,{type:'choose',zone:'back2'},1);
 assert.deepEqual(e.players[1].zones.back2.cheer.map(c=>c.id),[n==='hBP01-122'?'top':'old']);
});
