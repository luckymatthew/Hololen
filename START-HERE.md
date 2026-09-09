# Hololive OCG — Codex 接手說明

匯出日期：2026-09-05。請先讀本檔，再讀 website/docs/simulator-audit/batch-05.md。本檔及最新程式狀態優先於舊移交全文。

## 立即接手任務

用戶要求「逐卡校對模擬器的效果和傷害」，目前進行到第五批。要繼續核對實際遊戲狀態結算，不是只修改繁中顯示文字。先讀逐卡 ledger 及 scenario-evidence，再按官方日文／裁定建立可重現正反測試、修正、更新證據。不要因有程式分支或一個案例通過就標記全卡正確。

## 檔案配置

- website/：網站完整 Git HEAD 原始碼，包含卡庫、模擬器、API、鎖定依賴、建置設定、測試及校對記錄；沒有 node_modules 或部署產物。
- mobile/HoloCardScanner/：先前交付的 0.2.2 Android／iOS 原始碼。App 已排除 PvP 及單人 AI 模擬器；網站則保留對戰。不能將網站模擬器更新誤稱為 App 的對戰更新。
- reference/effect-audit/：官方日文快照、逐欄比對與文字校對決策、報告及腳本。它是特定時間的參考，不保證反映後續官方更正。
- reference/Original-Conversation-2026-08-31.txt：使用者提供的舊完整移交原文，原樣保留。當中 Version 43 及待辦是歷史狀態，不能覆蓋本檔 Version 60。
- CODEX-START-PROMPT.txt：可直接貼給接手 Codex 的指令。
- MANIFEST.json：匯出檔案大小及 SHA-256。

本次沒有匯出完整新對話逐字稿；最新階段以本接手摘要、實際程式與測試紀錄保存。亦沒有匯出正式環境帳戶／牌組資料庫、認證憑證、簽署金鑰或完整 Git 歷史。不要將本包視為正式資料庫備份。

## 最新網站與版本

公開網站：https://hololive-ocg-zh-deck-studio.matthewmelia.chatgpt.site
模擬器：同網址 /simulator
Sites project_id：appgprj_6a5b4b7573c08191941f11accf4cdb3e
已部署 Version：60（第五批，部署成功）
原始碼 commit：63c811b119e52688da44f2e7213a4260d1c0a9c7
version_id：appgprj_6a5b4b7573c08191941f11accf4cdb3e~appgver_ef525027525c8191be60da6638b7f676
部署 ID：appgdep_6a9c0f13a5e88191aba045605772853a

網站目前為公開。先前已獲用戶授權檢查通過後發佈；本次匯出沒有再次修改或發佈網站。若接手環境有 Sites，重用 website/.openai/hosting.json 既有 project_id，不要重建另一網站。若沒有 Sites，仍可本機開發及测试，但本包不附帶生產部署權限；不要假設本機 Git push 會自動更新網站，也不要將含 API 的網站當作純 GitHub Pages 靜態網頁。

## 已驗證數字與限制

- 全庫盤點：1,276 個卡號、1,746 個效果欄位。
- 完整行為已驗證卡號：0；具有限定情境證據：77。
- 第五批新增 21 個情境；舊引擎有 12 個失敗，修正後全過。
- 最新完整 simulator／oshi 回歸：492 項通過。
- 基礎傷害／特攻：6,643 案例；無附加效果藝能：483 案例通過。
- 上述基礎案例及限定情境不是完整逐卡驗證，不可宣稱 100% 正確。
- 已在原 Linux 環境通過建置、測試及部署；此次匯出未重新在 Mac 完整安裝及建置。

## 五批模擬器校對重點

1. 第一批：hBP01-070 座員條件判反、後備免傷角色／階級條件、略過仍減傷、位置減傷、不可減輕傷害等。
2. 第二批：反應推し費用／次數、零傷害不觸發、受傷後存檔、擊倒後反擊、多張ルーナイト逐張支付、加減傷合計後取零。
3. 第三批：最上層 Buzz 被擊倒扣 2 點生命；Polka／Marine 的失去生命減少條件；Luna Gift 改附代替ルーナイト存檔，包含自付減傷及擊倒限定場景。
4. 第四批：藝能附帶特殊傷害及藝能本體完成後才檢查擊倒；目標選擇續接順序；Fauna 受傷回血不能救回已擊倒來源；Iroha 待機 Holo Power 與最後生命。
5. 第五批：Subaru hBP04-006 同一次多目標傷害只付一次成本，全體符合條件的昴各減 30；略過不重複提示；不同事件不共享減傷；不可減輕傷害不受影響。實卡情境包括 hSD09-004、hBP06-006、hBP07-081 配 hBP07-103。

完整範圍／官方來源／未完成項目以 website/docs/simulator-audit/batch-02.md 至 batch-05.md、scenario-evidence.json 及 ledger.json 為準。README 下半部是第一批歷史紀錄，部分待辦已在後批處理。

