import { useEffect, useState } from 'react';

export default function CardScanner({ onClose, onPick }: {cards: unknown[]; onClose:()=>void; onPick:(number:string)=>void}) {
  const [error, setError] = useState('');
  useEffect(() => {
    const result = (event: Event) => {
      const data = (event as CustomEvent).detail;
      if (data.number) onPick(data.number); else onClose();
    };
    window.addEventListener('native-scan', result);
    if (window.HoloNative) window.HoloNative.startScanner();
    else setError('請在 Holo Pocket Lab App 內開啟原生掃卡。');
    return () => window.removeEventListener('native-scan', result);
  }, []);
  return error ? <div className="native-scan-error" role="alert"><p>{error}</p><button onClick={onClose}>返回卡庫</button></div> : null;
}
