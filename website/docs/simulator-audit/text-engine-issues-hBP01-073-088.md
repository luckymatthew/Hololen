# hBP01-073～088 文字效果核對問題清單

日期：2026-09-06。這一批只做文字到引擎的 checking，沒有執行情境測試；已把核對無問題的欄位計入主 ledger。範圍是 16 張卡、17 個效果欄位。

本輪已把 10 張整卡無問題卡、11 個無問題效果欄位計入主進度：**217/1,276 張卡、347/1,746 個效果欄位**；剩餘 **1059 張卡、1399 個效果欄位**。本批有 **6 張問題卡、6 個問題效果欄位**，交給 Astra。hBP01-076、088 的 Extra／其他欄位已單獨標記為無問題，但整卡仍待修。

## 交給 Astra 的問題卡

| 卡號 | 問題欄位 | 核對結果 |
|---|---|---|
| hBP01-076 | arts.0.effect | 通用後排特殊傷害分支把 stageTarget 設成 optional=true；有對手後排時，文字要求選 1 位但仍可略過。 |
| hBP01-079 | keyword.effect | 通用後排特殊傷害分支把目標設成 optional=true；有合法對手後排時仍可略過，文字沒有「可以」。 |
| hBP01-080 | keyword.effect | 專用 hBP01-080 分支在發動合作效果時直接自動擲骰；奇數後的倒下目標也設成 optional=true，但文字只把骰子寫成可選，成功後有合法目標應執行。 |
| hBP01-081 | keyword.effect | 通用 eventCheerTarget 預設 optional=true；有牌庫頂應援及合法藍色 Holomen 時仍可略過附加，文字沒有「可以」。 |
| hBP01-083 | keyword.effect | 通用 simpleKeywordCondition 會自動擲骰，沒有文字中的可選發動；成功後 eventCheerTarget 仍預設 optional=true，有合法 Holomen 時可略過牌庫頂附加。 |
| hBP01-088 | arts.0.effect | resolveDiceArtEffects 的 hBP01-088:0 直接自動擲骰；文字是可選骰子，玩家應能選擇不擲。偶數後的後排目標已是必選。 |

## 已核對、目前未見文字邏輯缺口

hBP01-073、hBP01-074、hBP01-075、hBP01-077、hBP01-078、hBP01-082、hBP01-084、hBP01-085、hBP01-086、hBP01-087；另 hBP01-076 的 extra、hBP01-088 的 extra 已按欄位核對；hBP01-080 沒有其他效果欄位。

程式檢查：lib/simulator/engine.mjs 沒有本輪修改；本批只更新 ledger、問題清單及進度摘要。沒有跑情境測試。
