import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,cards,N,instance,unit,act,answer,conserve,settle} from './hbp09-fixtures.mjs';
import {publicRoomState} from '../lib/simulator/engine.mjs';
const reload=s=>JSON.parse(JSON.stringify(s));

test('Nerissa power payment exposes only amounts, validates funds and archives from the top',()=>{
 const s=fixture(6,74),card=instance(N(76));s.players[0].hand=[card];
 let out=answer(act(s,{type:'play',cardId:card.id}),{zone:'center'});
 const ids=s.players[0].holoPower.map(c=>c.id);
 assert.equal(out.pendingChoice.type,'optionChoice');
 for(const id of ids)assert.ok(!JSON.stringify(out.pendingChoice).includes(id));
 assert.deepEqual(publicRoomState(out,1).pendingChoice,{type:'opponent',playerIndex:0});
 const short=reload(out);short.players[0].holoPower.length=1;const before=reload(short);
 assert.throws(()=>answer(short,{optionId:'3'}));assert.deepEqual(short,before);
 assert.throws(()=>answer(out,{optionId:'4'}));
 out=answer(reload(out),{optionId:'2'});
 assert.deepEqual(out.players[0].archive.slice(-2).map(c=>c.id),ids.slice(-2).reverse());conserve(s,out);
});

test('one Subaru reaction reduces both simultaneous Moona special hits, but not the printed Art damage',()=>{
 const s=fixture(6,60);s.phase='performance';s.players[0].zones.center.cheer=[instance('hY04-014'),instance('hY04-014')];
 s.players[1].oshi=instance('hBP04-006');s.players[1].zones.center=unit(N(10));s.players[1].zones.collab=unit(N(10));
 let out=act(s,{type:'attack',sourceZone:'center',targetZone:'center',artIndex:0});
 assert.equal(out.pendingChoice.effect,'oshiDamageReaction');
 out=answer(reload(out),{optionId:'normal:30'});
 assert.equal(out.players[1].zones.center.damage,50);
 assert.equal(out.players[1].zones.collab.damage,0);
 assert.equal(out.players[1].oshiSkillTurn,s.turn);conserve(s,out);
});

test('simultaneous Moona damage removes both Down units before allocating either Life cheer',()=>{
 const s=fixture(6,60);s.phase='performance';
 s.players[0].zones.center.cheer=[instance('hY04-014'),instance('hY04-014')];
 for(const zone of ['center','collab']){s.players[1].zones[zone]=unit(N(10));s.players[1].zones[zone].damage=160;}
 let out=act(s,{type:'attack',sourceZone:'center',targetZone:'center',artIndex:0});
 assert.deepEqual(out.knockouts.map(k=>k.zone),['center','collab']);
 assert.equal(out.players[1].zones.center,null);assert.equal(out.players[1].zones.collab,null);
 assert.equal(out.players[1].life.length,3);assert.deepEqual(out.pendingChoice.options,['back1']);
 out=settle(reload(out));assert.equal(out.players[1].zones.back1.cheer.length,2);conserve(s,out);
});

test('legacy Koyori tool and new Snow Moon share player-selected performance-end ordering',()=>{
 const s=fixture(6,77);s.phase='performance';
 const snow=instance(N(110));s.players[0].zones.center.attachments=[snow];s.players[0].zones.center.lastArtsTurn=s.turn;
 s.players[0].zones.collab=unit('hEB01-023');s.players[0].zones.collab.attachments=[instance('hEB01-034')];
 let out=act(s,{type:'advance'});
 assert.equal(out.phase,'performance');assert.equal(out.pendingChoice.type,'optionChoice');
 const tool=out.pendingChoice.modeOptions.find(o=>o.label.startsWith('hEB01-034'));assert.ok(tool);
 out=answer(reload(out),{optionId:tool.id});assert.equal(out.pendingChoice.type,'endToolDamage');
 out=answer(out,{skip:true});assert.equal(out.pendingChoice.type,'cardSelection');
 out=answer(out,{cardIds:[snow.id]});assert.equal(out.turn,s.turn+1);assert.equal(out.players[0].hand.length,1);conserve(s,out);
});

test('yellow Matsuri hand cost cannot use Lui replacement or receive its benefit when skipped',()=>{
 const s=fixture();s.players[0].oshi=instance('hBP01-005');s.players[0].zones.back1=unit(N(84));
 s.players[0].hand=[instance(N(98))];s.players[0].mainDeck.unshift(instance(N(84)));
 let out=act(s,{type:'collab',zone:'back1'});assert.equal(out.pendingChoice.type,'cardSelection');
 const power=out.players[0].holoPower.length;
 out=answer(out,{skip:true});assert.equal(out.pendingChoice,null);assert.equal(out.players[0].hand.length,1);
 assert.equal(out.players[0].holoPower.length,power);conserve(s,out);
});
