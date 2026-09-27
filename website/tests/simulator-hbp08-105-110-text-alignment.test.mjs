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
runtimes.forEach(runtime=>runtime.pool=[...runtime.cards,dummy,oshi]);

function knockOutWithFans(runtime,{holder, fan, cheers, otherFans = []}) {
  let s = state();
  s.players[1].zones.back1 = unit(holder, {damage: 10000, attachments: [inst(fan, `${fan}-1`), ...otherFans.map((number, index) => inst(number, `${number}-${index + 1}`))], cheer: cheers});
  s.players[1].zones.back2 = unit('AUDIT-DUMMY');
  s.players[1].zones.back3 = unit('AUDIT-DUMMY');
  s.effectQueue = [{type:'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone:'back1',sourceZone:'center',amount:10,loseLife:false,sourceName:'batch108 test'}];
  return runtime.applyAction(s,0,attack,runtime.pool,()=>0);
}

for(const runtime of runtimes){
const irys = runtime.cards.find(card => card.jpName === 'IRyS' && card.stage === 'Debut').number;
const fuwawa = runtime.cards.find(card => card.jpName === 'フワワ・アビスガード' && card.stage === 'Debut').number;
const rui = runtime.cards.find(card => card.jpName === '鷹嶺ルイ' && card.stage === 'Debut').number;

test(`${runtime.name}: hBP08-105 adds HP and gates its IRyS Arts bonus on both Cheer colors`,()=>{
  const printedIrys=runtime.cards.find(card=>card.jpName==='IRyS'&&card.stage==='Debut');
  const artsIrys={...printedIrys,number:'B108-IRYS-ARTS-PROBE',arts:[{name:'Alignment probe',damage:100,cost:[],effect:''}]};
  for(const [cheers,expected] of [[['hY01-001','hY05-001'],120],[['hY01-001'],100]]){
    let s=state(artsIrys.number);
    s.players[0].zones.center.attachments=[inst('hBP08-105','mascot')];
    s.players[0].zones.center.cheer=cheers.map((number,index)=>inst(number,`color${index}`));
    s=runtime.applyAction(s,0,attack,[...runtime.pool,artsIrys],()=>0);
    assert.equal(s.players[1].zones.center.damage,expected);
  }
  const hpIrys={...printedIrys,number:'B108-IRYS-HP-PROBE'};
  const probe={...dummy,number:'B108-HP-ATTACK',arts:[{name:'HP probe',damage:Number(printedIrys.hp)+10,cost:[],effect:''}]};
  for(const attached of [false,true]){
    let s=state(probe.number,hpIrys.number);
    if(attached)s.players[1].zones.center.attachments=[inst('hBP08-105','mascot')];
    s=runtime.applyAction(s,0,attack,[...runtime.pool,hpIrys,probe],()=>0);
    assert.equal(s.knockouts.some(entry=>entry.cardNumber===hpIrys.number),!attached);
  }
});

test(`${runtime.name}: hBP08-107 grants Arts+10 and resolves state choice from hand and archive`,()=>{
  const printedCecilia=runtime.cards.find(card=>card.jpName==='セシリア・イマーグリーン'&&card.stage==='Debut');
  const cecilia={...printedCecilia,number:'B108-CECILIA-PROBE',arts:[{name:'Alignment probe',damage:100,cost:[],effect:''}]};
  let s=state(cecilia.number);
  s.players[0].zones.center.attachments=[inst('hBP08-107','otomo')];
  s=runtime.applyAction(s,0,attack,[...runtime.pool,cecilia],()=>0);
  assert.equal(s.players[1].zones.center.damage,110);

  for(const source of ['hand','archive']){
    s=state(printedCecilia.number);s.phase='main';
    s.players[0].zones.center.rested=true;
    if(source==='hand'){
      s.players[0].hand=[inst('hBP08-107','otomo-hand')];
      s=runtime.applyAction(s,0,{type:'play',cardId:'otomo-hand'},runtime.pool,()=>0);
      s=runtime.applyAction(s,0,{type:'choose',zone:'center'},runtime.pool,()=>0);
      s=runtime.applyAction(s,0,{type:'choose',optionId:'active'},runtime.pool,()=>0);
      assert.equal(s.players[0].zones.center.rested,false);
    }else{
      s.players[0].archive=[inst('hBP08-107','otomo-archive')];
      s.pendingChoice={type:'attachArchivedSupport',playerIndex:0,cardId:'otomo-archive',options:['center'],optional:false};
      s=runtime.applyAction(s,0,{type:'choose',zone:'center'},runtime.pool,()=>0);
      assert.equal(s.pendingChoice.effect,'otomoState');
      s=runtime.applyAction(s,0,{type:'choose',optionId:'active'},runtime.pool,()=>0);
      assert.equal(s.players[0].zones.center.rested,false);
    }
  }
});

test(`${runtime.name}: hBP08-106 triggers once for each attached GuyRyS`,()=>{
  let s=knockOutWithFans(runtime,{holder:irys,fan:'hBP08-106',otherFans:['hBP08-106'],cheers:[inst('hY03-001','red'),inst('hY05-001','purple')]});
  assert.equal(s.pendingChoice?.effect,'koTransferCheer');
  assert.equal(s.pendingChoice?.optional,false);
  s=runtime.applyAction(s,1,{type:'choose',cardIds:['red']},runtime.pool,()=>0);
  s=runtime.applyAction(s,1,{type:'choose',zone:'back2'},runtime.pool,()=>0);
  assert.equal(s.pendingChoice?.effect,'koTransferCheer','the second copy must resolve independently');
  assert.deepEqual(s.pendingChoice.selectableIds,['purple'],'the next copy must not offer Cheer already transferred by the first');
  s=runtime.applyAction(s,1,{type:'choose',cardIds:['purple']},runtime.pool,()=>0);
  s=runtime.applyAction(s,1,{type:'choose',zone:'back3'},runtime.pool,()=>0);
  assert.deepEqual(s.players[1].zones.back2.cheer.map(card=>card.id),['red']);
  assert.deepEqual(s.players[1].zones.back3.cheer.map(card=>card.id),['purple']);
});

test(`${runtime.name}: hBP08-108 draws once per attached Ruffians when red Cheer is present`,()=>{
  const s=knockOutWithFans(runtime,{holder:fuwawa,fan:'hBP08-108',otherFans:['hBP08-108'],cheers:[inst('hY03-001','red')]});
  assert.equal(s.players[1].hand.length,2);
});

test(`${runtime.name}: hBP08-108 HP bonus protects Fuwawa above printed HP`,()=>{
  const printedFuwawa=runtime.cards.find(card=>card.jpName==='フワワ・アビスガード'&&card.stage==='Debut');
  const holder={...printedFuwawa,number:'B108-FUWAWA-HP-PROBE'};
  const probe={...dummy,number:'B108-RUFFIANS-HP-ATTACK',arts:[{name:'HP probe',damage:Number(printedFuwawa.hp)+5,cost:[],effect:''}]};
  let s=state(probe.number,holder.number);
  s.players[1].zones.center.attachments=[inst('hBP08-108','ruffians')];
  s=runtime.applyAction(s,0,attack,[...runtime.pool,holder,probe],()=>0);
  assert.equal(Boolean(s.players[1].zones.center.downPending),false);
});

test(`${runtime.name}: hBP08-109 grants Rui Arts+10`,()=>{
  const printedRui=runtime.cards.find(card=>card.jpName==='鷹嶺ルイ'&&card.stage==='Debut');
  const holder={...printedRui,number:'B108-RUI-ARTS-PROBE',arts:[{name:'Alignment probe',damage:100,cost:[],effect:''}]};
  let s=state(holder.number);
  s.players[0].zones.center.attachments=[inst('hBP08-109','rui-fan')];
  s=runtime.applyAction(s,0,attack,[...runtime.pool,holder],()=>0);
  assert.equal(s.players[1].zones.center.damage,110);
});

test(`${runtime.name}: hBP08-110 grants Arts+10`,()=>{
  const printedIna=runtime.cards.find(card=>card.jpName==='一伊那尓栖'&&card.stage==='Debut');
  const holder={...printedIna,number:'B108-INA-ARTS-PROBE',arts:[{name:'Alignment probe',damage:100,cost:[],effect:''}]};
  let s=state(holder.number);
  s.players[0].zones.center.attachments=[inst('hBP08-110','takodachi')];
  s=runtime.applyAction(s,0,attack,[...runtime.pool,holder],()=>0);
  assert.equal(s.players[1].zones.center.damage,110);
});

test(`${runtime.name}: hBP08-110 gives opposing Center/Collab all colors only from Center`,()=>{
  const printedIna=runtime.cards.find(card=>card.jpName==='一伊那尓栖'&&card.stage==='Debut');
  const attacker={...printedIna,number:'B108-INA-COLOR-PROBE',arts:[{name:'Color probe',damage:100,cost:[],effect:'',specialTargets:['紫'],specialValues:[50]}]};
  for(const holderZone of ['center','collab'])for(const targetZone of ['center','collab']){
    let s=state(attacker.number);s.players[0].zones.collab=unit('AUDIT-DUMMY');
    s.players[0].zones[holderZone].attachments=[inst('hBP08-110','color-takodachi')];
    s.players[1].zones.collab=unit('AUDIT-DUMMY');
    s=runtime.applyAction(s,0,{...attack,targetZone},[...runtime.pool,attacker],()=>0);
    assert.equal(s.players[1].zones[targetZone].damage,holderZone==='center'?160:100);
  }
});

test(`${runtime.name}: hBP08-109 permits a separate Cheer transfer for each Rui friend fan`,()=>{
  let s=knockOutWithFans(runtime,{holder:rui,fan:'hBP08-109',otherFans:['hBP08-109'],cheers:[inst('hY03-001','red'),inst('hY05-001','purple')]});
  assert.equal(s.pendingChoice?.effect,'koTransferCheer');
  assert.equal(s.pendingChoice?.optional,true);
  s=runtime.applyAction(s,1,{type:'choose',cardIds:['red']},runtime.pool,()=>0);
  s=runtime.applyAction(s,1,{type:'choose',zone:'back2'},runtime.pool,()=>0);
  assert.equal(s.pendingChoice?.effect,'koTransferCheer','the second copy must resolve independently');
  assert.deepEqual(s.pendingChoice.selectableIds,['purple'],'the next copy must not offer Cheer already transferred by the first');
  s=runtime.applyAction(s,1,{type:'choose',cardIds:['purple']},runtime.pool,()=>0);
  s=runtime.applyAction(s,1,{type:'choose',zone:'back3'},runtime.pool,()=>0);
  assert.deepEqual(s.players[1].zones.back2.cheer.map(card=>card.id),['red']);
  assert.deepEqual(s.players[1].zones.back3.cheer.map(card=>card.id),['purple']);
});
}
