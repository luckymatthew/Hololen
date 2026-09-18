"""Apply hBP09 executable modules to the current compatible website reducer.
Dry run by default. --apply makes a dated backup. No app code, saves, APK or
credentials are replaced. Every source anchor must be present exactly once.
"""
import argparse,datetime,hashlib,json,pathlib,re,shutil,os,tempfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
MARKER='// BEGIN HBP09 EXECUTABLE BRIDGE v1'
def one(text,old,new):
    count=text.count(old)
    if count!=1: raise ValueError(f'Expected one source anchor, found {count}: {old[:110]!r}. Refusing unsafe automatic merge.')
    return text.replace(old,new,1)
def patch(root):
    engine=root/'lib/simulator/engine.mjs';original=engine.read_text(encoding='utf-8')
    if MARKER in original:return {},{'alreadyApplied':True}
    bridge=(ROOT/'lib/simulator/hbp09/engine-bridge.txt').read_text(encoding='utf-8')
    bridge=one(bridge,'const HBP09 = createHbp09({','const HBP09_MAPS = new WeakMap();\nconst HBP09 = createHbp09({')
    bridge=one(bridge,"  state.hbp09ResolvingSupport = card.number;\n  return result;","  state.hbp09ResolvingSupport = card.number;\n  const map = HBP09_MAPS.get(state);\n  if (map) HBP09.onSupport(state, playerIndex, card, map);\n  return result;")
    bridge=one(bridge,"  if (!replaced) hbp09Legacy_queueGiftKnockoutEffects(state, ownerIndex, defeated, defeatedCard, map, sourcePlayerIndex, options, pendingEffects);","  hbp09Legacy_queueGiftKnockoutEffects(state, ownerIndex, defeated, defeatedCard, map, sourcePlayerIndex, options, pendingEffects);")
    names=re.findall(r'^function ([A-Za-z0-9_]+)\(',bridge,re.M)
    rename=[name for name in names if name!='hbp09WithoutNewAttachments']
    text=original
    for name in rename:text=one(text,f'function {name}(',f'function hbp09Legacy_{name}(')
    text="import { createHbp09, isHbp09 } from './hbp09/hooks.mjs';\n"+text
    text=one(text,'  map.gameState = state;','  map.gameState = state;\n  if (state) HBP09_MAPS.set(state, map);')
    text=one(text,'  if (TOP_LOOK_EFFECTS[card.number]) {','  if (HBP09.support(state, playerIndex, cardInstance, card, map)) return;\n  if (TOP_LOOK_EFFECTS[card.number]) {')
    text=one(text,'    if (effect.type === "koFanTransfer") {','    if (effect.type === "hbp09Program") { HBP09.run(state, effect.context, effect.steps, map, random); continue; }\n    if (effect.type === "hbp09FinishTurn") { hbp09Legacy_finishTurn(state, effect.playerIndex, map); continue; }\n    if (effect.type === "koFanTransfer") {')
    text=one(text,'  const canAttackBack = intrinsicBackAttack ||','  const canAttackBack = HBP09.canBack(state, playerIndex, source, action.targetZone, unitCard(target, map), map) || intrinsicBackAttack ||')
    text=one(text,'  const artKey = `${artCard?.number}:${Number(action.artIndex)}`;','  HBP09.beforeAttack(state, playerIndex, action, map);\n  const artKey = `${artCard?.number}:${Number(action.artIndex)}`;')
    text=one(text,'  source.lastArtsZone = action.sourceZone;','  source.lastArtsZone = action.sourceZone;\n  HBP09.afterAttack(state, playerIndex, action, map);')
    text=one(text,'  player.batonTurn = state.turn;','  player.batonTurn = state.turn;\n  HBP09.onBaton(state, playerIndex, card, map);')
    text=one(text,'      const damageBefore = Number(target.damage || 0);','      damage = HBP09.immuneDamage(state, effect.targetPlayerIndex, effect.targetZone, damage, map);\n      const damageBefore = Number(target.damage || 0);')
    text=one(text,'  if (sourceCard?.number === "hBP09-037") pendingEffects.push','  if (false && sourceCard?.number === "hBP09-037") pendingEffects.push')
    text=one(text,'  diceRun.map = map; diceRuns.set(state, diceRun);','  diceRun.map = map; diceRuns.set(state, diceRun);\n  if (action?.type !== "choose") delete state.hbp09ResolvingSupport;')
    # Archive Bloom evidence belongs to the actual move, not a translated-text heuristic.
    needle='function queueBloomEffects(state, playerIndex, zone, card, map, random) {'
    bridge=one(bridge,needle,needle+'\n  const moved = topCard(state.players[playerIndex].zones[zone]);\n  if (moved?.hbp09FromArchive) { state.players[playerIndex].hbp09ArchiveBloomTurn = state.turn; delete moved.hbp09FromArchive; }')
    text+='\n\n'+bridge+'\n'
    oshi=root/'lib/simulator/oshi-skill-catalog.mjs';ot=oshi.read_text(encoding='utf-8')
    ot,n=re.subn(r'export const CATALOG_ONLY_OSHI = Object\.freeze\(\[\s*"hBP09-001".*?"hBP09-007",?\s*\]\);','export const CATALOG_ONLY_OSHI = Object.freeze([]); // hBP09 resolvers installed',ot,flags=re.S)
    if n!=1:raise ValueError('Oshi catalog guard differs; review instead of removing unrelated guards')
    ot=one(ot,'const COST_OVERRIDES = Object.freeze({','const COST_OVERRIDES = Object.freeze({\n  "hBP09-002": { oshi: "X" },\n  "hBP09-006": { sp: 3 },')
    ot=one(ot,'export const REACTIVE_NORMAL_OSHI = Object.freeze([','export const REACTIVE_NORMAL_OSHI = Object.freeze([\n  "hBP09-005",')
    ot=one(ot,'export const ACTIVE_SP_OSHI = Object.freeze([','export const ACTIVE_SP_OSHI = Object.freeze([\n  "hBP09-006",')
    catalog=root/'lib/simulator/effect-catalog.mjs'
    ct=catalog.read_text(encoding='utf-8')
    registrations=''.join(f'  \"hBP09-{n:03}\": \"hbp09-program-{n:03}\",\n' for n in range(90,106)).replace('\\n','\n').replace('\\\"','\"')
    ct=one(ct,'export const EXTENDED_SUPPORT_EFFECTS = Object.freeze({','export const EXTENDED_SUPPORT_EFFECTS = Object.freeze({\n'+registrations)
    outputs={engine:text,oshi:ot,catalog:ct}
    # Runtime corrections are kept in this installer to remain reproducible from
    # the pinned module source. The final packaged module is the corrected result.
    runtime=root/'lib/simulator/hbp09/runtime.mjs';rt=runtime.read_text(encoding='utf-8')
    rt=one(rt,"if (selector.area === 'stage') {","if (selector.area === 'stage') {") if False else rt
    rt=one(rt,"        const unit=p.zones[zone]; if (!unit) return [];","        const unit=p.zones[zone]; if (!unit || unit.downPending) return [];")
    rt=one(rt,"          if(o.op==='buff')host.addStageModifier(t.unit,o.kind||'arts',n(o.amount),state.turn+Number(o.duration||0),c.sourceNumber);","          if(o.op==='buff') { host.addStageModifier(t.unit,o.kind||'arts',n(o.amount),state.turn+Number(o.duration||0),c.sourceNumber); if ((o.kind||'arts')==='arts' && state.artsResolution?.phase==='ability' && t.owner===c.playerIndex) host.adjustQueuedArtsDamage(state,c.playerIndex,t.zone,n(o.amount)); }")
    rt=one(rt,"          if(o.op==='damage')host.applySpecialDamage(state,c.playerIndex,t.owner,t.zone,Math.max(0,n(o.amount)),map,{sourceZone:c.sourceZone,sourceCardNumber:c.sourceNumber,sourceName:c.sourceNumber});","          if(o.op==='damage')host.enqueueEffect(state,{type:'specialDamage',playerIndex:c.playerIndex,targetPlayerIndex:t.owner,targetZone:t.zone,amount:Math.max(0,n(o.amount)),sourceZone:c.sourceZone,sourceCardNumber:c.sourceNumber,sourceName:c.sourceNumber});")
    rt=one(rt,"        }continue;\n      }\n      if(o.op==='playerBuff')","        }\n        if(o.op==='damage' && steps.length) { enqueue(state,c,steps); return; }\n        continue;\n      }\n      if(o.op==='playerBuff')")
    # Correct 'move' selection: area selectors must be resolved as selectors.
    # targetRefs already handles area/ref/source expressions consistently.
    outputs[runtime]=rt
    report={'alreadyApplied':False,'integrationVersion':'hbp09-executable-20260918.1','originalEngineSha256':hashlib.sha256(original.encode()).hexdigest(),'renamedLegacyFunctions':rename,'changedFiles':[str(p.relative_to(root)) for p in outputs]}
    return outputs,report

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--website',type=pathlib.Path,default=ROOT);parser.add_argument('--apply',action='store_true');args=parser.parse_args();root=args.website.resolve()
    outputs,report=patch(root);report['dryRun']=not args.apply
    if args.apply and outputs:
        backup=root/'.hbp09-backups'/datetime.datetime.now().strftime('%Y%m%dT%H%M%S%f');backup.mkdir(parents=True)
        for path in outputs:
            target=backup/path.relative_to(root);target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,target)
        written=[]
        try:
            for path,text in outputs.items():
                with tempfile.NamedTemporaryFile('w',encoding='utf-8',dir=path.parent,delete=False) as f:f.write(text);temporary=pathlib.Path(f.name)
                os.replace(temporary,path);written.append(path)
        except Exception:
            for path in written:shutil.copy2(backup/path.relative_to(root),path)
            raise
        report['backup']=str(backup)
    print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
