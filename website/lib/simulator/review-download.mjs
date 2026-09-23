import { exportFiles } from './battle-diagnostics.mjs';
function crc32(bytes) { let crc = -1; for (const byte of bytes) { crc ^= byte; for (let i=0;i<8;i++) crc=(crc>>>1)^((crc&1)?0xedb88320:0); } return (crc ^ -1) >>> 0; }
// Small uncompressed ZIP writer: UTF-8 names, bounded allowlisted JSON/text only.
export function reviewZip(files) {
  const allowed=new Set(['match.json','ai-review.json','manifest.json','README.txt']);
  const chunks=[],central=[];let offset=0;
  for(const [name,text] of Object.entries(files)) {
    if(!allowed.has(name)||typeof text!=='string'||text.length>16*1024*1024)throw Error('Invalid battle export entry');
    const n=new TextEncoder().encode(name),data=new TextEncoder().encode(text),crc=crc32(data);
    const head=new Uint8Array(30+n.length),v=new DataView(head.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,n.length,true);head.set(n,30);
    const c=new Uint8Array(46+n.length),cv=new DataView(c.buffer);
    cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,n.length,true);cv.setUint32(42,offset,true);c.set(n,46);
    chunks.push(head,data);central.push(c);offset+=head.length+data.length;
  }
  const end=new Uint8Array(22),ev=new DataView(end.buffer),size=central.reduce((n,c)=>n+c.length,0);
  ev.setUint32(0,0x06054b50,true);ev.setUint16(8,central.length,true);ev.setUint16(10,central.length,true);ev.setUint32(12,size,true);ev.setUint32(16,offset,true);
  const bytes=new Uint8Array(offset+size+22);let at=0;for(const c of [...chunks,...central,end]){bytes.set(c,at);at+=c.length;}return bytes;
}
export function downloadReview(saved,format='zip') {
  const files=exportFiles(saved);
  const blob=format==='zip'?new Blob([reviewZip(files)],{type:'application/zip'}):new Blob([files['ai-review.json']],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=format==='zip'?'Holo-Arcana-BattleLog.zip':'ai-review.json';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
