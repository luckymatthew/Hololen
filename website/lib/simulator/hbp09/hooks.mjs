import {createRuntime,SLOTS,top} from './runtime.mjs';
import {program,S,R,F,O,count,yes,own,atleast,draw,buff,pick,target,move,search,recover,topCheer,special,fixedDamage,heal,cost,once,tools,sake,stage,archiveCheer,deploy} from './programs.mjs';
export const isHbp09=n=>/^hBP09-\d{3}$/.test(String(n));
const code=n=>Number(String(n).slice(-3));
const assert=(ok,msg)=>{if(!ok)throw new Error(`hBP09: ${msg}`);};
export function createHbp09(host) {
  let rt;
  const metadata=(u,map)=>map.get(top(u)?.number);
  const named=(u,name,map)=>!!u&&host.cardHasName(metadata(u,map),name);
  const entries=p=>SLOTS.flatMap(zone=>p?.zones?.[zone]?[{zone,unit:p.zones[zone]}]:[]);
  const has=(u,predicate,map)=>(u?.attachments||[]).some(r=>predicate(map.get(r.number)));
  const arms=(card,map)=>!!card&&host.cardHasTag(card,"#カエラ'sアームズ")&&card.typeCode==='supportTool';
  const countSake=(p,map)=>p.archive.filter(r=>rt.cardMatches(map.get(r.number),sake,{players:[p,p]},{playerIndex:0},map)).length;
  function enqueue(state,i,number,event,zone='',data={}) {
    const steps=program(number,event);if(!steps)return false;
    const c=rt.context(state,i,number,zone,{event,...data});rt.enqueue(state,c,steps);return true;
  }
  function customOp(state,c,o,steps,map,random) {
    const p=state.players[c.playerIndex];const source=rt.sourceUnit(state,c);
    if(o.op==='commitSupport'){
      const instance=p.hand.find(x=>x.id===c.cardId);assert(instance&&instance.number===c.sourceNumber,'Support no longer in hand');
      host.commitSupport(state,c.playerIndex,instance,map.get(instance.number));
      if(c.sourceNumber==='hBP09-095')p.namedUsageTurns['hbp09:toast']=state.turn;
      return true;
    }
    if(o.op==='sameLevelSubaru'){
      const ref=c.vars.opponentLevel?.[0];if(!ref)return true;
      const level=map.get(ref.number)?.stage;
      steps.unshift(...deploy({group:'holomem',names:['大空スバル'],stages:[level]}));return true;
    }
    if(o.op==='hajimeX'){
      const options=Array.from({length:p.holoPower.length+1},(_,i)=>({id:String(i),label:`支付 ${i} Holo Power`}));
      steps.unshift({op:'chooseOption',key:'hajimePaid',options,then:[{op:'payHajime'}]});return true;
    }
    if(o.op==='payHajime'){
      const amount=Number(c.vars.hajimePaid);assert(Number.isInteger(amount)&&amount>=0&&amount<=p.holoPower.length,'Invalid X payment');
      assert(named(p.zones.center,'轟はじめ',map),'X skill requires center Hajime');
      assert(p.oshiSkillTurn!==state.turn,'Oshi already used this turn');
      if(amount)p.archive.push(...p.holoPower.splice(-amount).reverse());p.oshiSkillTurn=state.turn;
      host.addStageModifier(p.zones.center,'arts',amount*10,state.turn,c.sourceNumber);
      if(amount>=7)for(const {unit}of entries(p))if(named(unit,'轟はじめ',map))host.addStageModifier(unit,'arts',100,state.turn,c.sourceNumber);
      host.queueGiftOshiSkillEffects(state,c.playerIndex,map.get(p.oshi.number).oshiSkill,'oshi',map);
      host.appendLog(state,`hBP09-002 支付 ${amount} Holo Power，中心 +${amount*10}${amount>=7?'，全體轟はじめ再 +100':''}。`);return true;
    }
    if(o.op==='reactiveOnly')throw new Error('hBP09-005 activates only at the performance-end window');
    if(o.op==='colorMatchedCheer'){
      const ref=c.vars.azki?.[0];if(!ref)return true;
      const colors=map.get(ref.number)?.colors||[];
      steps.unshift(pick({area:'cheerDeck',rule:{colors}},'matchingCheer',[{op:'attach',cards:R('matchingCheer'),target:R('azki')}],0,1,{search:true}),{op:'shuffle',area:'cheerDeck'});return true;
    }
    if(o.op==='archiveTopPower'){
      const n=Number(o.amount);assert(Number.isInteger(n)&&n>=0&&p.holoPower.length>=n,'Holo Power payment unavailable');
      if(n)p.archive.push(...p.holoPower.splice(-n).reverse());return true;
    }
    if(o.op==='distinctArchiveCheer'){
      const zones=entries(p).filter(x=>rt.cardMatches(metadata(x.unit,map),o.rule,state,c,map)).length;
      const max=Math.min(Number(o.max),zones,p.archive.filter(r=>map.get(r.number)?.group==='cheer').length);
      if(!max)return true;c.vars.distinctTargets=[];
      steps.unshift(pick({area:'archive',rule:{group:'cheer'}},'distinctCheer',[
        {op:'forEach',items:R('distinctCheer'),key:'distinctItem',then:[{op:'distinctRecipient',rule:o.rule}]}
      ],1,max));return true;
    }
    if(o.op==='distinctRecipient'){
      const excluded=new Set((c.vars.distinctTargets||[]).map(r=>r.id));
      const candidates=rt.refs(state,c,{area:'stage',rule:o.rule},map).filter(r=>!excluded.has(r.id));
      if(!candidates.length)return true;
      steps.unshift({op:'chooseUnit',from:{zones:candidates.map(r=>r.zone),rule:o.rule},key:'distinctRecipient',then:[{op:'attach',cards:R('distinctItem'),target:R('distinctRecipient')},{op:'rememberRecipient'}]});return true;
    }
    if(o.op==='rememberRecipient'){c.vars.distinctTargets.push(...c.vars.distinctRecipient);return true;}
    if(o.op==='towaReactivePay'){
      assert(state.phase==='performance'&&state.activePlayer===c.playerIndex&&p.oshiSkillTurn!==state.turn&&p.holoPower.length>=2,'Towa reactive skill is not available');
      p.archive.push(...p.holoPower.splice(-2).reverse());p.oshiSkillTurn=state.turn;
      host.drawCards(state,c.playerIndex,rt.value(state,c,F('singingArtsCount'),map));
      host.queueGiftOshiSkillEffects(state,c.playerIndex,map.get(p.oshi.number).oshiSkill,'oshi',map);return true;
    }
    if(o.op==='makeup'){
      const candidates=entries(p).filter(({unit})=>unit.bloomedTurn===state.turn&&host.cardHasTag(metadata(unit,map),'#FLOW GLOW')&&p.hand.some(r=>legalMakeup(unit,map.get(r.number),map,state.turn)));
      if(candidates.length)steps.unshift({op:'chooseUnit',from:{zones:candidates.map(x=>x.zone)},key:'makeupTarget',optional:true,then:[{op:'makeupCard'}]});return true;
    }
    if(o.op==='makeupCard'){
      const ref=c.vars.makeupTarget?.[0];const located=ref&&rt.locate(state,ref);if(!located?.unit)return true;
      c.vars.makeupEligible=p.hand.filter(r=>legalMakeup(located.unit,map.get(r.number),map,state.turn)).map(r=>({...r,owner:c.playerIndex,area:'hand'}));
      steps.unshift(pick(R('makeupEligible'),'makeupCard',[{op:'performMakeup'}],1,1,{optional:true}));return true;
    }
    if(o.op==='performMakeup'){
      const t=c.vars.makeupTarget?.[0],ref=c.vars.makeupCard?.[0];const l=t&&rt.locate(state,t);if(!ref||!l?.unit)return true;
      const card=map.get(ref.number);assert(legalMakeup(l.unit,card,map,state.turn),'Selected extra Bloom became illegal');
      const index=p.hand.findIndex(r=>r.id===ref.id);assert(index>=0,'Bloom card left the hand');
      l.unit.stack.push(p.hand.splice(index,1)[0]);l.unit.bloomedTurn=state.turn;
      host.currentTurnEvents(p,state.turn).bloomCount+=1;
      host.queueBloomEffects(state,c.playerIndex,l.zone,card,map,random);
      host.queueAttachmentBloomEffects(state,c.playerIndex,l.zone,map);
      host.appendLog(state,'hBP09-109：使用手牌完成額外 Bloom。',[ref]);return true;
    }
    if(o.op==='subaruReturnCheer'){
      const other=1-c.playerIndex,opponent=state.players[other],u=opponent.zones.center;
      if(!u?.cheer.length)return true;
      const ownerContext=rt.context(state,other,c.sourceNumber,'center');
      const programSteps=[pick({area:'cheer',sourceOnly:true},'orderedCheer',[move(R('orderedCheer'),'cheerDeck')],u.cheer.length,u.cheer.length)];
      rt.enqueue(state,ownerContext,programSteps);return true;
    }
    if(o.op==='zetaDown'){
      const a=host.rollDie(random,state,c.playerIndex,1,map.get(c.sourceNumber));
      const b=host.rollDie(random,state,c.playerIndex,1,map.get(c.sourceNumber));
      if(a+b===state.players[0].life.length+state.players[1].life.length)host.queueExtraLifeLoss(state,1-c.playerIndex,c.playerIndex,map,c.sourceNumber);return true;
    }
    if(o.op==='gainPowerOne'){if(p.mainDeck.length)p.holoPower.push(p.mainDeck.shift());return true;}
    return false;
  }
  rt=createRuntime({...host,customOp});
  function legalMakeup(u,card,map,turn){
    const current=metadata(u,map);return !!card&&card.group==='holomem'&&host.cardHasTag(current,'#FLOW GLOW')&&u.bloomedTurn===turn&&u.enteredTurn!==turn&&host.talentMatches(current,card)&&((card.stage==='1st'&&['Debut','1st'].includes(current.stage))||(card.stage==='2nd'&&['1st','2nd'].includes(current.stage)))&&Number(card.hp)>Number(u.damage||0);
  }
  function support(state,i,instance,card,map){
    if(!isHbp09(card.number)||code(card.number)<90||code(card.number)>105)return false;
    const p=state.players[i],q=state.players[1-i],c=rt.context(state,i,card.number,'',{cardId:instance.id,event:'support'});
    const os=name=>host.cardHasName(map.get(p.oshi.number),name);
    const down=rt.value(state,c,F('previousDowns'),map)>0;
    const checks={90:p.holoPower.length>0,91:(os('AZKi')||os('風真いろは'))&&down,92:os('綺々羅々ヴィヴィ'),94:os('大空スバル')&&down,95:os('雪花ラミィ')&&p.namedUsageTurns?.['hbp09:toast']!==state.turn,99:os('大空スバル')&&entries(p).reduce((n,x)=>n+x.unit.cheer.length,0)<entries(q).reduce((n,x)=>n+x.unit.cheer.length,0),101:os('常闇トワ'),102:os('轟はじめ'),103:os('白銀ノエル'),105:['大空スバル','白銀ノエル','雪花ラミィ'].some(os)};
    assert(checks[code(card.number)]!==false,'The printed play requirement is not satisfied');
    rt.enqueue(state,c,program(card.number,'support'));return true;
  }
  function keyword(state,i,zone,card,map){if(!isHbp09(card?.number))return false;enqueue(state,i,card.number,'keyword',zone);return true;}
  function arts(state,i,zone,index,targetZone,map,random,card){
    const p=state.players[i],q=state.players[1-i],u=p.zones[zone],n=code(card.number),c=rt.context(state,i,card.number,zone,{event:`art${index}`,targetZone});
    const os=name=>host.cardHasName(map.get(p.oshi.number),name);
    const stageName=name=>entries(p).filter(x=>named(x.unit,name,map)).length;
    const archName=name=>p.archive.filter(r=>host.cardHasName(map.get(r.number),name)).length;
    const previous=rt.value(state,c,F('previousDowns'),map);let bonus=0;
    if(n===12&&previous)bonus+=50;if(n===14)bonus+=40*previous;
    if([15,19,21].includes(n)&&p.batonTurn===state.turn&&(n!==19||zone==='center'))bonus+=n===21?80:20;
    if(n===18&&zone==='collab')bonus+=20;
    if(n===22&&p.holoPower.length>=4)bonus+=50;
    if(n===23&&zone==='center'&&p.oshiSkillTurn===state.turn&&map.get(p.oshi.number)?.oshiSkill?.name==='Good Luck, holoh3ro!')bonus+=80;
    if(n===24&&zone==='center'&&['虎金妃笑虎','水宮枢','輪堂千速','綺々羅々ヴィヴィ'].every(name=>stageName(name)>0))bonus+=100;
    if(n===30)bonus+=10*archName('牛丼');
    if(n===31&&os('白銀ノエル')&&host.stageRemainingHp(p,zone,map)>=200)bonus+=200;
    if(n===36&&named(p.zones.center,'AZKi',map))bonus+=20*p.zones.center.cheer.length;
    if(n===37&&os('輪堂千速'))bonus+=30*entries(p).filter(x=>metadata(x.unit,map)?.stage!=='Debut').length;
    if(n===41&&entries(p).some(x=>(host.cardIsBuzz(metadata(x.unit,map))||metadata(x.unit,map)?.stage==='2nd')&&has(x.unit,arms,map)))bonus+=20;
    if(n===44&&has(u,arms,map))bonus+=60;
    if(n===47&&stageName('大空スバル'))bonus+=20;
    if(n===50)bonus+=20*stageName('大空スバル');
    if(n===64&&q.hand.length>=4)bonus+=20;
    if(n===70)bonus+=q.hand.length>=10?100:q.hand.length>=7?70:0;
    if(n===72&&p.hbp09ArchiveBloomTurn===state.turn)bonus+=30;
    if(n===74&&(['1st','2nd'].includes(metadata(q.zones[targetZone],map)?.stage)||q.zones[targetZone]?.hbp09Stage?.expiresTurn===state.turn))bonus+=50;
    if(n===83){const die=host.rollDie(random,state,i,1,card);bonus+=die===6?100:die===1?-100:0;}
    if(n===87&&p.archive.filter(r=>/limited/i.test(map.get(r.number)?.typeCode||'')).length>=5)bonus+=60;
    const steps=program(card.number,`art${index}`);if(steps)rt.enqueue(state,c,steps);
    return bonus;
  }
  function artCost(cost,u,art,state,p,zone,map){
    const card=metadata(u,map),n=code(card?.number);let result=[...cost];const remove=(col,num)=>{for(let j=0;j<num;j++){const k=result.indexOf(col);if(k<0)break;result.splice(k,1);}};
    if(p.oshi?.number==='hBP09-001'&&named(u,'大空スバル',map))remove('白',1);
    if(n===41&&isHbp09(card.number)&&has(u,arms,map))remove('紅',1);
    if(card?.number==='hBP09-049'&&host.cardHasName(map.get(p.oshi.number),'大空スバル'))remove('無色',3);
    if(card?.number==='hBP09-070'&&zone==='center'&&state.players[1-state.players.indexOf(p)].hand.length>=7)remove('無色',2);
    if(card?.number==='hBP09-081'&&countSake(p,map)<=1)result.push('無色');
    if(card?.number==='hBP09-083'&&countSake(p,map)<=4)result.push('無色','無色');
    if(zone==='collab'&&metadata(p.zones.center,map)?.number==='hBP09-024'&&host.cardHasTag(card,'#FLOW GLOW'))result=result.map(()=>'無色');
    return result;
  }
  function hpBonus(u,map,p){let n=0;const card=metadata(u,map);if(card?.number==='hBP09-025'&&map.get(p?.oshi?.number)?.stageSkill)n+=20;
    if(named(u,'カエラ・コヴァルスキア',map)&&(host.cardIsBuzz(card)||card?.stage==='2nd'))n+=40*(u.attachments||[]).filter(a=>a.number==='hBP09-106').length;return n;}
  function artsPassive(state,i,zone,map){const p=state.players[i],u=p.zones[zone],card=metadata(u,map);let n=0;
    if(p.oshi?.number==='hBP09-007'&&named(u,'雪花ラミィ',map))n+=countSake(p,map)>=5?50:20;
    for(const a of u?.attachments||[]){
      if(a.number==='hBP09-107'&&named(u,'カエラ・コヴァルスキア',map)&&(host.cardIsBuzz(card)||card?.stage==='2nd'))n+=40;
      if(a.number==='hBP09-108'&&named(u,'常闇トワ',map))n+=20;
      if(a.number==='hBP09-109'&&named(u,'綺々羅々ヴィヴィ',map))n+=20;
    }return n;
  }
  function defense(state,i,zone,sourceI,sourceZone,kind,map){let adjustment=0;const p=state.players[i],q=state.players[sourceI],u=p.zones[zone],card=metadata(u,map),attacker=metadata(q?.zones[sourceZone],map);
    if(kind!=='arts')return adjustment;
    if(card?.number==='hBP09-017')adjustment-=30;
    if(card?.number==='hBP09-027'&&!u.damage&&attacker?.stage==='1st')adjustment-=50;
    if(card?.number==='hBP09-069'&&q.hand.length>=7)adjustment-=50;
    if(metadata(p.zones.center,map)?.number==='hBP09-073'&&p.holoPower.length>=2&&named(u,'ネリッサ・レイヴンクロフト',map))adjustment-=30;
    if(named(u,'大空スバル',map)&&attacker?.stage==='1st'&&(p.modifiers||[]).some(m=>m.kind==='hbp09SubaruFirstReduction'&&m.expiresTurn>=state.turn))adjustment-=100;
    return adjustment;
  }
  function immuneDamage(state,i,zone,damage,map){const p=state.players[i];return metadata(p.zones[zone],map)?.number==='hBP09-088'&&host.cardHasName(map.get(p.oshi?.number),'桃鈴ねね')&&damage>=200?0:damage;}
  function beforeAttack(state,i,action,map){const p=state.players[i],u=p.zones[action.sourceZone];const restriction=u?.hbp09DifferentArt;
    if(restriction?.turn===state.turn&&restriction.awaiting){const name=metadata(u,map)?.arts?.[Number(action.artIndex)]?.name;assert(name&&name!==restriction.name,'Extra Towa attack must have a DIFFERENT Arts name');}
  }
  function afterAttack(state,i,action,map){const p=state.players[i],u=p.zones[action.sourceZone];if(!u)return;
    if(u.hbp09DifferentArt?.turn===state.turn&&u.hbp09DifferentArt.awaiting){u.hbp09DifferentArt.awaiting=false;return;}
    if(p.oshi?.number==='hBP09-005'&&action.sourceZone==='center'&&named(u,'常闇トワ',map)){
      const c=rt.context(state,i,'hBP09-005',action.sourceZone);if(rt.once(state,c,'towa-extra')){u.rested=false;u.hbp09DifferentArt={turn:state.turn,awaiting:true,name:metadata(u,map)?.arts?.[Number(action.artIndex)]?.name};}
    }
  }
  function canBack(state,i,source,targetZone,targetCard,map){const p=state.players[i];return p.hbp09TowaBackTurn===state.turn&&named(source,'常闇トワ',map)&&(p.turnEvents?.turn===state.turn?p.turnEvents.arts.length:0)===2&&targetZone.startsWith('back')&&targetCard?.stage!=='Debut';}
  function onBaton(state,i,outgoing,map){const p=state.players[i];if(p.oshi?.number==='hBP09-002'&&host.cardHasName(outgoing,'轟はじめ')){const c=rt.context(state,i,'hBP09-002');if(rt.once(state,c,'hajime-baton'))rt.enqueue(state,c,[{op:'powerTop',amount:1}]);}}
  function onOshi(state,i,map){const p=state.players[i];if(metadata(p.zones.center,map)?.number==='hBP09-075'&&named(p.zones.collab,'ネリッサ・レイヴンクロフト',map))host.addStageModifier(p.zones.collab,'artCost:purple',-1,state.turn,'hBP09-075');}
  function onAttach(state,i,zone,card,map){const p=state.players[i];if(p.oshi?.number==='hBP09-004'&&arms(card)&&named(p.zones[zone],'カエラ・コヴァルスキア',map)){const c=rt.context(state,i,'hBP09-004',zone);if(rt.once(state,c,'kaela-forge'))rt.enqueue(state,c,[draw(2)]);}}
  function onSupport(state,i,card,map){const p=state.players[i];if(p.oshi?.number==='hBP09-003'&&host.cardHasName(card,'牛丼')){const c=rt.context(state,i,'hBP09-003');if(rt.once(state,c,'noel-gyudon'))rt.enqueue(state,c,[topCheer({names:['白銀ノエル']}),yes(atleast(count('stage',{stages:['2nd']}),1),[draw(1)])]);}}
  function onDamaged(state,i,zone,other,damage,kind,map){if(kind!=='arts'||state.activePlayer===i)return;const u=state.players[i].zones[zone],number=top(u)?.number,threshold={'hBP09-008':40,'hBP09-011':100,'hBP09-014':200}[number];if(!threshold||damage<threshold)return;
    const c=rt.context(state,i,number,zone);if(!rt.once(state,c,`${number}:${top(u).id}:damaged`))return;
    rt.enqueue(state,c,number==='hBP09-008'?[fixedDamage(30,['center'])]:number==='hBP09-011'?[draw(2)]:[{op:'subaruReturnCheer'}]);
  }
  function onDown(state,owner,defeated,defeatedCard,map,sourceIndex,options,pendingEffects){
    const p=state.players[owner],q=state.players[sourceIndex],source=q?.zones?.[options.sourceZone],number=top(source)?.number;
    const add=(i,num,zone,steps)=>pendingEffects.push({type:'hbp09Program',playerIndex:i,context:rt.context(state,i,num,zone,{event:'down'}),steps});
    if(sourceIndex!==owner&&source){
      if(number==='hBP09-021')add(sourceIndex,number,options.sourceZone,[{op:'powerTop',amount:1}]);
      if(number==='hBP09-023'&&host.cardHasName(map.get(q.oshi.number),'ベスティア・ゼータ'))add(sourceIndex,number,options.sourceZone,[{op:'zetaDown'}]);
      if(number==='hBP09-037')add(sourceIndex,number,options.sourceZone,[{op:'chooseUnit',from:{area:'stage',back:true,rule:{tags:['#FLOW GLOW']}},key:'returned',optional:true,then:[{op:'returnStage',target:R('returned')}]}]);
      if(number==='hBP09-042')add(sourceIndex,number,options.sourceZone,recover({group:'holomem'}));
      if(number==='hBP09-062'&&entries(q).filter(x=>host.cardHasTag(metadata(x.unit,map),'#ID1期生')).length>=5)add(sourceIndex,number,options.sourceZone,[special(50)]);
    }
    if(state.activePlayer!==owner&&host.cardHasName(defeatedCard,'ムーナ・ホシノヴァ')){
      for(const {zone,unit}of entries(p))if(top(unit)?.number==='hBP09-059'){
        const c=rt.context(state,owner,'hBP09-059',zone);if(rt.once(state,c,'moona-moon-singer'))add(owner,'hBP09-059',zone,[{op:'chooseUnit',from:{back:true,excludeSource:true,rule:{tags:['#ID1期生']}},key:'recipient',then:[{op:'topCheer',target:R('recipient')}]}]);
      }
    }
    if(state.activePlayer!==owner){for(const fan of defeated.attachments||[])if(fan.number==='hBP09-111')pendingEffects.push({type:'koFanTransfer',playerIndex:owner,eligibleIds:defeated.cheer.map(x=>x.id),targetRule:{zones:SLOTS.filter(z=>z!==options.targetZone)},colors:['白','綠','紅','藍','紫','黃','無色'],max:1,label:'Pemaloe'});}
  }
  function artDown(state,effect,map){if(effect.artSourceNumber==='hBP09-076'&&effect.artIndex===0)rt.enqueue(state,rt.context(state,effect.playerIndex,'hBP09-076',effect.sourceZone,{event:'artDown'}),recover({names:['ネリッサ・レイヴンクロフト']}));}
  function endPerformance(state,i,map){
    const p=state.players[i];if(state.phase!=='performance'||p.hbp09EndProcessedTurn===state.turn)return false;
    p.hbp09EndProcessedTurn=state.turn;let added=false;
    const add=(num,zone,steps)=>{rt.enqueue(state,rt.context(state,i,num,zone,{event:'performanceEnd'}),steps);added=true;};
    if(p.oshi?.number==='hBP09-005'&&p.oshiSkillTurn!==state.turn&&p.holoPower.length>=2)add('hBP09-005','',[{op:'chooseOption',key:'towaEnd',options:[{id:'yes',label:'支付2 Holo Power並抽牌'},{id:'no',label:'不發動'}],then:[yes(O('eq',{var:'towaEnd'},'yes'),[{op:'towaReactivePay'}])]}]);
    const centerUnit=p.zones.center;
    if(named(centerUnit,'綺々羅々ヴィヴィ',map)&&['1st','2nd'].includes(metadata(centerUnit,map)?.stage)&&centerUnit.attachments.some(r=>r.number==='hBP09-109'))add('hBP09-109','center',[{op:'makeup'}]);
    for(const {zone,unit}of entries(p))if(named(unit,'雪花ラミィ',map)&&unit.lastArtsTurn===state.turn&&unit.attachments.some(r=>r.number==='hBP09-110'))add('hBP09-110',zone,[pick({area:'attachments',sourceOnly:true,rule:{numbers:['hBP09-110']}},'snowMoon',[move(R('snowMoon'),'archive'),draw(1)])]);
    if(added)host.enqueueEffect(state,{type:'hbp09FinishTurn',playerIndex:i});return added;
  }
  function activateX(state,i,map){const p=state.players[i];if(p.oshi?.number!=='hBP09-002')return false;
    assert(state.status==='playing'&&state.activePlayer===i&&state.phase==='main'&&!state.pendingChoice,'Oshi activation window invalid');
    assert(p.oshiSkillTurn!==state.turn&&named(p.zones.center,'轟はじめ',map),'Hajime skill has no legal center or was already used');enqueue(state,i,p.oshi.number,'oshi','center');return true;
  }
  return {...rt,enqueueProgram:enqueue,keyword,arts,support,artCost,hpBonus,artsPassive,defense,immuneDamage,beforeAttack,afterAttack,canBack,onBaton,onOshi,onAttach,onSupport,onDamaged,onDown,artDown,endPerformance,activateX,entries,named,arms,metadata};
}
