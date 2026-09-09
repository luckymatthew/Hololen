import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state,attack} from './fixtures/simulator-audit.mjs';
for(const stage of ['Debut','1st','2nd'])for(const fan of [true,false])test('Harp '+stage+' fan '+fan,()=>{
 const base=cards.find(c=>c.jpName==='角巻わため'&&c.stage===stage);
 const card={...base,number:'HARP-TEST',arts:[{name:'test',damage:100,cost:[],effect:''}],keyword:null};
 let s=state(card.number);s.players[0].zones.center.attachments=[inst('hBP05-084','harp')];
 if(fan)s.players[0].zones.center.attachments.push(inst(cards.find(c=>c.jpName==='わためいと'||c.name==='わためいと').number,'fan'));
 s.players[0].archive=[inst('hY01-001','cheer')];s=applyAction(s,0,attack,[...pool,card],()=>0);
 if(stage==='2nd'){assert.equal(s.pendingChoice.optional,true);s=applyAction(s,0,{type:'choose',skip:true},[...pool,card],()=>0);}
 assert.equal(s.pendingChoice,null);assert.equal(s.players[1].zones.center.damage,110+(stage==='2nd'&&fan?10:0));
});
