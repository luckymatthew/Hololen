import {applyAction} from '../../lib/simulator/engine.mjs';

const response=await fetch('/cards.json');
if(!response.ok)throw new Error(`Could not load current cards.json (${response.status})`);
const cards=(await response.json()).cards;
const map=new Map(cards.map(card=>[card.number,card]));
const status=document.querySelector('#status');
const output=document.querySelector('#result');
let serial=0;
const instance=number=>({id:`browser-q725-${++serial}`,number});
const unit=number=>({stack:[instance(number)],cheer:[],attachments:[],damage:0,rested:false,enteredTurn:1,bloomedTurn:0,collabbedTurn:0,returnSlot:null,modifiers:[],skipUnrestTurn:0});
const player=(name,oshi)=>({name,oshi:instance(oshi),ready:true,setupDone:true,turnsTaken:2,mainDeck:Array.from({length:4},()=>instance('hBP09-064')),cheerDeck:[],hand:[],life:[],holoPower:[],archive:[],removed:[],zones:{center:unit('hBP09-064'),collab:null,back1:null,back2:null,back3:null,back4:null,back5:null},collabTurn:0,batonTurn:0,limitedTurn:0,limitedUsesCount:0,limitedAllowanceTurn:0,limitedAllowance:1,oshiSkillTurn:0,spOshiSkillUsed:false,namedUsageTurns:{},modifiers:[],turnEvents:{turn:3,supports:[],arts:[],bloomCount:0,cheerArchived:0,deckArchived:0,stageReturned:0}});

function check(existingCollab){
  const own=player('Subaru','hBP09-001'),opponent=player('Opponent Subaru','hBP09-001');
  own.zones.back1=unit('hBP09-050');opponent.zones.back1=unit('hBP09-050');opponent.zones.back2=unit('hBP09-064');
  if(existingCollab)opponent.zones.collab=unit('hBP09-064');
  let state={status:'playing',phase:'main',turn:3,activePlayer:0,firstPlayer:1,players:[own,opponent],effectQueue:[],pendingChoice:null,log:[],knockouts:[],lifeLosses:[]};
  state=applyAction(state,0,{type:'collab',zone:'back1'},cards,()=>0.25);
  if(state.pendingChoice?.type!=='stageTarget'||state.pendingChoice.targetPlayerIndex!==1||!state.pendingChoice.options.includes('back1'))throw new Error('Source Collab Effect did not offer the opposing Back target.');
  state=applyAction(state,0,{type:'choose',zone:'back1'},cards,()=>0.25);
  if(state.pendingChoice)throw new Error('The moved opponent hBP09-050 incorrectly activated its own Collab Effect.');
  if(state.players[1].zones.collab.stack.at(-1).number!=='hBP09-050')throw new Error('The selected Back Holomem did not move into Collab.');
  if(state.players[1].collabTurn!==0||state.players[1].zones.collab.collabbedTurn!==0)throw new Error('A movement effect incorrectly counted as the opponent Collab action.');
  if(state.players[1].zones.back2.stack.at(-1).number!=='hBP09-064')throw new Error('The untouched second Back Holomem changed.');
  return {result:existingCollab?'swapped with existing collab':'moved into empty collab',enemyCollab:'hBP09-050',enemyBack:state.players[1].zones.back1?.stack.at(-1).number??null,enemyCollabTurn:state.players[1].collabTurn,pendingChoice:state.pendingChoice};
}

function checkNoTarget(){
  const own=player('Subaru','hBP09-001'),opponent=player('Opponent','hBP09-001');
  own.zones.back1=unit('hBP09-050');
  let state={status:'playing',phase:'main',turn:3,activePlayer:0,firstPlayer:1,players:[own,opponent],effectQueue:[],pendingChoice:null,log:[],knockouts:[],lifeLosses:[]};
  state=applyAction(state,0,{type:'collab',zone:'back1'},cards,()=>0.25);
  if(state.pendingChoice)throw new Error('The Collab Effect created a target prompt even though the opponent has no Back Holomem.');
  if(state.players[1].zones.collab)throw new Error('The impossible target instruction changed the opponent Collab position.');
  return {result:'no opposing Back Holomem skips the impossible choice',pendingChoice:null};
}