## 下一步優先次序

1. hBP01-005：X 費用替代手牌存檔。目前費用目錄正確，實際完整反應未接入。
2. hBP02-102：「受到傷害時」的前置存檔，核對原始零傷害、減至零及 Q227。
3. 多目標中仍含選擇的事件（中央＋選擇後備、多選後備）是否應共享 damageBatchId；不要把先後兩段效果錯當同時。
4. 完整同時多目標傷害、多重擊倒、雙方觸發優先序（Q370）；同一目標先受致命特殊傷害再受藝能傷害的擊倒來源歸屬尚未核實。
5. 其他受傷／造成傷害後效果，尤其即時抽牌／狀態變更；多來源生命減免疊加、Luna 其他存檔來源及多重擊倒。
6. 依 ledger 逐個欄位補觸發／不觸發、費用不足、合法／非法目標、目標消失、區域、每回合／每局限制、結算次序及交互情境。

文字校對另有未決 hSD13-015、hSD18-004、hBP09-037 及未核實異圖聲援；保留待查，不以 AI 翻譯填補規則證據。之前文字校對報告的「1,260 卡」不可套用到模擬器行為驗證。

## 程式定位與注意事項

主引擎：website/lib/simulator/engine.mjs。
全卡盤點：website/scripts/audit-simulator.mjs。
官方抓取：website/scripts/fetch-official-audit.py。
證據：website/docs/simulator-audit/。
測試：website/tests/simulator*.test.mjs 及 oshi-skill-regression.test.mjs。

引擎已有部分按中文句型辨識效果的路徑，改譯文可能影響規則，必須分離顯示與結算。正常 attack 使用可序列化 artsResolution 邊界，在 ability 期間插入後續選擇、完成傷害後處理累積擊倒。第五批新增 damageBatchId，queueFixedSpecialDamage、原生分割藝能及 Moona 使用同事件識別；兩個獨立事件必須不同 ID。反應判斷與支付都要核對成本及次數，禁止免費觸發。不要破壞 JSON 儲存／同步、實例 ID、匿名單機、本機牌組、揭示双方可見及手機狀態面板。

用戶重視：繁中／廣東話介面、Logs 卡號＋稀有度、正確異圖、手機直向可玩、手牌可收合、動作按鈕不被遮擋、狀態面板與桌面一致；不要回復以前黑畫面或卡圖錯配問題。

## 在 Codex／Mac 開啟

解壓本包後，在 Codex 選擇本包的 website 資料夾為專案，並附上本檔或貼上 CODEX-START-PROMPT.txt。也可選整個匯出根目錄，明確指定 website 為目前工作目錄。

網站 package.json 要求 Node.js >=22.13.0；建議使用 Node 22 LTS。依 package-lock.json 安裝：

```sh
cd website
npm ci
node --test tests/simulator*.test.mjs tests/oshi-skill-regression.test.mjs
node scripts/audit-simulator.mjs
npm run dev
```

以終端機列出的本機 URL 開啟。上述 simulator 測試是當前範圍的主驗證指令；npm test 自身列出的測試檔較少，不可當作替代完整 audit 回歸。

原建置／install:ci 腳本使用 Linux GNU timeout／flock；Mac 不要直接假設 npm run build 或 install:ci 可用。安裝可先用 npm ci；本機建置可嘗試 `npx vinext build`，此直接方式尚未在你的 Mac 驗證，若報錯先保留完整第一個錯誤再修正。Linux 原流程為 `npm run build`。開發伺服器／本機 D1 並不會自帶正式帳戶或雲端牌組；登入／房間資料功能要另處理本機資料及遷移。

ZIP 沒有 Git 歷史。若要本機版本管理，可在 website 執行 `git init`、`git add .`、`git commit -m "Import Hololive OCG version 60"`；此為新本機 commit，不能冒稱原 Sites SHA。原 SHA 已記在本檔以便對照。

## 手機 App

手機來源為已交付 0.2.2，包含掃卡、繁中卡庫、組牌、本機／雲端牌組及 JSON 匯入匯出；1x／2x、點按對焦、官方原圖快取已在先前版本加入。參閱 mobile/HoloCardScanner/README.md 及 INSTALL-0.2-zh-HK.md。

iOS 尚未在此環境完成 Xcode 編譯／真機验证／TestFlight 上傳；用戶有 Mac、iPhone 16 及 Apple 開發者帳號。prepare-ios.py 會重新產生專案設定，簽署設定後不要無意重跑。Apple 簽署須由用戶自己帳號處理，不要求提供密碼。

Android 0.2.x 曾沿用同一新簽署；更早測試版金鑰遺失，所以 0.2 可與舊版並存。此匯出不包含私密簽署檔，重新建置的 APK 不一定能直接覆蓋已安裝版本；先保留本機牌組完整備份。此包提供原始碼，不是新的 APK 或 IPA 交付。
