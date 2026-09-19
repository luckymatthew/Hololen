// Synchronous, stack-scoped instrumentation. Policy probes are explicitly
// suspended, so only committed game entropy is retained in private diagnostics.
let frame=null;
function value(kind,source) {
 if(!frame)return source();
 if(frame.replay){const row=frame.tape[frame.index++];if(!row||row.kind!==kind)throw Error('Replay entropy mismatch: '+kind);return row.value;}
 const result=source();frame.tape.push({kind,value:result});return result;
}
export const gameUUID=()=>value('uuid',()=>crypto.randomUUID());
export const gameTime=()=>value('time',()=>Date.now());
export const gameRandom=source=>()=>value('random',source);
export const entropyTape=()=>frame?.tape||null;
export function withoutEntropy(fn){const old=frame;frame=null;try{return fn();}finally{frame=old;}}
export function captureEntropy(fn){const old=frame;frame={tape:[],index:0,replay:false};try{const result=fn();return {result,tape:frame.tape};}finally{frame=old;}}
export function replayEntropy(tape,fn){const old=frame;frame={tape,index:0,replay:true};try{const result=fn();if(frame.index!==tape.length)throw Error('Unused replay entropy');return result;}finally{frame=old;}}
