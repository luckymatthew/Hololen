import test from 'node:test';
import assert from 'node:assert/strict';
import {pool, state, unit, inst} from './fixtures/simulator-audit.mjs';
const {applyAction, isActionCandidateLegal} = await import(process.env.HOLO_ENGINE_TEST_TARGET || '../lib/simulator/engine.mjs');
const normal = {type:'oshiSkill'}, special = {type:'spOshiSkill'};
function setup(number, power=4) {
  const s=state();s.phase='main';s.players[0].oshi=inst(number);
  s.players[0].holoPower=Array.from({length:power},(_,i)=>inst('hY01-001',`power-${i}`));
  return s;
}
const allowed=(s,a,cards=pool)=>isActionCandidateLegal(s,0,a,new Map(cards.map(c=>[c.number,c])));
const execute=(s,a,cards=pool)=>applyAction(s,0,a,cards,()=>.5);

test('missing SP never becomes a candidate; legacy Koyori normal fallback remains executable',()=>{
  const s=setup('hEB01-003',2),before=structuredClone(s);
  assert.equal(allowed(s,special),false);
  assert.throws(()=>execute(s,special),/沒有這個技能/);
  assert.equal(allowed(s,normal),true);assert.doesNotThrow(()=>execute(s,normal));
  const legacy=pool.map(c=>c.number==='hEB01-003'?{...c,oshiSkill:null}:c);
  assert.equal(allowed(s,normal,legacy),true);assert.doesNotThrow(()=>execute(s,normal,legacy));
  assert.equal(allowed(s,special,legacy),false);assert.deepEqual(s,before);
  const unknown=setup('UNKNOWN-OSHI');assert.equal(allowed(unknown,normal),false);assert.equal(allowed(unknown,special),false);
});

test('reactive oshi skills are unavailable as proactive main actions, even with enough power',()=>{
  for(const [number,action] of [['hBP04-001',special],['hBP01-002',normal],['hBP09-005',normal]]) {
    const s=setup(number,10);assert.equal(allowed(s,action),false,number);assert.throws(()=>execute(s,action),/反應式/);
  }
});

test('normal oshi prerequisites reject wrong windows, spent skill and insufficient power',()=>{
  for(const variant of ['power','used','phase','actor','status','pending']) {
    const s=setup('hEB01-003',2);
    if(variant==='power')s.players[0].holoPower.pop();
    if(variant==='used')s.players[0].oshiSkillTurn=s.turn;
    if(variant==='phase')s.phase='performance';
    if(variant==='actor')s.activePlayer=1;
    if(variant==='status')s.status='finished';
    if(variant==='pending')s.pendingChoice={type:'option',playerIndex:0,options:[]};
    assert.equal(allowed(s,normal),false,variant);assert.throws(()=>execute(s,normal));
  }
});

test('legal active SP remains executable at its official power cost and rejects once spent',()=>{
  const vivi=pool.find(c=>c.group==='holomem'&&c.stage==='2nd'&&c.jpName==='綺々羅々ヴィヴィ');assert.ok(vivi);
  const s=setup('hBP09-006',3);s.players[0].zones.center=unit(vivi.number);
  assert.equal(allowed(s,special),true);assert.equal(execute(s,special).players[0].spOshiSkillUsed,true);
  s.players[0].holoPower.pop();assert.equal(allowed(s,special),false);assert.throws(()=>execute(s,special),/Holo Power/);
  s.players[0].holoPower.push(inst('hY01-001','restore'));s.players[0].spOshiSkillUsed=true;
  assert.equal(allowed(s,special),false);assert.throws(()=>execute(s,special),/已使用/);
});

test('X-cost Hajime opens its payment choice at zero power and still checks its center and usage',()=>{
  const hajime=pool.find(c=>c.group==='holomem'&&c.jpName==='轟はじめ');assert.ok(hajime);
  const s=setup('hBP09-002',0);s.players[0].zones.center=unit(hajime.number);
  assert.equal(allowed(s,normal),true);assert.doesNotThrow(()=>execute(s,normal));
  s.players[0].oshiSkillTurn=s.turn;assert.equal(allowed(s,normal),false);assert.throws(()=>execute(s,normal));
  s.players[0].oshiSkillTurn=String(s.turn);assert.equal(allowed(s,normal),false);assert.throws(()=>execute(s,normal));
  s.players[0].oshiSkillTurn=0;s.players[0].zones.center=null;assert.equal(allowed(s,normal),false);assert.throws(()=>execute(s,normal));
});

test('Moco collab cost reduction is preserved at one power below the normal cost',()=>{
  const mococo=pool.find(c=>c.group==='holomem'&&c.stage==='1st'&&c.jpName==='モココ・アビスガード');assert.ok(mococo);
  const s=setup('hBP03-004',2);s.players[0].zones.center=unit(mococo.number);
  s.players[0].zones.collab=unit('hBP08-060');s.players[0].cheerDeck=[inst('hY06-001','cheer')];
  assert.equal(allowed(s,normal),true);assert.doesNotThrow(()=>execute(s,normal));
  s.players[0].zones.collab=null;assert.equal(allowed(s,normal),false);assert.throws(()=>execute(s,normal),/Holo Power/);
});
