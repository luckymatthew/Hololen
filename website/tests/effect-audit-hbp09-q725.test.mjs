import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyAction} from '../lib/simulator/engine.mjs';

const cards = JSON.parse(readFileSync(new URL('../public/cards.json', import.meta.url), 'utf8')).cards;
let serial = 0;
const instance = number => ({id:`q725-web-${++serial}`,number});
const unit = (number,{damage=0,cheer=[]}={}) => ({
  stack:[instance(number)],cheer,attachments:[],damage,rested:false,
  enteredTurn:1,bloomedTurn:0,collabbedTurn:0,returnSlot:null,modifiers:[],skipUnrestTurn:0,
});
const player = (name,oshi) => ({
  name,oshi:instance(oshi),ready:true,setupDone:true,turnsTaken:2,
  mainDeck:Array.from({length:4},()=>instance('hBP09-064')),cheerDeck:[],hand:[],life:[],holoPower:[],archive:[],removed:[],
  zones:{center:unit('hBP09-064'),collab:null,back1:null,back2:null,back3:null,back4:null,back5:null},
  collabTurn:0,batonTurn:0,limitedTurn:0,limitedUsesCount:0,limitedAllowanceTurn:0,limitedAllowance:1,
  oshiSkillTurn:0,spOshiSkillUsed:false,namedUsageTurns:{},modifiers:[],
  turnEvents:{turn:3,supports:[],arts:[],bloomCount:0,cheerArchived:0,deckArchived:0,stageReturned:0},
});
function fixture({existingCollab,sourceOshi='hBP09-001'}) {
  const own=player('Subaru',sourceOshi);
  const opponent=player('Opponent Subaru','hBP09-001');
  own.zones.back1=unit('hBP09-050');
  opponent.zones.back1=unit('hBP09-050');
  opponent.zones.back2=unit('hBP09-064');
  if(existingCollab)opponent.zones.collab=unit('hBP09-064');
  return {status:'playing',phase:'main',turn:3,activePlayer:0,firstPlayer:1,players:[own,opponent],effectQueue:[],pendingChoice:null,log:[],knockouts:[],lifeLosses:[]};
}
const act=(state,action)=>applyAction(state,0,action,cards,()=>0.25);

for(const existingCollab of [true,false]) {
  const caseName=existingCollab?'swap with existing Collab':'move into an empty Collab position';
  test(`Q725 ${caseName} does not trigger the moved hBP09-050's own Collab Effect`,()=>{
    let state=fixture({existingCollab});
    state=act(state,{type:'collab',zone:'back1'});
    assert.equal(state.pendingChoice?.type,'stageTarget');
    assert.equal(state.pendingChoice.targetPlayerIndex,1);
    assert.ok(state.pendingChoice.options.includes('back1'));
    state=act(state,{type:'choose',zone:'back1'});

    assert.equal(state.pendingChoice,null,'moving into Collab is not a Collab action and creates no nested Collab Effect choice');
    assert.equal(state.players[1].zones.collab.stack.at(-1).number,'hBP09-050');
    assert.equal(state.players[1].zones.collab.collabbedTurn,0);
    assert.equal(state.players[1].collabTurn,0,'the move does not consume the opponent\'s once-per-turn Collab action');
    assert.equal(state.players[1].zones.back2.stack.at(-1).number,'hBP09-064');
    assert.equal(state.players[1].zones.back1?.stack.at(-1).number,existingCollab?'hBP09-064':undefined);
  });
}

