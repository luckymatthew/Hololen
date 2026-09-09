import { glossary } from '@/lib/card-terminology.mjs';
import { effectAuditSummary } from '@/lib/effect-corrections.mjs';

export default function TerminologyNote() {
  return <details className="terminology-note">
    <summary>用語對照・翻譯說明</summary>
    <p>已逐句檢查 {effectAuditSummary.sentenceReviewed} 項效果，另有 {effectAuditSummary.exactTemplateChecked} 項按完整日文句型核對。{effectAuditSummary.completeCards} 個卡號通過完整效果及數值核對；仍有 {effectAuditSummary.rulingPending} 項待裁定、{effectAuditSummary.unreviewedEffects} 項缺官方日文。聲援共通規則另列，部分異圖卡號身份未核實。</p>
    <dl>{glossary.map(([original, chinese]) => <div key={original}><dt>{original}</dt><dd>{chinese}</dd></div>)}</dl>
    <p>「公開」與「查看」、「可以」與「必須」、傷害與特殊傷害保留原有區別。卡名及技能名不作批量改寫。正式效果以日文原文及官方裁定為準。</p>
    <p>用語參考：<a href="https://tetsunekko.github.io/holotcgtw/" target="_blank" rel="noopener noreferrer">HoloTCG 繁中</a>；本頁並非該站提供或審核的譯文。</p>
  </details>;
}
