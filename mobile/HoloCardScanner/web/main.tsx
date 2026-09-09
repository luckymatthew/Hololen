import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Home from './app/page';
import AccountClient from './app/account/AccountClient';
import StudioIcon from './app/StudioIcon';

type Saved = {id:string; name:string; deck:{oshi:Record<string,number>;main:Record<string,number>;cheer:Record<string,number>};updatedAt:number};

function LocalDecks() {
  const [decks,setDecks] = useState<Saved[]>(() => {try{return JSON.parse(localStorage.getItem('hololive-ocg-local-decks')||'[]');}catch{return [];}});
  const count=(part:Record<string,number>)=>Object.values(part).reduce((a,b)=>a+b,0);
  return <section className="pocket-local-library"><h1>本機牌組</h1><p>儲存在呢部手機，毋須登入。重要牌組請另行匯出備份。</p>
    {decks.length===0?<div className="pocket-empty"><StudioIcon name="deck"/><h2>第一副牌，由你組起。</h2><a href="/#deck">前往牌組工房</a></div>:decks.map(d=><article className="pocket-saved" key={d.id}><div><small>{new Date(d.updatedAt).toLocaleDateString('zh-HK')}</small><h2>{d.name}</h2><p>推し {count(d.deck.oshi)} · 主牌 {count(d.deck.main)} · 應援 {count(d.deck.cheer)}</p></div><div className="pocket-saved-actions"><a href={`/?localDeck=${encodeURIComponent(d.id)}#deck`}>編輯牌組</a><button onClick={()=>{if(!confirm(`刪除「${d.name}」？呢個動作無法復原，請先匯出備份。`))return;const next=decks.filter(x=>x.id!==d.id);try{localStorage.setItem('hololive-ocg-local-decks',JSON.stringify(next));setDecks(next);}catch{alert('刪除失敗，原有牌組已保留。');}}}>刪除</button></div></article>)}
  </section>;
}

function App() {
  const [route,setRoute]=useState(location.hash==='#account'?'account':location.hash==='#deck'?'deck':'library');
  const [cloud,setCloud]=useState(new URLSearchParams(location.search).has('return_to'));
  useEffect(()=>{
    const change=()=>{setRoute(location.hash==='#account'?'account':location.hash==='#deck'?'deck':'library');window.scrollTo(0,0);};
    window.addEventListener('hashchange',change);
    const links=(event:MouseEvent)=>{
      const link=(event.target as HTMLElement).closest('a');if(!link)return;
      const url=new URL(link.href,location.href);
      if(url.origin===location.origin&&url.pathname==='/account'){event.preventDefault();location.hash='account';}
      else if(url.origin!==location.origin&&url.protocol==='https:'&&window.HoloNative){event.preventDefault();window.HoloNative.openExternal(url.href);}
    };
    document.addEventListener('click',links);
    window.__holoBack=()=>{
      const dialog=document.querySelector('dialog[open]');
      if(dialog){dialog.dispatchEvent(new Event('cancel',{cancelable:true}));return true;}
      if(location.hash&&location.hash!=='#library'){location.hash='library';return true;}
      return false;
    };
    return ()=>{window.removeEventListener('hashchange',change);document.removeEventListener('click',links);};
  },[]);
  const scan=()=>{
    if(route==='account') {location.hash='library';setTimeout(()=>document.querySelector<HTMLButtonElement>('.studio-masthead .studio-primary')?.click(),100);}
    else {location.hash='library';setTimeout(()=>document.querySelector<HTMLButtonElement>('.studio-masthead .studio-primary')?.click(),100);}
  };
  return <>
    {route==='account'?<><header className="pocket-account-head"><h2>我的牌組</h2><span>POCKET LAB</span></header><div className="pocket-account-tabs"><button aria-pressed={!cloud} onClick={()=>setCloud(false)}>本機牌組</button><button aria-pressed={cloud} onClick={()=>setCloud(true)}>帳號與雲端</button></div>{cloud?<AccountClient/>:<LocalDecks/>}</>:<Home/>}
    <nav className="pocket-dock" aria-label="App 主要功能">
      <a href="#library" aria-current={route==='library'?'page':undefined}><StudioIcon name="grid"/><span>卡庫</span></a>
      <button className="pocket-scan" onClick={scan}><StudioIcon name="scan"/><span>掃卡</span></button>
      <a href="#deck" aria-current={route==='deck'?'page':undefined}><StudioIcon name="deck"/><span>組牌</span></a>
      <a href="#account" aria-current={route==='account'?'page':undefined}><StudioIcon name="list"/><span>我的牌組</span></a>
    </nav>
  </>;
}

const theme=localStorage.getItem('hololive-ocg-theme');if(theme==='light'||theme==='dark')document.documentElement.dataset.theme=theme;
createRoot(document.getElementById('root')!).render(<App/>);