function checkMovementState(){
  const own=player('Subaru','hBP09-001'),opponent=player('Opponent','hBP09-001');
  own.zones.back1=unit('hBP09-050');opponent.zones.back1=unit('hBP09-050');opponent.zones.back2=unit('hBP09-064');opponent.zones.collab=unit('hBP09-064');
  const selected=opponent.zones.back1;
  Object.assign(selected,{cheer:[instance('hY01-001')],attachments:[instance('hBP01-114')],damage:40,rested:true,modifiers:[{kind:'arts',amount:20,expiresTurn:9}]});
  const selectedState={stack:selected.stack,cheer:selected.cheer,attachments:selected.attachments,damage:selected.damage,rested:selected.rested,modifiers:selected.modifiers};
  const old=opponent.zones.collab;
  const oldState={stack:old.stack,cheer:old.cheer,attachments:old.attachments,damage:old.damage,rested:old.rested,modifiers:old.modifiers};
  let state={status:'playing',phase:'main',turn:3,activePlayer:0,firstPlayer:1,players:[own,opponent],effectQueue:[],pendingChoice:null,log:[],knockouts:[],lifeLosses:[]};
  state=applyAction(state,0,{type:'collab',zone:'back1'},cards,()=>0.25);
  state=applyAction(state,0,{type:'choose',zone:'back1'},cards,()=>0.25);
  const moved=state.players[1].zones.collab;
  if(JSON.stringify({stack:moved.stack,cheer:moved.cheer,attachments:moved.attachments,damage:moved.damage,rested:moved.rested,modifiers:moved.modifiers})!==JSON.stringify(selectedState))throw new Error('Moving the selected Holomem did not preserve its state and attached cards.');
  const swapped=state.players[1].zones.back1;
  if(JSON.stringify({stack:swapped.stack,cheer:swapped.cheer,attachments:swapped.attachments,damage:swapped.damage,rested:swapped.rested,modifiers:swapped.modifiers})!==JSON.stringify(oldState))throw new Error('The displaced Collab Holomem did not preserve its state and attached cards.');
  return {result:'both swapped Holomem units retain cards, damage, rest state and modifiers'};
}

function checkCardMetadataAndOshis(){
  const card=map.get('hBP09-050');
  if(card?.jpName!=='ハコス・ベールズ'||card.stage!=='2nd'||card.hp!==200||card.baton!==2||JSON.stringify(card.variants?.map(v=>v.rarity))!==JSON.stringify(['RR','SR','UR']))throw new Error('Current catalog identity, stats or printing variants differ from the official card pages.');
  if(card.keyword?.effect!=='自分の推しホロメンが〈大空スバル〉なら、相手のバックホロメン1人を選ぶ。選んだホロメンと相手のコラボホロメンを交代させる。相手のコラボホロメンがいないなら、かわりに、選んだホロメンをコラボポジションに移動させる。')throw new Error('Current catalog Collab Effect text differs from official Japanese text.');
  for(const sourceOshi of ['hBP09-001','hBP04-006','hBD24-056','hSD19-001']){
    const own=player('Subaru',sourceOshi),opponent=player('Opponent','hBP09-001');
    own.zones.back1=unit('hBP09-050');opponent.zones.back1=unit('hBP09-064');
    let state={status:'playing',phase:'main',turn:3,activePlayer:0,firstPlayer:1,players:[own,opponent],effectQueue:[],pendingChoice:null,log:[],knockouts:[],lifeLosses:[]};
    state=applyAction(state,0,{type:'collab',zone:'back1'},cards,()=>0.25);
    if(state.pendingChoice?.type!=='stageTarget')throw new Error(`${sourceOshi} did not satisfy the Subaru Oshi name condition.`);
  }
  return {result:'official metadata and all four supported Subaru Oshi printings match current catalog behavior'};
}

try{
  for(const number of ['hBP09-001','hBP09-050','hBP09-064'])if(!map.has(number))throw new Error(`Current catalog is missing ${number}`);
  const own=player('Other Oshi','hBP09-005'),opponent=player('Opponent Subaru','hBP09-001');
  own.zones.back1=unit('hBP09-050');opponent.zones.back1=unit('hBP09-050');opponent.zones.back2=unit('hBP09-064');
  let noTrigger={status:'playing',phase:'main',turn:3,activePlayer:0,firstPlayer:1,players:[own,opponent],effectQueue:[],pendingChoice:null,log:[],knockouts:[],lifeLosses:[]};
  noTrigger=applyAction(noTrigger,0,{type:'collab',zone:'back1'},cards,()=>0.25);
  if(noTrigger.pendingChoice)throw new Error('hBP09-050 triggered when the acting Oshi was not Subaru.');
  const cases=[check(true),check(false),checkMovementState(),checkNoTarget(),checkCardMetadataAndOshis(),{result:'non-Subaru Oshi does not trigger hBP09-050',sourceCollab:noTrigger.players[0].zones.collab.stack.at(-1).number,enemyBack:noTrigger.players[1].zones.back1.stack.at(-1).number,pendingChoice:noTrigger.pendingChoice}];
  status.textContent='PASS: Q725 movement does not activate the moved Holomem’s Collab Effect; both position branches preserve card state and no-target resolution is safe.';
  output.textContent=JSON.stringify({pass:true,cases},null,2);
}catch(error){
  status.textContent=`FAIL: ${error instanceof Error?error.message:String(error)}`;
  output.textContent=JSON.stringify({pass:false,error:String(error)},null,2);
}