test('Q725 leaves the moved Holomem, attached Cheer/Support, damage, rest state and modifiers intact',()=>{
  for(const existingCollab of [true,false]) {
    let state=fixture({existingCollab});
    const selected=state.players[1].zones.back1;
    Object.assign(selected,{
      cheer:[instance('hY01-001')],attachments:[instance('hBP01-114')],damage:40,rested:true,
      modifiers:[{kind:'arts',amount:20,expiresTurn:9,source:'movement-preservation-test'}],
    });
    const selectedState={stack:selected.stack,cheer:selected.cheer,attachments:selected.attachments,damage:selected.damage,rested:selected.rested,modifiers:selected.modifiers};
    const oldCollab=state.players[1].zones.collab;
    const oldCollabState=oldCollab&&{stack:oldCollab.stack,cheer:oldCollab.cheer,attachments:oldCollab.attachments,damage:oldCollab.damage,rested:oldCollab.rested,modifiers:oldCollab.modifiers};
    state=act(state,{type:'collab',zone:'back1'});
    state=act(state,{type:'choose',zone:'back1'});
    assert.deepEqual(
      {stack:state.players[1].zones.collab.stack,cheer:state.players[1].zones.collab.cheer,attachments:state.players[1].zones.collab.attachments,damage:state.players[1].zones.collab.damage,rested:state.players[1].zones.collab.rested,modifiers:state.players[1].zones.collab.modifiers},
      selectedState,
      'the selected Back Holomem retains all its stage state and attached cards when moved into Collab',
    );
    if(existingCollab)assert.deepEqual(
      {stack:state.players[1].zones.back1.stack,cheer:state.players[1].zones.back1.cheer,attachments:state.players[1].zones.back1.attachments,damage:state.players[1].zones.back1.damage,rested:state.players[1].zones.back1.rested,modifiers:state.players[1].zones.back1.modifiers},
      oldCollabState,
      'the replaced Collab Holomem retains its stage state and attached cards in the selected Back slot',
    );
  }
});

test('hBP09-050 Collab Effect creates no target choice when the opponent has no Back Holomem',()=>{
  let state=fixture({existingCollab:false});
  state.players[1].zones.back1=null;
  state.players[1].zones.back2=null;
  state=act(state,{type:'collab',zone:'back1'});
  assert.equal(state.pendingChoice,null,'an impossible optional target is skipped rather than exposing an empty choice');
  assert.equal(state.players[1].zones.collab,null);
  assert.equal(state.players[1].zones.center.stack.at(-1).number,'hBP09-064');
});

test('hBP09-050 Collab Effect does not start when the acting Oshi is not Subaru',()=>{
  let state=fixture({existingCollab:false,sourceOshi:'hBP09-005'});
  state=act(state,{type:'collab',zone:'back1'});
  assert.equal(state.pendingChoice,null);
  assert.equal(state.players[0].zones.collab.stack.at(-1).number,'hBP09-050');
  assert.equal(state.players[1].zones.back1.stack.at(-1).number,'hBP09-050','the opponent is not moved when the source effect condition is false');
});

test('hBP09-050 card metadata matches the official RR, SR and UR identity and rules text',()=>{
  const card=cards.find(entry=>entry.number==='hBP09-050');
  assert.ok(card);
  assert.equal(card.jpName,'ハコス・ベールズ');
  assert.deepEqual(card.colorCodes,['red']);
  assert.equal(card.stage,'2nd');
  assert.equal(card.hp,200);
  assert.equal(card.baton,2);
  assert.deepEqual(card.variants.map(variant=>variant.rarity),['RR','SR','UR']);
  assert.equal(card.keyword.effect,'自分の推しホロメンが〈大空スバル〉なら、相手のバックホロメン1人を選ぶ。選んだホロメンと相手のコラボホロメンを交代させる。相手のコラボホロメンがいないなら、かわりに、選んだホロメンをコラボポジションに移動させる。');
  assert.equal(card.arts[0].effect,'自分のステージの〈大空スバル〉1人につき、このアーツ+20。');
  assert.equal(card.arts[0].damage,100);
  assert.deepEqual(card.arts[0].specialTargets,['紫']);
  assert.deepEqual(card.arts[0].specialValues,[50]);
});

test('hBP09-050 Collab condition recognizes every supported Subaru Oshi card printing',()=>{
  for(const sourceOshi of ['hBP09-001','hBP04-006','hBD24-056','hSD19-001']) {
    let state=fixture({existingCollab:false,sourceOshi});
    state=act(state,{type:'collab',zone:'back1'});
    assert.equal(state.pendingChoice?.type,'stageTarget',`${sourceOshi} should satisfy the Subaru Oshi name condition`);
    assert.equal(state.pendingChoice.targetPlayerIndex,1);
    assert.ok(state.pendingChoice.options.includes('back1'));
  }
});
