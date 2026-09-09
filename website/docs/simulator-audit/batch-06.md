# 第六批：琉依替代手牌存檔及有條件藝能加傷

日期：2026-09-05。狀態：本機修正及驗證，尚未發佈。

## 實際改動

- hBP01-005 一般推し接入通用紅色 Holomem 的手牌存檔成本與既有專用藝能成本。一次支付可以混合手牌及 Holo Power；可以完全用 Holo Power，數量不受現有手牌數限制，但不得超過原能力的上限。使用藝能時按實際使用者的卡色判斷，不能單以借用的藝能卡色判斷。
- Holo Power 從最新一張開始存檔。選擇支付方案後，先完成手牌選擇才一起確認支付；重新檢查手牌、Holo Power 和每回合使用限制。取消可選成本不扣費、不消耗推し次數，也不取得條件收益。所有待決資料可經 JSON 儲存再繼續。
- hBP01-062、hBP06-042 原本略過手牌成本仍套用固定 +20，現在只在完整支付後加傷。
- hBP06-042 的 Bloom 原本只抽牌，漏了先存檔一張手牌。現在先處理手牌存檔，再抽一張；沒有手牌時仍可繼續後段抽牌，也不會被強迫使用琉依。
- hBP06-041 的 GYM RAT 在抽三張之後，接入兩張手牌存檔的混合支付。
- 對手看到的待決狀態不含手牌資料；支付方案不公開背面 Holo Power 的內容。手機 App 未改動。

## 官方依據及推論邊界

- [hBP01-005 官方卡表](https://hololive-official-cardgame.com/cardlist/?id=30)：Q34 允許混合區域支付；Q35 允許超過手牌數量的 Holo Power 支付。一般推し限定自己的紅色 Holomem 能力及每回合一次。本批不驗證其 SP 技能。
- [hBP01-062 官方卡表](https://hololive-official-cardgame.com/cardlist/?%2Fcardlist%2Fcardsearch=&id=99&keyword=%23EN&view=text)：+20 以支付一張手牌存檔為前提。
- [hBP01-061 官方卡表及 Q84](https://hololive-official-cardgame.com/cardlist/?faq=&id=2520)：可存檔一至五張，每張造成二十特殊傷害；可不支付。
- [hBP01-060 官方卡表](https://hololive-official-cardgame.com/cardlist/?id=97)：由 Debut Bloom，支付一張手牌後抽兩張。
- [hBP01-063 官方卡表](https://hololive-official-cardgame.com/cardlist/?%2Fcardlist%2Fcardsearch=&id=100&keyword=%23EN&view=text)：中央的 #トリ 條件、手牌成本、吉祥物搜尋。
- [官方貝爾絲卡表](https://hololive-official-cardgame.com/cardlist/cardsearch/?keyword=%E3%83%8F%E3%82%B3%E3%82%B9&view=text)：hBP06-042 的存檔後抽牌與兩張成本 +20；hBP06-041 的後攻首回合抽三後存檔二。
- [綜合規則 1.9.0](https://hololive-official-cardgame.com/wp-content/themes/tcg/assets/img/rule/whole_rule_ver190.pdf)：1.3.2 無法全部執行時盡可能執行；10.11.4 允許以可執行的替代處理完成原本不能支付的動作；5.27.1.1 借用藝能由實際使用者執行。

## 測試與證據

測試檔：`tests/simulator-lui-payment-audit.test.mjs`，25 項情境。

同一份 25 項測試搭配原引擎有 17 項失敗，修正後全部通過。完整回歸 517 項通過；基礎傷害／特攻 6,643 案例、無附加效果藝能 483 案例通過。Windows 建置成功。逐卡盤點仍有 1,276 卡號、1,746 效果欄位；具局部情境證據增至 84 卡，完整行為已驗證仍為 0 卡。

涵蓋：空手牌替代、混合支付、四張 Holo Power 對一張手牌、一次／兩次事件、下一回合重新開窗、費用不足、非法支付選項、延遲確認時費用消失、取消、非紅色來源、不同推し、公開狀態、Bloom 支付後抽牌、聯動條件及完整搜尋、必要存檔時序、無手牌時的後段效果。

- `batch-06-before.log`：同一份新測試搭配匯出 ZIP 的原引擎。沒有修改正在開發的引擎來製造基線。
- `batch-06-after.log`：本批測試結果。
- `batch-06-regression.log`：完整 simulator／oshi 回歸結果。
- `batch-06-build.log`：Windows 直接 vinext 建置結果。
- `scenario-evidence.json` 與重新產生的 `ledger.json`：逐欄限定情境證據。

## 未完成範圍

所有新增記錄仍是局部情境，不能宣稱任一卡完整驗證或全庫正確。

1. 琉依尚需逐一檢查其他專用手牌存檔路徑、全部手牌存檔、指定手牌性質、改色後的來源、複合觸發、借用藝能實卡情境及 SP 移動鎖的生效期間。通用程式分支存在不代表每張實卡已通過。
2. hBP02-102：已讀[官方卡表](https://hololive-official-cardgame.com/cardlist/?id=369)及[FAQ Q227](https://hololive-official-cardgame.com/rules/question/faq/)。Q227 區分傷害即將發生與已實際受傷，尚未完成原始零傷害、被動減至零、反應減至零、免傷與多種防禦同時處理的證據鏈；本批沒有改動或認證這張卡。現有 `prepareAttachmentDamageReaction` 會無條件存檔它，應繼續建立測試，不能直接把它移到受傷後處理。
3. 多目標含選擇的 damageBatchId、同時擊倒與 Q370、其他逐卡欄位仍持續待查。

公開網站尚為 Version 60，沒有把本機測試當成已發佈更新。
