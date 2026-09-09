# 第八批：波爾卡存檔回收及藝能傷害

日期：2026-09-05。本機修正，尚未發佈。

## 發現與修正

hBP05-034 的中央 Bloom 原本把存檔手牌數限制為現有座員數，導致不能多付、沒有座員時不能支付、不能先存檔手上座員再回收。本批移除此錯誤限制，並接入琉依 hBP01-005 的手牌／Holo Power 混合代付。回收候選在支付完成後取得，依總支付數強制回收足夠數量，若不足則全部回收。修正提示中錯誤的技能名稱，使用「おまたせ～！」。

## 官方依據

- [官方卡表：hBP05-034](https://hololive-official-cardgame.com/cardlist/cardsearch/?%2Fcardlist%2Fcardsearch=&keyword=%235%E6%9C%9F%E7%94%9F&view=text)：中央限定、任意張數手牌存檔、每張回收座員；藝能 110，推し為波爾卡時每十張存檔 +30。
- [官方 Q449／Q450](https://hololive-official-cardgame.com/cardlist/?expansion=hPR&id=857&view=image)：可存檔超過現有座員數的手牌；支付四張且有四張座員時必須全數回收。
- [琉依 Q34／Q35](https://hololive-official-cardgame.com/cardlist/?id=30)：紅色 Holomem 能力存檔手牌可替代，允許混合支付與超過手牌數的 Holo Power。
- [官方波爾卡牌組說明](https://hololive-official-cardgame.com/deck/hbp05_003/)：存檔的應援也計入藝能每十張的加傷。

## 驗證

`tests/simulator-polka-return-audit.test.mjs` 21 項：修正前 16 過／5 失敗，修正後全過。包含沒有座員、多付、支付手上座員再回收、強制完整回收、取消、後排／聯動不觸發、空手牌代付、混合代付、JSON 待決存續。藝能核對 0／9／10／19／20／30 張、波爾卡／琉依推し兩種條件；應援與 Holomem 都計入存檔總数。

完整回歸 552 項通過，Windows vinext 建置成功。記錄在 `batch-08-before.log`、`batch-08-after.log`、`batch-08-regression.log`、`batch-08-build.log`。

逐卡工具改為自動讀取所有 simulator 測試檔，避免新增批次遺漏在「測試曾提及」欄位；該欄仍不代表行為正確。場景證據與 ledger 仍只標局部驗證，不將 hBP05-034 或琉依標成完整通過。

## 後續

琉依改色及其他專用支付路徑、多目標傷害和擊倒時序仍待查。hBP02-102 零傷害時序仍無充分裁定，不更改其未認證狀態。手機 App 未改動。
