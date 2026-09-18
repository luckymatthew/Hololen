export function registerExtraCases({test,assert,cards,map,N,instance,unit,fixture,act,answer,settle,support,attack,runCollab,conserve,cheerNumbers}) {
  const play=(s,number)=>{const card=instance(number);s.players[0].hand.push(card);return act(s,{type:'play',cardId:card.id});};
  test('Noel Gyudon healing resolves +100 before Stage cheer and draw, only once',()=>{
    const s=fixture(3,31);s.players[0].zones.center.damage=150;
    let out=play(s,'hBP05-075');assert.equal(out.pendingChoice.effect,'healAndModifier');
    out=answer(out,{zone:'center'});assert.equal(out.players[0].zones.center.damage,30);
    assert.equal(out.pendingChoice.effect,'hbp09');out=answer(out,{zone:'center'});
    assert.equal(out.players[0].zones.center.cheer.length,1);assert.equal(out.players[0].hand.length,1);
    out=play(out,'hBP05-075');out=answer(out,{zone:'center'});
    assert.equal(out.players[0].zones.center.damage,10);assert.equal(out.players[0].zones.center.cheer.length,1);assert.equal(out.players[0].hand.length,1);
  });
  test('archive Bloom sets evidence before Ollie Bloom draw and Arts bonus',()=>{
    const s=fixture();s.players[0].oshi=instance('hBP02-006');
    const debut=cards.find(c=>c.group==='holomem'&&c.stage==='Debut'&&c.jpName==='クレイジー・オリー');assert.ok(debut);
    s.players[0].zones.center=unit(debut.number);s.players[0].archive=[instance(N(72))];
    let out=act(s,{type:'oshiSkill'});out=answer(out,{cardIds:[out.pendingChoice.cards[0].id]});out=answer(out,{zone:'center'});
    assert.equal(out.players[0].hbp09ArchiveBloomTurn,3);assert.equal(out.players[0].hand.length,2);assert.equal(out.players[0].zones.center.stack.at(-1).number,N(72));
    out.players[0].zones.center.cheer=[instance(cheerNumbers[4])];out=attack(out);assert.equal(out.players[1].zones.center.damage,60);
  });
  test('ordinary hand Bloom does not fabricate an archive-Bloom event',()=>{
    const s=fixture();const debut=cards.find(c=>c.group==='holomem'&&c.stage==='Debut'&&c.jpName==='クレイジー・オリー');
    s.players[0].zones.center=unit(debut.number);let out=play(s,N(72));out=answer(out,{zone:'center'});
    assert.equal(out.players[0].hand.length,0);assert.notEqual(out.players[0].hbp09ArchiveBloomTurn,3);
  });
  test('a Bloom-only ability never fires merely because that Holomen collabs',()=>{
    const s=fixture();s.players[0].zones.back1=unit(N(79));s.players[0].mainDeck.unshift(instance(N(110)));
    const out=act(s,{type:'collab',zone:'back1'});assert.equal(out.pendingChoice,null);assert.equal(out.players[0].hand.length,0);
  });
  test('Bloom top-five search orders the unmatched remainder exactly',()=>{
    const s=fixture(7,77);s.players[0].mainDeck=[instance(N(51)),instance(N(110)),instance(N(64)),instance(N(60)),instance(N(8)),...s.players[0].mainDeck];
    let out=play(s,N(79));out=answer(out,{zone:'center'});assert.equal(out.pendingChoice.max,1);assert.equal(out.pendingChoice.cards[0].number,N(110));
    out=answer(out,{cardIds:[out.pendingChoice.cards[0].id]});const ids=out.pendingChoice.cards.map(c=>c.id).reverse();out=answer(out,{cardIds:ids});assert.deepEqual(out.players[0].mainDeck.slice(-4).map(c=>c.id),ids);assert.equal(out.players[0].hand.at(-1).number,N(110));
  });
  test('Nerissa optional Bloom power cost can be declined without spending',()=>{
    const s=fixture(6,74);let out=play(s,N(76));out=answer(out,{zone:'center'});assert.equal(out.pendingChoice.optional,true);
    const power=out.players[0].holoPower.length;out=answer(out,{skip:true});assert.equal(out.players[0].holoPower.length,power);assert.equal(out.players[0].zones.center.modifiers.length,0);
  });
  test('Nerissa optional Bloom cost pays selected three power and buffs all Song members',()=>{
    const s=fixture(6,74);s.players[0].zones.back1=unit(N(53));let out=play(s,N(76));out=answer(out,{zone:'center'});out=answer(out,{cardIds:out.pendingChoice.cards.slice(0,3).map(c=>c.id)});
    assert.equal(out.players[0].holoPower.length,7);assert.equal(out.players[0].zones.center.modifiers[0].amount,90);assert.equal(out.players[0].zones.back1.modifiers[0].amount,90);
  });
  test('Makeup extra Bloom at performance-end changes the stack and keeps physical cards',()=>{
    const s=fixture(6,68);s.phase='performance';s.players[0].zones.center.attachments=[instance(N(109))];
    s.players[0].zones.back1=unit(N(66));s.players[0].zones.back1.bloomedTurn=3;s.players[0].hand=[instance(N(70))];
    let out=act(s,{type:'advance'});assert.equal(out.pendingChoice.effect,'hbp09');out=answer(out,{zone:'back1'});out=answer(out,{cardIds:[out.pendingChoice.cards[0].id]});
    assert.equal(out.players[0].zones.back1.stack.at(-1).number,N(70));assert.equal(out.players[0].zones.back1.stack.length,2);assert.equal(out.activePlayer,1);conserve(s,out);
  });
  test('Makeup optional extra Bloom can be declined',()=>{
    const s=fixture(6,68);s.phase='performance';s.players[0].zones.center.attachments=[instance(N(109))];s.players[0].zones.back1=unit(N(66));s.players[0].zones.back1.bloomedTurn=3;s.players[0].hand=[instance(N(70))];
    let out=act(s,{type:'advance'});out=answer(out,{skip:true});assert.equal(out.players[0].zones.back1.stack.length,1);assert.equal(out.players[0].hand.length,1);assert.equal(out.activePlayer,1);
  });
  test('Snow Moon end effect archives the actual tool and draws exactly one',()=>{
    const s=fixture(7,82);s.phase='performance';const moon=instance(N(110));s.players[0].zones.center.attachments=[moon];s.players[0].zones.center.lastArtsTurn=3;
    let out=act(s,{type:'advance'});out=answer(out,{cardIds:[moon.id]});assert.equal(out.players[0].zones.center.attachments.length,0);assert.ok(out.players[0].archive.some(c=>c.id===moon.id));assert.equal(out.players[0].hand.length,1);assert.equal(out.activePlayer,1);conserve(s,out);
  });
  test('Snow Moon does not trigger without an Arts event this turn',()=>{
    const s=fixture(7,82);s.phase='performance';s.players[0].zones.center.attachments=[instance(N(110))];const out=act(s,{type:'advance'});assert.equal(out.players[0].hand.length,0);assert.equal(out.players[0].zones.center.attachments.length,1);
  });
  test('receiving nonlethal 100 Arts with Subaru011 draws two after damage',()=>{
    const s=fixture(1,11);s.activePlayer=1;s.phase='performance';s.turn=4;
    const attacker={number:'TEST-SUBARU-HIT',group:'holomem',hp:9999,stage:'2nd',colors:[],tags:[],arts:[{name:'Hit',damage:100,cost:[]}]};s.players[1].zones.center=unit(attacker.number);
    const out=act(s,{type:'attack',sourceZone:'center',targetZone:'center',artIndex:0},1,[...cards,attacker]);assert.equal(out.players[0].hand.length,2);assert.equal(out.players[0].zones.center.damage,100);
  });
  test('Nene200-damage immunity uses resolved damage and matching Oshi',()=>{
    const s=fixture();const oshi=cards.find(c=>c.group==='oshi'&&c.jpName==='桃鈴ねね');assert.ok(oshi);s.players[0].oshi=instance(oshi.number);s.players[0].zones.center=unit(N(88));s.activePlayer=1;s.phase='performance';s.turn=4;
    const attacker={number:'TEST-NENE-HIT',group:'holomem',hp:9999,stage:'2nd',colors:[],tags:[],arts:[{name:'Hit',damage:200,cost:[]}]};s.players[1].zones.center=unit(attacker.number);
    const out=act(s,{type:'attack',sourceZone:'center',targetZone:'center',artIndex:0},1,[...cards,attacker]);assert.equal(out.players[0].zones.center.damage,0);
  });
  test('Kaela HP hammer counts +40 only on Buzz or 2nd',()=>{
    const s=fixture(4,44);s.players[0].zones.center.attachments=[instance(N(106))];s.players[0].zones.back1=unit(N(44));
    const out=support(s,104);assert.equal(out.players[0].zones.center.modifiers[0].amount,30);assert.equal(out.players[0].zones.back1.modifiers.length,0);
  });
  test('Towa blue cheer gains purple only when Break Mic is on 2nd Towa',()=>{
    const s=fixture(5,57);s.players[0].zones.center.attachments=[instance(N(108))];s.players[0].zones.center.cheer=Array.from({length:4},()=>instance(cheerNumbers[3]));
    let out=attack(s,1);out=settle(out);assert.ok(out.players[1].zones.center.damage>0);
  });
}
