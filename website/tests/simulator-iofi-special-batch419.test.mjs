import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,unit,fund,attack} from './fixtures/simulator-audit.mjs';
const c={...pool.find(c=>c.number==='AUDIT-DUMMY'),number:'ID1-SPECIAL',tags:['#ID1期生']};const deck=[...pool,c];
for(const [owner,source,expected] of [[1,0,true],[1,1,false],[0,1,false]])test(`Iofi special owner ${owner} source ${source}`,()=>{let s=state();const p=s.players[owner];p.oshi=inst('hBP05-002');p.holoPower=[inst('AUDIT-DUMMY','power')];p.zones.back1=unit(c.number);p.zones.back2=unit(c.number);fund(p.zones.back1,['藍']);s.effectQueue=[{type:'specialDamage',playerIndex:source,targetPlayerIndex:owner,targetZone:'back1',amount:20,sourceName:'test'}];s=applyAction(s,0,attack,deck,()=>0);assert.equal(s.players[owner].zones.back1.damage,20);assert.equal(s.pendingChoice?.effect==='iofiDamagedUse',expected);});
