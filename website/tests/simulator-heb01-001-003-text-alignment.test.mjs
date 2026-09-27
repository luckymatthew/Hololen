import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {applyAction as websiteApplyAction} from '../lib/simulator/engine.mjs';
import {cards as websiteCards,dummy,oshi,state,unit,inst,attack} from './fixtures/simulator-audit.mjs';

const runtimes=[{name:'Website',applyAction:websiteApplyAction,cards:websiteCards}];
const androidEngineUrl=new URL('../../../android-current/web/lib/simulator/engine.mjs',import.meta.url);
const androidCardsUrl=new URL('../../../android-current/app/src/main/assets/cards.json',import.meta.url);
if(existsSync(fileURLToPath(androidEngineUrl))&&existsSync(fileURLToPath(androidCardsUrl))){
  const {applyAction:androidApplyAction}=await import(androidEngineUrl.href);
  const androidCards=JSON.parse(readFileSync(androidCardsUrl,'utf8')).cards;
  runtimes.push({name:'Android source',applyAction:androidApplyAction,cards:androidCards});
}
for(const runtime of runtimes)runtime.pool=[...runtime.cards,dummy,oshi];

function powerCards(prefix,count){return Array.from({length:count},(_,index)=>inst('hY01-001',`${prefix}-${index}`));}
for(const runtime of runtimes){
  const {applyAction,cards,pool}=runtime;
  const soraDebut=cards.find(card=>card.number==='hEB01-004');
  const marineDebut=cards.find(card=>card.number==='hEB01-011');
  const marineFirst=cards.find(card=>card.number==='hEB01-013');
  const marineSecond=cards.find(card=>card.number==='hEB01-016');
  const koyoriDebut=cards.find(card=>card.number==='hEB01-018');

  test(`${runtime.name}: hEB01-001 Oshi blooms a deck Sora and reduces only the Colorless Arts cost`,()=>{
    let s=state(soraDebut.number);s.phase='main';
    s.players[0].oshi=inst('hEB01-001','sora-oshi');
    s.players[0].holoPower=powerCards('sora-power',4);
    s.players[0].zones.center=unit(soraDebut.number,{enteredTurn:1,cheer:[inst('hY03-001','red')]});
    s.players[0].mainDeck=[inst('hEB01-006','sora-bloom')];
    s=applyAction(s,0,{type:'oshiSkill'},pool,()=>0);
    assert.equal(s.pendingChoice.effect,'oshiBloomFromDeckCard');
    s=applyAction(s,0,{type:'choose',cardIds:['sora-bloom']},pool,()=>0);
    s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
    assert.equal(s.players[0].zones.center.stack.at(-1).id,'sora-bloom');
    assert.equal(s.players[0].zones.center.modifiers.at(-1).kind,'artCost');
    s.phase='performance';
    s=applyAction(s,0,attack,pool,()=>0);
    assert.equal(s.players[1].zones.center.damage,50,'the remaining Red cost is paid while the Colorless cost is reduced');
  });

  test(`${runtime.name}: hEB01-001 end skill requires Sora Center/Collab and draws only with a 2nd`,()=>{
    const endTurn=(collabNumber,backNumber)=>{
      let s=state(soraDebut.number);s.phase='performance';
      s.players[0].oshi=inst('hEB01-001','sora-stage-oshi');
      s.players[0].zones.center=unit(soraDebut.number);
      s.players[0].zones.collab=unit(collabNumber);
      s.players[0].zones.back1=unit(backNumber);
      s.players[0].mainDeck=[inst('hY01-001','top-power'),inst('hY02-001','next-draw')];
      return applyAction(s,0,{type:'advance'},pool,()=>0);
    };
    const valid=endTurn('hEB01-005','hEB01-009');
    assert.deepEqual(valid.players[0].holoPower.map(card=>card.id),['top-power']);
    assert.deepEqual(valid.players[0].hand.map(card=>card.id),['next-draw']);
    const noSecond=endTurn('hEB01-005','hEB01-004');
    assert.deepEqual(noSecond.players[0].holoPower.map(card=>card.id),['top-power']);
    assert.equal(noSecond.players[0].hand.length,0);
    const wrongCollaborator=endTurn('hEB01-018','hEB01-009');
    assert.equal(wrongCollaborator.players[0].holoPower.length,0);
    assert.equal(wrongCollaborator.players[0].hand.length,0);
  });

  test(`${runtime.name}: hEB01-002 Oshi deals a second 50 only with a three-card Center stack`,()=>{
    const target=cards.find(card=>card.group==='holomem'&&card.stage==='1st');
    const fire=(stack)=>{
      let s=state();s.phase='main';
      s.players[0].oshi=inst('hEB01-002','marine-oshi');
      s.players[0].holoPower=powerCards('marine-power',2);
      s.players[0].zones.center=unit(marineDebut.number,{stack:[inst('marine-debut',marineDebut.number),...stack]});
      s.players[1].zones.back1=unit(target.number);
      s=applyAction(s,0,{type:'oshiSkill'},pool,()=>0);
      assert.equal(s.pendingChoice.effect,'oshiMarineSpecialDamage');
      s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);
      if(stack.length===2)s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);
      return s;
    };
    const twoOverlapped=fire([inst('marine-first',marineFirst.number),inst('marine-second',marineSecond.number)]);
    assert.equal(twoOverlapped.players[1].zones.back1.damage,100);
    const oneOverlapped=fire([inst('marine-first',marineFirst.number)]);
    assert.equal(oneOverlapped.players[1].zones.back1.damage,50);
  });

  test(`${runtime.name}: hEB01-002 Stage skill optionally repeat-Blooms current-turn Center Marine with Blue Marine from hand`,()=>{
    let s=state();s.phase='main';
    s.players[0].oshi=inst('hEB01-002','marine-stage-oshi');
    s.players[0].zones.center=unit(marineFirst.number,{stack:[inst(marineDebut.number,'marine-debut'),inst(marineFirst.number,'marine-first')],bloomedTurn:s.turn});
    s.players[0].zones.collab=unit(soraDebut.number);
    s.players[0].hand=[inst('hEB01-016','marine-second')];
    s=applyAction(s,0,{type:'advance'},pool,()=>0);
    assert.equal(s.pendingChoice.effect,'oshiMarineStageBloomCard');
    assert.equal(s.pendingChoice.optional,true);
    s=applyAction(s,0,{type:'choose',cardIds:['marine-second']},pool,()=>0);
    s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
    assert.equal(s.players[0].zones.center.stack.at(-1).id,'marine-second');
    assert.equal(s.players[0].zones.center.bloomedTurn,s.turn);
  });

  test(`${runtime.name}: hEB01-003 Oshi reveals Cheer plus Stage Assistants and applies the three-Holomen threshold`,()=>{
    const run=(withAssistant)=>{
      let s=state(koyoriDebut.number);s.phase='main';
      s.players[0].oshi=inst('hEB01-003','koyori-oshi');
      s.players[0].holoPower=powerCards('koyori-power',2);
      s.players[0].zones.center=unit(koyoriDebut.number,{cheer:[inst('hY01-001','white'),inst('hY05-001','purple')],attachments:withAssistant?[inst('hBP04-105','assistant')]:[]});
      s.players[0].mainDeck=[inst('hEB01-018','debut'),inst('hEB01-020','first'),inst('hEB01-024','second'),inst('hY02-001','remain')];
      return applyAction(s,0,{type:'oshiSkill'},pool,()=>0);
    };
    const withFan=run(true);
    assert.equal(withFan.players[0].mainDeck[0].id,'remain');
    assert.deepEqual(withFan.players[0].hand.map(card=>card.id),['first','second']);
    assert.ok(withFan.players[0].archive.some(card=>card.id==='debut'));
    assert.equal(withFan.players[0].koyoriArtsBonusTurn,withFan.turn);
    const withoutFan=run(false);
    assert.equal(withoutFan.players[0].mainDeck[0].id,'second');
    assert.deepEqual(withoutFan.players[0].hand.map(card=>card.id),['first']);
    assert.notEqual(withoutFan.players[0].koyoriArtsBonusTurn,withoutFan.turn,'without three Holomen, the Oshi skill must not grant this turn bonus');
  });

  test(`${runtime.name}: hEB01-003 Assistant count also extends Yellow Koyori Arts reveals`,()=>{
    for(const assistantCount of [0,2]){
      let s=state('hEB01-020');
      s.players[0].oshi=inst('hEB01-003','koyori-yellow-oshi');
      s.players[0].zones.center.cheer=[inst('hY06-001','yellow'),inst('hY01-001','white')];
      s.players[0].zones.center.attachments=Array.from({length:assistantCount},(_,index)=>inst('hBP04-105',`assistant-${index}`));
      s.players[0].mainDeck=Array.from({length:6},(_,index)=>inst('AUDIT-DUMMY',`reveal-${index}`));
      s=applyAction(s,0,{...attack,artIndex:1},pool,()=>0);
      assert.equal(s.players[1].zones.center.damage,70+assistantCount*10);
      assert.equal(s.players[0].mainDeck.length,6);
    }
  });
}
