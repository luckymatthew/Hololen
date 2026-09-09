# hBP01-057～072 文字效果核對問題清單

日期：2026-09-06。這一批只做文字到引擎的 checking，沒有執行情境測試；已把核對無問題的欄位計入主 ledger。範圍是 16 張卡、20 個效果欄位。

本輪已把 8 張整卡無問題卡、11 個無問題效果欄位計入主進度：**207/1,276 張卡、336/1,746 個效果欄位**；剩餘 **1069 張卡、1410 個效果欄位**。本批有 **8 張問題卡、9 個問題效果欄位**，交給 Astra。hBP01-061、071、072 的其他欄位已單獨標記為無問題，但整卡仍待修。

## 交給 Astra 的問題卡

| 卡號 | 問題欄位 | 核對結果 |
|---|---|---|
| hBP01-059 | arts.1.effect | 支付手牌存檔成本後，通用 queueDeckToHand 預設 optional=true；有合法非 Buzz、1st Holomen 時仍可略過加入手牌。 |
| hBP01-061 | arts.0.effect | 手牌成本可選且 1～5 張的計算可進入通用餘效；但成本支付後，中心／合作目標沿用 queueSimpleTriggeredKeyword 的 optional=true，有合法目標仍可略過。 |
| hBP01-063 | keyword.effect | 中心 #トリ 條件及手牌成本可選；成本支付後的吉祥物搜尋仍使用 queueDeckToHand 預設 optional=true，有合法吉祥物時可略過。 |
| hBP01-065 | keyword.effect | queueGenericTopLook 以 Holomen 群組建立候選後仍令 min=0、optional=true；查看的 3 張中有合法 Holomen 時仍可略過，未符合必須公開 1 張加入手牌。 |
| hBP01-067 | arts.1.effect | 通用 Arts 只解析存檔區 Holomen 數量的 +10；引擎找不到 hBP01-067 的 6 張 Holomen 放回牌庫並洗牌處理。 |
| hBP01-070 | keyword.effect | 通用牌庫搜尋 queueDeckToHand 預設 optional=true；有合法粉絲牌時仍可略過，文字沒有「可以」。 |
| hBP01-070 | arts.0.effect | attack() 的 hBP01-070:0 斷言檢查攻擊者必須附有〈座員〉，與文字的「沒有〈座員〉」條件相反。 |
| hBP01-071 | extra | 擊倒流程及 Extra 觸發搜尋沒有 hBP01-071 的生命 -2 分支；倒下時只按一般生命減少處理。 |
| hBP01-072 | arts.0.effect | resolveDiceArtEffects 會在紅色應援條件成立時直接自動擲骰；「則可擲一次骰子」應先提供可選發動。 |

## 已核對、目前未見文字邏輯缺口

hBP01-057、hBP01-058、hBP01-060、hBP01-062、hBP01-064、hBP01-066、hBP01-068、hBP01-069；另 hBP01-061 的 keyword.effect、hBP01-071 的 keyword.effect／arts.0.effect、hBP01-072 的 extra 已單獨核對無問題。

程式檢查：lib/simulator/engine.mjs 沒有本輪修改；本批只更新 ledger、問題清單及進度摘要。沒有跑情境測試。
