import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, inst, unit, state, attack, fund } from './fixtures/simulator-audit.mjs';
const risu = cards.find(c => c.group === 'holomem' && c.jpName === 'アユンダ・リス' && c.arts?.length && !c.arts[0].effect);
assert.ok(risu);
const act = (s, a, who = 0) => applyAction(structuredClone(s), who, a, pool, () => .5);
function setup(fans = 1) {
 const s = state(risu.number); s.phase = 'main';
 s.players[0].zones.center.attachments = Array.from({length:fans},(_,i)=>inst('hBP03-113','fan'+i));
 fund(s.players[0].zones.center, risu.arts[0].cost);
 s.players[0].cheerDeck = [inst('hY01-001','cheer1'),inst('hY01-001','cheer2')];
 return s;
}
function receive(s, type = 'cheerTarget') {
 s = structuredClone(s);
 s.pendingChoice = {type,playerIndex:0,options:['center'],cheerCard:type==='lifeCheerTarget'?inst('hY01-001','life'):undefined};
 return act(s,{type:'choose',zone:'center'});
}
function damage(s) {
 s = structuredClone(s); s.phase='performance';
 return act(s,attack).players[1].zones.center.damage;
}
for(const type of ['cheerTarget','eventCheerTarget','lifeCheerTarget']) {
 test('Risuners gains +10 through '+type,()=>{
   assert.equal(damage(receive(setup(),type)),risu.arts[0].damage+10);
 });
}
test('each Risuners copy triggers once, multiple Cheer do not retrigger',()=>{
 const first=receive(setup(3));
 const second=receive(first,'eventCheerTarget');
 assert.equal(damage(second),risu.arts[0].damage+30);
});
test('Risuners usage survives serialization and resets on the next turn',()=>{
 let s=receive(setup());
 s=JSON.parse(JSON.stringify(s));s.turn++;
 assert.equal(damage(receive(s)),risu.arts[0].damage+10);
});
test('no fan means no bonus; playing a fan after existing Cheer gives no bonus',()=>{
 let s=setup(0);s.players[0].hand=[inst('hBP03-113','newFan')];
 s=act(act(s,{type:'play',cardId:'newFan'}),{type:'choose',zone:'center'});
 assert.equal(damage(s),risu.arts[0].damage);
 assert.equal(damage(receive(s)),risu.arts[0].damage+10);
});
test('archived Cheer attachment triggers Risuners',()=>{
 const s=setup();s.players[0].archive=[inst('hY01-001','archived')];
 s.pendingChoice={type:'stageTarget',playerIndex:0,targetPlayerIndex:0,options:['center'],effect:'attachArchiveCheer',meta:{cardId:'archived'}};
 assert.equal(damage(act(s,{type:'choose',zone:'center'})),risu.arts[0].damage+10);
});
test('moving Cheer to Risuners holder triggers only its recipient',()=>{
 const s=setup();s.players[0].zones.back1=unit(risu.number,{stack:[inst(risu.number,'otherRisu')],cheer:[inst('hY01-001','move')],attachments:[inst('hBP03-113','otherFan')]});
 s.pendingChoice={type:'moveStageCheerTarget',playerIndex:0,sourceZone:'back1',cheerId:'move',options:['center']};
 const end=act(s,{type:'choose',zone:'center'});
 assert.ok(end.players[0].zones.center.cheer.some(c=>c.id==='move'));
 assert.equal(end.players[0].zones.back1.cheer.length,0);
 assert.equal(damage(end),risu.arts[0].damage+10);
 assert.equal((end.players[0].zones.back1.modifiers||[]).filter(m=>m.sourceNumber==='hBP03-113').length,0);
});

test('Risuners grants no bonus before Cheer and expires without new Cheer next turn',()=>{
 const s=setup();assert.equal(damage(s),risu.arts[0].damage);
 const next=receive(s);next.turn++;
 assert.equal(damage(next),risu.arts[0].damage);
});
test('earned Arts bonus remains on recipient after fan leaves',()=>{
 const s=receive(setup());s.players[0].archive.push(...s.players[0].zones.center.attachments.splice(0));
 assert.equal(damage(s),risu.arts[0].damage+10);
});
test('a newly attached second copy can trigger without reusing the first copy',()=>{
 let s=receive(setup());s.players[0].hand=[inst('hBP03-113','newFan')];
 s=act(act(s,{type:'play',cardId:'newFan'}),{type:'choose',zone:'center'});
 assert.equal(damage(s),risu.arts[0].damage+10);
 assert.equal(damage(receive(s)),risu.arts[0].damage+20);
});
test('fan returning from hand is a fresh instance of its once-per-turn ability',()=>{
 let s=receive(setup());s.players[0].hand.push(...s.players[0].zones.center.attachments.splice(0));
 s=act(act(s,{type:'play',cardId:'fan0'}),{type:'choose',zone:'center'});
 assert.equal(damage(receive(s)),risu.arts[0].damage+20);
});
test('moving an already used fan on stage does not reset its usage',()=>{
 let s=receive(setup());const fan=s.players[0].zones.center.attachments.pop();
 s.players[0].zones.back1=unit(risu.number,{stack:[inst(risu.number,'secondRisu')],attachments:[fan]});
 s.pendingChoice={type:'eventCheerTarget',playerIndex:0,options:['back1']};
 s=act(s,{type:'choose',zone:'back1'});
 assert.equal((s.players[0].zones.back1.modifiers||[]).filter(m=>m.sourceNumber==='hBP03-113').length,0);
});
test('Arts attachment reaction resolves after printed damage and survives saved state',()=>{
 let s=setup();s.phase='performance';
 s.artsResolution={phase:'ability',knockouts:[]};
 s.effectQueue=[{type:'dealArtsDamage',playerIndex:0,targetPlayerIndex:1,sourceZone:'center',targetZone:'center',damage:20,artName:'Timing check'}, {type:'completeArtsResolution',playerIndex:0}];
 s.pendingChoice={type:'eventCheerTarget',playerIndex:0,options:['center']};
 s=act(JSON.parse(JSON.stringify(s)),{type:'choose',zone:'center'});
 assert.equal(s.players[1].zones.center.damage,20);
 assert.equal(s.players[0].zones.center.modifiers.find(m=>m.sourceNumber==='hBP03-113')?.amount,10);
 assert.equal(s.artsResolution,undefined);
});
