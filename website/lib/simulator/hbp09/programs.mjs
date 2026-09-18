/** Explicit official-snapshot rules. Every branch is selected by card number,
 * never by translated display text. Passives and event windows live in hooks.mjs. */
const S={source:true};
const R=ref=>({ref});
const F=(fact,extra={})=>({fact,...extra});
const O=(op,...args)=>({op,args});
const count=(area,rule={},extra={})=>({count:{area,rule,...extra}});
const yes=(when,then,otherwise=[])=>({op:'if',when,then,else:otherwise});
const own=name=>F('oshiName',{name});
const atleast=(n,threshold)=>O('gte',n,threshold);
const draw=(amount,owner)=>({op:'draw',amount,owner});
const buff=(target,amount,kind='arts')=>({op:'buff',target,amount,kind});
const pick=(from,key,then,min=1,max=1,extra={})=>({op:'chooseCards',from,key,min,max,then,...extra});
const target=(rule,key,then,extra={})=>({op:'chooseUnit',from:{rule,...extra},key,then});
const move=(cards,to,reveal=false)=>({op:'move',cards,to,reveal});
const search=(rule,max=1)=>[pick({area:'mainDeck',rule},'searchPick',[move(R('searchPick'),'hand',true)],0,max,{search:true}),{op:'shuffle',area:'mainDeck'}];
const recover=(rule,max=1,optional=false)=>[pick({area:'archive',rule},'recoverPick',[move(R('recoverPick'),'hand')],1,max,{optional})];
const topCheer=rule=>target(rule,'cheerTarget',[{op:'topCheer',target:R('cheerTarget')}]);
const special=(amount,rule={},extra={})=>target(rule,'damageTarget',[{op:'damage',target:R('damageTarget'),amount}],{owner:'opponent',...extra});
const fixedDamage=(amount,zones)=>({op:'damage',target:{area:'stage',owner:'opponent',zones},amount});
const heal=amount=>target({},'healTarget',[{op:'heal',target:R('healTarget'),amount}]);
const handOrder=(n,to='deckBottom')=>pick({area:'hand'},'ordered',[move(R('ordered'),to)],n,n);
const cost=(from,min,max,then)=>pick(from,'paid',then,min,max,{optional:true,cost:true});
const once=(key,then)=>({op:'once',key,then});
const tools={typeCodes:['supportTool'],tags:["#カエラ'sアームズ"]};
const sake={group:'support',tags:['#ラミィのお酒']};
const matsuriLimited={group:'support',limited:true};
const stage=(rule={},extra={})=>({area:'stage',rule,...extra});
const onFirst=steps=>yes(F('secondFirst'),steps);
const center=steps=>yes(O('eq',F('sourceZone'),'center'),steps);
const collab=steps=>yes(O('eq',F('sourceZone'),'collab'),steps);
const look=(amount,rule)=>({op:'look',amount,rule});
const transfer=(n,targetRule,extra={},optional=false)=>pick({area:'cheer',sourceOnly:true},'energies',[
  target(targetRule,'destination',[{op:'attach',cards:R('energies'),target:R('destination')}],extra)
],n,n,{optional});
const archiveCheer=(rule={},max=1,same=false,extra={})=>pick({area:'archive',rule:{group:'cheer'}},'energies',same?[
  target(rule,'destination',[{op:'attach',cards:R('energies'),target:R('destination')}],extra)
]:[{op:'forEach',items:R('energies'),key:'energyItem',then:[target(rule,'destination',[{op:'attach',cards:R('energyItem'),target:R('destination')}],extra)]}],1,max);
const deploy=(rule,max=1,area='mainDeck')=>[pick({area,rule},'deployPick',[{op:'deploy',cards:R('deployPick')}],0,max,{search:area==='mainDeck'}),...(area==='mainDeck'?[{op:'shuffle',area}]:[])];
const attachFrom=(area,rule,targetRule,source=false)=>[pick({area,rule},'attachmentPick',source?[{op:'attach',cards:R('attachmentPick'),target:S}]:[target(targetRule,'attachmentTarget',[{op:'attach',cards:R('attachmentPick'),target:R('attachmentTarget')}])],...(area==='mainDeck'?[{op:'shuffle',area}]:[])];
export const PROGRAMS={
  '001:oshi':[target({},'opponentLevel',[],{owner:'opponent'}),{op:'sameLevelSubaru'}],
  '002:oshi':[{op:'hajimeX'}],
  '003:oshi':[archiveCheer({names:['白銀ノエル']},O('choose',atleast(count('archive',{names:['牛丼']}),3),2,1))],
  '004:oshi':[pick({area:'attachments',rule:tools},'tools',[move(R('tools'),'archive'),special(100,{notDebut:true},{zones:['center','collab']})],2,2,{cost:true})],
  '005:oshi':[{op:'reactiveOnly'}],
  '006:oshi':[draw(3),draw(2,'opponent')],
  '006:sp':[yes(atleast(count('stage',{names:['綺々羅々ヴィヴィ'],stages:['2nd']},{zones:['center']}),1),[{op:'viviReset'}])],
  '007:oshi':search(sake,2),
  '009:keyword':[onFirst([{op:'playerBuff',kind:'hbp09SubaruFirstReduction',amount:-100,duration:1,rule:{names:['大空スバル']}}])],
  '010:keyword':[draw(2),handOrder(2)],
  '010:art0':[pick({area:'attachments',owner:'opponent',rule:{typeCodes:['supportTool']}},'enemyTool',[{op:'move',cards:R('enemyTool'),to:'archive',owner:'opponent'}])],
  '011:art0':[draw(1)],
  '012:keyword':[yes(O('and',own('大空スバル'),atleast(count('holoPower',{}, {owner:'opponent'}),2)),[once('BIG3-side-S',[{op:'powerTop',amount:1}])])],
  '013:keyword':search({names:['大空警察','スピード違反']}),
  '016:keyword':[onFirst(search({names:['轟はじめ'],baton:1},2))],
  '018:keyword':[center([draw(2)])],
  '019:keyword':[yes(O('not',O('or',O('eq',F('sourceZone'),'center'),O('eq',F('sourceZone'),'collab'))),[target({},'batonTarget',[buff(R('batonTarget'),-2,'batonCost')])])],
  '020:art0':[collab([buff(stage({}, {zones:['center']}),-1,'artCost:white')])],
  '022:keyword':[yes(atleast(F('power'),10),[target({},'stageTarget',[{op:'treatStage',target:R('stageTarget'),stage:'2nd'}],{owner:'opponent'})])],
  '026:keyword':[onFirst([...search({names:['白銀ノエル'],stages:['Debut']}),...search({names:['牛丼']})])],
  '028:keyword':search({names:['牛丼']}),
  '029:art0':search({names:['白銀ノエル'],stages:['2nd']}),
  '030:keyword':[heal(O('mul',count('archive',{names:['牛丼']}),10))],
  '032:keyword':[cost({area:'hand',rule:{typeCodes:['supportMascot','supportFan']}},1,1,[move(R('paid'),'deckTop',true),topCheer({tags:['#ゲーマーズ']})])],
  '033:keyword':[{op:'chooseOption',key:'millDecision',options:[{id:'yes',label:'將牌庫頂1張存檔'},{id:'no',label:'不支付'}],then:[yes(O('eq',{var:'millDecision'},'yes'),[{op:'set',key:'milled',value:{count:{area:'mainDeck',top:1,rule:{group:'support'}}}},move({area:'mainDeck',top:1},'archive'),yes(atleast({var:'milled'},1),[topCheer({})])])]}],
  '034:keyword':[cost({area:'archive',rule:{typeCodes:['supportMascot','supportFan']}},2,2,[move(R('paid'),'deckTop'),heal(100)])],
  '035:keyword':[yes(own('大神ミオ'),[draw(3),handOrder(2,'deckTop')])],
  '035:art0':[{op:'chooseOption',key:'millDecision',options:[{id:'yes',label:'將牌庫頂2張存檔'},{id:'no',label:'不支付'}],then:[yes(O('eq',{var:'millDecision'},'yes'),[{op:'set',key:'millSupport',value:count('mainDeck',{group:'support'},{top:2})},move({area:'mainDeck',top:2},'archive'),target({},'boost',[buff(R('boost'),O('mul',{var:'millSupport'},30))])])]}],
  '036:keyword':[target({names:['AZKi']},'azki',[{op:'colorMatchedCheer'}])],
  '038:keyword':[yes(atleast(count('attachments',{typeCodes:['supportTool']},{zones:['collab']}),1),[draw(1)])],
  '039:keyword':[onFirst(search({typeCodes:['supportTool']},2))],
  '040:keyword':recover(tools,1,true),
  '042:art0':attachFrom('archive',tools,{},true),
  '043:keyword':[yes(atleast(count('attachments',tools),2),[archiveCheer({})])],
  '043:art0':[fixedDamage(30,['collab'])],
  '045:keyword':[{op:'roll',key:'die'},yes(O('eq',O('mod',{var:'die'},2),1),[fixedDamage(30,['center'])],[draw(2)])],
  '045:art0':deploy({names:['赤井はあと'],stages:['Debut']},1,'archive'),
  '046:keyword':[{op:'chooseOption',key:'payTopCheer',options:[{id:'yes',label:'將應援牌庫頂1張存檔'},{id:'no',label:'不支付'}],then:[yes(O('and',O('eq',{var:'payTopCheer'},'yes'),atleast(count('cheerDeck'),1)),[move({area:'cheerDeck',top:1},'archive'),...deploy({names:['百鬼あやめ'],stages:['Debut']})])]}],
  '047:keyword':[yes(atleast(count('stage',{names:['大空スバル']},{zones:['center']}),1),[draw(1)])],
  '048:keyword':[yes(own('大空スバル'),[...search({names:['大空スバル'],stages:['1st']}),...search({names:['ハコス・ベールズ'],stages:['1st']})])],
  '048:art0':[{op:'roll',key:'die'},yes(O('eq',O('mod',{var:'die'},2),1),[fixedDamage(20,['collab'])])],
  '049:art0':[yes(own('大空スバル'),recover({names:['大空スバル','ハコス・ベールズ']}))],
  '050:keyword':[yes(own('大空スバル'),[target({},'swap',[{op:'swapCollab',target:R('swap')}],{owner:'opponent',back:true})])],
  '051:art1':[transfer(1,{tags:['#歌']},{back:true},true)],
  '052:keyword':[onFirst([topCheer({names:['常闇トワ']})])],
  '054:keyword':[topCheer({names:['常闇トワ']})],
  '054:art0':[yes(atleast(count('stage',{tags:['#歌'],stages:['2nd']}),1),[special(20)])],
  '055:art1':[yes(O('eq',F('artsCount'),2),[transfer(1,{tags:['#歌']},{excludeSource:true},true)])],
  '056:art0':[archiveCheer({tags:['#歌']})],
  '056:art1':[yes(O('eq',F('artsCount'),2),[{op:'powerTop',amount:1}])],
  '057:art0':[yes(O('eq',F('artsCount'),2),[look(4,{group:'support'})])],
  '057:art1':[yes(O('eq',F('artsCount'),3),[special(50)])],
  '058:keyword':[yes(own('猫又おかゆ'),[topCheer({names:['猫又おかゆ']})])],
  '058:art0':[special(10)],
  '060:keyword':[look(3,{tags:['#ID1期生'],group:'holomem'})],
  '060:art0':[fixedDamage(10,['center','collab'])],
  '061:keyword':[yes(own('ムーナ・ホシノヴァ'),[{op:'topCheer',target:S}])],
  '061:art0':[transfer(2,{tags:['#ID1期生']},{back:true})],
  '062:art0':[yes(own('ムーナ・ホシノヴァ'),[cost({area:'cheer',sourceOnly:true,rule:{colors:['藍']}},5,5,[move(R('paid'),'archive'),{op:'adjustArt',amount:O('mul',count('stage',{tags:['#ID1期生']}),20)}])])],
  '063:keyword':[once('Student-of-Time',[{op:'drawBottom',amount:1}])],
  '063:art0':attachFrom('mainDeck',{names:['Boros','Kronies']},{names:['オーロ・クロニー']}),
  '065:keyword':[onFirst([...search({names:['綺々羅々ヴィヴィ']},2),draw(1,'opponent')])],
  '066:keyword':[yes(atleast(F('handOpponent'),7),[buff(stage({names:['綺々羅々ヴィヴィ']}),20)],[buff(S,20)])],
  '067:keyword':[yes(own('綺々羅々ヴィヴィ'),[once('sweet-vivi',[draw(2),draw(1,'opponent')])])],
  '068:art1':[yes(atleast(count('attachments',{numbers:['hBP09-109']},{sourceOnly:true}),1),search({group:'holomem',tags:['#FLOW GLOW']}))],
  '071:keyword':[target({names:['風真いろは']},'iroha',[buff(R('iroha'),O('mul',F('power'),10))])],
  '071:art0':[yes(atleast(count('stage',{names:['風真いろは']}),1),[draw(1)])],
  '072:keyword':[yes(F('archiveBloom'),[once('dance-macabre',[draw(2)])])],
  '074:keyword':recover({tags:['#Advent'],group:'holomem',stages:['Debut','1st']},1,true),
  '075:art0':[yes(own('ネリッサ・レイヴンクロフト'),[draw(1),pick({area:'hand'},'handPower',[move(R('handPower'),'holoPower')])])],
  '076:keyword':[cost({area:'holoPower'},1,3,[move(R('paid'),'archive'),buff(stage({tags:['#歌']}),O('mul',{numberOfSelected:'paid'},30))])],
  '077:keyword':[{op:'roll',key:'die'},yes(O('eq',{var:'die'},6),[buff(S,20)]),yes(O('eq',{var:'die'},1),[{op:'rest',target:S}])],
  '078:keyword':[onFirst([draw(3),pick({area:'hand'},'firstDiscard',[{op:'set',key:'isSake',value:F('selectedMatches',{ref:'firstDiscard',rule:sake})},move(R('firstDiscard'),'archive'),yes(O('not',{var:'isSake'}),[pick({area:'hand'},'secondDiscard',[move(R('secondDiscard'),'archive')])])])],
  '079:keyword':[look(5,sake)],
  '079:art0':[yes(atleast(count('attachments',{group:'support'}),1),[draw(1)])],
  '080:keyword':[archiveCheer({tags:['#お酒']})],
  '081:art0':[cost({area:'cheer',sourceOnly:true},2,2,[move(R('paid'),'archive'),special(40,{notDebut:true})])],
  '082:keyword':[yes(atleast(count('archive',sake),1),[topCheer({names:['雪花ラミィ']})])],
  '084:keyword':[cost({area:'hand',rule:matsuriLimited},1,1,[move(R('paid'),'archive'),...deploy({names:['夏色まつり'],stages:['Debut']},2)])],
  '085:keyword':[yes(own('夏色まつり'),[cost({area:'archive',rule:matsuriLimited},1,1,[move(R('paid'),'deckBottom'),target({names:['夏色まつり']},'matsuri',[buff(R('matsuri'),30)])])],
  '086:keyword':[yes(own('夏色まつり'),[look(5,matsuriLimited)])],
  '087:keyword':[yes(O('and',own('夏色まつり'),F('oshiColor',{color:'黃'}),F('allMatsuri'),atleast(F('power'),1)),[{op:'chooseOption',key:'limitedPay',options:[{id:'yes',label:'支付頂部1 Holo Power'},{id:'no',label:'不支付'}],then:[yes(O('eq',{var:'limitedPay'},'yes'),[{op:'archiveTopPower',amount:1},{op:'limited',amount:2}])]}])],
  '088:art0':[{op:'distinctArchiveCheer',rule:{tags:['#5期生']},max:2}],
  '089:keyword':[yes(F('threeIdColors'),[target({tags:['#ID1期生']},'idBoost',[buff(R('idBoost'),30)])])],
  '089:art0':[yes(O('or',F('oshiColor',{color:'綠'}),F('oshiColor',{color:'藍'}),F('oshiColor',{color:'黃'})),[topCheer({tags:['#ID1期生']})])],
  '090:support':[pick({area:'holoPower'},'powerCost',[move(R('powerCost'),'archive'),{op:'commitSupport'},...search({group:'holomem',keyword:'collab',names:['$oshi']})],1,1,{cost:true})],
  '091:support':[{op:'commitSupport'},...deploy({names:['AZKi'],stages:['1st']}),...deploy({names:['風真いろは'],stages:['1st']})],
  '092:support':[{op:'commitSupport'},draw(2),draw(2,'opponent'),yes(atleast(F('handOpponent'),7),[buff(stage({names:['綺々羅々ヴィヴィ']}),30)])],
  '093:support':[{op:'commitSupport'},pick({area:'cheer'},'energies',[{op:'forEach',items:R('energies'),key:'energyItem',then:[target({},'destination',[{op:'attach',cards:R('energyItem'),target:R('destination')}])]}],1,2),yes(atleast(count('stage',{}, {hasCheer:true}),4),[archiveCheer()])],
  '094:support':[{op:'commitSupport'},target({},'restTarget',[{op:'rest',target:R('restTarget'),skipReset:true}],{owner:'opponent',back:true})],
  '095:support':[{op:'set',key:'toastDamage',value:O('choose',atleast(count('archive',{numbers:['hBP09-095']}),2),40,10)},{op:'commitSupport'},special({var:'toastDamage'},{},{zones:['center','collab']})],
  '096:support':[{op:'commitSupport'},target({tags:['#ReGLOSS']},'batonTarget',[buff(R('batonTarget'),-1,'batonCost')]),archiveCheer({names:['轟はじめ']},1,false,{back:true})],
  '097:support':[{op:'commitSupport'},draw(2),pick({area:'cheer'},'returnCheer',[move(R('returnCheer'),'cheerDeck'),pick({area:'cheerDeck'},'searchCheer',[target({},'destination',[{op:'attach',cards:R('searchCheer'),target:R('destination')}])],0,1,{search:true}),{op:'shuffle',area:'cheerDeck'}])],
  '098:support':[{op:'set',key:'archiveLimited',value:atleast(count('archive',matsuriLimited),1)},{op:'commitSupport'},draw(4),yes({var:'archiveLimited'},[handOrder(4)])],
  '099:support':[{op:'commitSupport'},archiveCheer({},2,true)],
  '100:support':[{op:'commitSupport'},target({names:['白銀ノエル']},'noel',[buff(R('noel'),10),yes(F('selectedMatches',{ref:'noel',rule:{buzzOrSecond:true}}),[{op:'heal',target:R('noel'),amount:50}])])],
  '101:support':[{op:'commitSupport'},fixedDamage(20,['center']),{op:'flag',key:'hbp09TowaBackTurn',value:'turn'}],
  '102:support':[{op:'commitSupport'},{op:'powerTop',amount:2},pick({area:'holoPower'},'powerToHand',[move(R('powerToHand'),'hand')],1,2),{op:'shuffle',area:'holoPower'}],
  '103:support':[{op:'commitSupport'},...recover({names:['白銀ノエル']}),...recover({names:['牛丼']})],
  '104:support':[{op:'commitSupport'},{op:'highestHp',amount:30}],
  '105:support':[{op:'commitSupport'},draw(2),look(3,{group:'holomem',names:['$oshi']})],
};
export function keyOf(number,event){return `${String(number).slice(-3)}:${event}`;}
export function program(number,event){return PROGRAMS[keyOf(number,event)] || null;}
export {S,R,F,O,count,yes,own,atleast,draw,buff,pick,target,move,search,recover,topCheer,special,fixedDamage,heal,handOrder,cost,once,tools,sake,stage,archiveCheer,deploy,attachFrom};
