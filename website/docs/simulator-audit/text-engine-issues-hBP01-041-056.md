# hBP01-041～056 文字效果核對問題清單

日期：2026-09-06。這一批只做文字到引擎的 checking，沒有執行情境測試；已把核對無問題的欄位計入主 ledger。範圍是 16 張卡、19 個效果欄位。

本輪已把 8 張整卡無問題卡、11 個無問題效果欄位計入主進度：**199/1,276 張卡、325/1,746 個效果欄位**；剩餘 **1077 張卡、1421 個效果欄位**。本批有 **8 張問題卡、8 個問題效果欄位**，交給 Astra。hBP01-043、050、055 的其他欄位已單獨標記為無問題，但整卡仍待修。

## 交給 Astra 的問題卡

| 卡號 | 問題欄位 | 核對結果 |
|---|---|---|
| hBP01-041 | keyword.effect | 通用 eventCheerTarget 預設 optional=true；文字沒有「可以」，有應援牌庫頂及合法中央／合作目標時仍可略過附加。 |
| hBP01-042 | arts.1.effect | resolveDiceArtEffects 會直接自動擲骰；文字是可選骰子，玩家應可選擇不擲。骰子結果乘 10 的計算方向正確。 |
| hBP01-043 | arts.0.effect | 現行分支將 3 顆骰子的點數總和乘 10，應是只計算結果為 1 的骰子數量再乘 10；同時可選骰子被自動擲。 |
| hBP01-047 | keyword.effect | 專用 Bloom 分支在回復後無條件自動擲骰；「之後可以擲1次骰子」應先讓玩家選擇是否發動。奇數後的 1～3 張綠色應援選擇本身已有可選處理。 |
| hBP01-050 | arts.0.effect | 通用 eventCheerTarget 預設 optional=true；有牌庫頂應援及合法 #秘密結社holoX（排除風真いろは）目標時，文字要求附加但仍可略過。 |
| hBP01-051 | extra | 擊倒流程及現有 Extra 觸發搜尋沒有 hBP01-051 的生命 -2 分支；倒下時只會按一般生命減少處理。 |
| hBP01-054 | keyword.effect | 通用 eventCheerTarget 預設 optional=true；有牌庫頂應援及合法 #ID（排除 Iofi）目標時仍可略過，文字沒有「可以」。 |
| hBP01-055 | arts.0.effect | artConditionApplies 的舞台標籤條件只檢查是否存在 #ID，沒有套用「不是〈アイラニ・イオフィフティーン〉」排除名；舞台只有 Iofi 時也會錯誤加成。 |

## 已核對、目前未見文字邏輯缺口

hBP01-044、hBP01-045、hBP01-046、hBP01-048、hBP01-049、hBP01-052、hBP01-053、hBP01-056；另 hBP01-043 的 keyword.effect、hBP01-050 的 keyword.effect、hBP01-051 的 arts.0.effect、hBP01-055 的 keyword.effect 已單獨核對無問題。

程式檢查：lib/simulator/engine.mjs 沒有本輪修改；本批只更新 ledger、問題清單及進度摘要。沒有跑情境測試。
