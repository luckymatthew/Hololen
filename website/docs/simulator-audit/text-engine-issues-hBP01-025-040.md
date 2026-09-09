# hBP01-025～040 文字效果核對問題清單

日期：2026-09-06。這一批只做文字到引擎的 checking，沒有執行情境測試；已把核對無問題的欄位計入主 ledger。範圍是 16 張卡、18 個效果欄位。

本輪已把 7 張整卡無問題卡、9 個無問題效果欄位計入主進度：**191/1,276 張卡、314/1,746 個效果欄位**；剩餘 **1,085 張卡、1,432 個效果欄位**。本批有 **9 張問題卡、9 個問題效果欄位**，交給 Astra 修改。hBP01-027、031、035、037、038 的其他欄位已各自標記為無問題，但整卡仍待修。

## 交給 Astra 的問題卡

| 卡號 | 問題欄位 | 核對結果 |
|---|---|---|
| hBP01-026 | keyword.effect | 牌庫搜尋預設可略過；有合法 #ID3期生、非 Buzz、Debut／1st 時應必選加入手牌並洗牌。 |
| hBP01-027 | extra | 找不到倒下時自身生命 -2 的 Extra 處理；目前只見 Gift 傷害反應。 |
| hBP01-031 | keyword.effect | Holo Power 為空時，牌庫頂 1 張放入 Holo Power 的後半句被整段跳過。 |
| hBP01-033 | keyword.effect | 可選骰子被自動擲；成功回復目標也可被預設略過。 |
| hBP01-035 | arts.0.effect | 應取艾爾／應援牌庫頂，現行通用流程搜尋整個牌庫；附加也可略過。 |
| hBP01-036 | keyword.effect | 「一位 Holomen 回復 20」有合法受傷目標時仍可略過，應為必選。 |
| hBP01-037 | keyword.effect | 附加應援後的 40 HP 回復固定回到 Bloom 發動者，應回復實際接收應援的 Holomen。 |
| hBP01-038 | arts.0.effect | 可選骰子被 resolveDiceArtEffects 自動擲。 |
| hBP01-039 | keyword.effect | 可選骰子被自動擲；成功後搜尋整個牌庫而非應援牌庫頂，附加也可略過。 |

## 已核對、目前未見文字邏輯缺口

hBP01-025、hBP01-028、hBP01-029、hBP01-030、hBP01-032、hBP01-034、hBP01-040；另 hBP01-027 的 keyword.effect／arts.0.effect、hBP01-031 的 arts.0.effect、hBP01-035 的 keyword.effect、hBP01-037 的 arts.0.effect、hBP01-038 的 extra 已單獨核對無問題。

程式檢查：lib/simulator/engine.mjs 沒有本輪修改；node --check 及 vinext build 通過。沒有跑情境測試。
