# 模擬器逐卡校對：第三批

日期：2026-09-05。完整逐卡效果校對仍未完成。

本批新增 217 個限定情境測試：ルーナイト 24 項、Buzz／生命減免 193 項。相同測試套用本批修正前引擎共 138 項失敗，修正後全部通過。相關回歸 410 項通過，全部 simulator 測試加推し回歸共 443 項通過。原有 6,643 個隔離技能基礎傷害案例及 483 個無附加效果藝能案例亦重新通過。

## 已確認修正

| 卡號／範圍 | 修正及測試範圍 |
|---|---|
| 55 個 Buzz 卡號 | 原本通用擊倒僅扣 1 點；現在按最上層 Buzz 卡扣 2 點。每張測試藝能擊倒、特殊傷害擊倒、明示不減生命的特殊傷害。這些案例隔離其他技能，只驗證 Extra 的生命規則。 |
| hBP07-044 | 尾丸ポルカ Gift 為減少失去生命 1 點，非完全免扣：符合條件的 Buzz 由扣 2 變扣 1。測試聯動來源、後備來源不適用、錯誤推し、無粉絲、自己回合。中央來源及多來源疊加仍待獨立情境。 |
| hSD09-007 | 寶鐘瑪琳 Gift 補查聯動位置；自身生命必須少於對手、且在對手回合。測試中央／聯動、生命 4 對 5／5 對 5、自己回合，兩種傷害。 |
| hBP06-030、hBP03-105 | ルーナイト支付自身減傷費用時可改附代替存檔，減傷仍生效；擊倒改附改為可選。涵蓋改附、略過、三張分別改附／存檔、拒付保留、無目標、錯誤 Gift 位置及非中央來源、自己回合、非法改附目標。 |

生命邊界另驗證剩 1／2／3 點生命、每張公開生命聲援只附加一次，以及非 Buzz 最上層即使下方疊有 Buzz 仍只扣 1 點。

## 官方依據

- [官方 FAQ Q196](https://hololive-official-cardgame.com/rules/question/faq/)：Buzz 的 2 點取代通常的 1 點，不是合計 3 點。
- [hBP06-030，Q520／修正版 Q521](https://hololive-official-cardgame.com/cardlist/?id=1507&view=text)：自身能力存檔及擊倒存檔均可套用改附。2026-09-05 重新讀取官方頁面核對。
- [hBP07-044](https://hololive-official-cardgame.com/cardlist/?id=1830&view=text)、[hSD09-007](https://hololive-official-cardgame.com/cardlist/?id=1153&view=text)：按上一輪官方日文快照核對位置、生命比較及減少 1 點。
- 各 Buzz 卡的官方頁面見 `scenario-evidence.json` 中逐卡的 `sourceUrl`。本批沒有把基礎場景通過當成所有技能或所有連鎖已驗證。

## 重現與進度

```sh
node --test tests/simulator-lunaite-audit.test.mjs tests/simulator-buzz-life-audit.test.mjs
node --test tests/simulator*.test.mjs tests/oshi-skill-regression.test.mjs
node scripts/audit-simulator.mjs
```

- `batch-03-before.log`、`batch-03-buzz-before.log`：修正前重現。
- `batch-03-regression.log`：410 項相關回歸。
- `scenario-evidence.json`、`ledger.json`：目前 71 個卡號有明確限定情境證據；完整行為已驗證仍為 0 張。

## 仍需接續

- hBP01-005：X 費用替代手牌存檔。
- hBP04-006：同次多目標傷害的一次性群體減傷。
- hBP02-102：「受到傷害時」與零傷害／減傷時機。已讀官方卡文與 Q227，但未由本批更動或標成驗證完成。
- 一般受傷 Gift 的回復／抽牌與擊倒優先序；Q538 提醒藝能能力特殊傷害與藝能本體需完整處理後才處理擊倒，現有引擎仍需專項驗證。
- 多個減少生命／額外生命效果同時存在、最後生命與其他待機效果優先序。
- hBP06-030 其他存檔來源及多重擊倒；本批只有表列的自身減傷支付與單一擊倒情境。
- 其餘 1,746 個效果欄位的費用、合法目標、次數、區域與完整連鎖情境。
