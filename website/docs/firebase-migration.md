# Firebase 遷移交付與驗證

2026-09-09。請同時參閱根目錄 README 的可執行命令、部署狀態與手動步驟。

## 1. 已實作的架構

現有 React 元件和遊戲引擎被重用，Firebase build 透過獨立 Vite SPA 入口及 `appFetch` adapter 連接 Firebase SDK。原 Sites build 的 vinext／Cloudflare Worker／D1 API 仍保留。免費 Firebase Hosting 不執行 Next server route，因此不是把原 server routes 直接丟到靜態 Hosting。

```text
Browser → Firebase Hosting (SPA / static card JSON)
        → Firebase Auth (Google / email / anonymous rooms)
        → Firestore users/{uid} (saved decks / settings / collection contract)
        → RTDB rooms/{code} (participant views / actions / presence)
        → GitHub Releases (APK binary / public metadata)

Local AI → existing engine + localStorage, no database writes
Android / iOS → future shared Firebase UID and JSON contract
```

## 2. 新增檔案

主要新增範圍如下，完整差異見 `migration-files.json`：

- `lib/firebase/client.ts`：集中 Web config、Auth 及模擬器初始化、登入錯誤訊息。
- `lib/firebase/store.ts`、`merge.mjs`：UID 本機隔離、草稿保留、Firestore 交易、衝突保留、備份／還原、設定與收藏契約。
- `lib/firebase/pvp.ts`：RTDB 私人房間、既有引擎結算、玩家視圖、命令版本、防重複、presence、重連、到期清理；本機 AI。
- `lib/backend.ts`：原 API 呼叫到 Firebase 的相容 adapter。
- `firebase/`、`vite.firebase.config.ts`：SPA 入口、連結相容層、獨立 Firebase build、版本化 service worker。
- `firebase.json`、`.firebaserc`、`.env.example`、`.env.emulator`、`firestore.rules`、`firestore.indexes.json`、`database.rules.json`。
- `app/account/FirebaseAccount.tsx`、`app/download/DownloadClient.tsx`、`app/firebase.css`、`lib/releases.mjs`。
- `scripts/check-firebase-build.mjs`、`test-integration.mjs`、`test-regression.mjs`；Firebase／Release 測試與有效牌組 fixture。
- 根 README、本報告、`.github/workflows/android-release.yml`。

## 3. 修改檔案

`app/page.tsx`、`app/account/AccountClient.tsx`、`app/simulator/SimulatorClient.tsx` 接入 adapter；保留原畫面與遊戲互動。`ThemeToggle.tsx` 保存帳號偏好。修正原 Simulator route／元件的少量 TypeScript 推斷錯誤。`vite.config.ts` 固定舊建置使用 Sites；`package.json`／lock 新增 SDK、命令與測試工具。Android `app/build.gradle` 增加環境變數式正式簽署及版本輸入，不改既有手機功能。

`lib/simulator/engine.mjs`、`ai.mjs`、靜態卡庫與圖片資料維持原內容。沒有任意改名或移除原 hosting configuration。

## 4. Firebase 服務

Hosting、Authentication、Firestore Standard、Realtime Database。沒有部署 Functions、Cloud Run、Storage、Analytics 或付費服務。Firebase 公開 client config 集中在 `.env.local`，正式 package 不包含 Admin SDK credentials。

## 5. Firestore schema

```json
{
  "id": "uuid",
  "name": "我的牌組",
  "deck": {
    "oshi": {"hBP01-001": 1},
    "main": {"hBP01-010": 4},
    "cheer": {"hY01-001": 20},
    "printings": {"hBP01-010": {"variant-id": 4}}
  },
  "createdAt": 1788912000000,
  "updatedAt": 1788912000000,
  "schemaVersion": 1,
  "revision": 1,
  "archived": false
}
```

上面是格式例子，不是完整合法對戰牌組。路徑 `users/{uid}/decks/{id}`，一副一文件，數量以 map 保存而非每卡一文件。原資料的 notes、tags、縮圖及額外欄位可保留；目前原網頁主要包含名稱、deck、printings 及時間。timestamp 為 Unix 毫秒整數，供多平台使用。

`users/{uid}/data/settings` 與 `collection` 為 `{id, value: {...}, createdAt, updatedAt, schemaVersion}`。settings 已整合外觀；原網站没有完整收藏管理介面，所以 collection 提供儲存／同步契約，不假裝新增了收藏 UI。衝突文件使用 `~` 加 24 位 digest；備份匯入保留不同設定版本。

本機 `_dirty/_base/_change` 僅用同步，不寫入雲端。UID 區分本機牌組／資料／草稿；Firestore 採記憶體 cache，避免混用另一帳號的 SDK 磁碟 cache。登出不抹除本機帳號資料；共用裝置仍須注意瀏覽器儲存本身不是作業系統使用者之間的安全邊界。

## 6. Realtime Database schema

```text
rooms/{6-character-code}
  metadata: code, hostUid, guestUid, version, status, createdAt, updatedAt, expiresAt
  stateJson: existing engine's complete serialized state (host only)
  views/{uid}: participant-specific serialized state (own participant only)
  join: uid, name, deckJson (single guest reservation)
  commands/{uid}: id, expectedVersion, actionJson
  results/{uid}: serialized {id, error}
  presence/{uid}: online, updatedAt
```

房主對整個房間使用交易，原子更新引擎狀態、version、回覆及雙方遮蔽視圖。每名玩家只保留最新命令／回覆，避免無限堆積 action documents；遊戲 log 仍在既有 engine state。guest 操作必須是當前 version，重複 id 不重複結算。UI 動畫、滑鼠、篩選沒有寫入 RTDB。

房主/房客必須是不同 Firebase UID；同帳號多分頁不是第二位玩家。Anonymous 讓未註冊玩家參加。重新整理以 Auth session + room code 恢復；房主缺席時不能繼續結算，UI 提示等待。AI 房間完全保留於本裝置。

## 7. Firestore 安全規則

預設拒絕所有未匹配路徑；只能存取 `request.auth.uid == uid` 的資料。匿名身份不可存取帳號持久資料。檢查 ID、schema、名稱長度、deck map、card map 上限及時間欄位。設定／收藏限制文件 ID。硬刪除被拒，UI 封存可還原。靜態卡庫不存 Firestore。

規則是權限／格式邊界，不代表每張卡組合均符合賽制；對戰合法性繼續由既有引擎判定。Firestore 本身另有文件大小限制。超额／網絡錯誤保留本機 dirty 記錄，於保存、明確同步、重新連線或 focus 重試，不以無限輪詢消耗額度。

## 8. RTDB 安全規則及信任邊界

不能列出所有房間；知道六位碼的已登入訪客可以讀非牌組 metadata 並申請空 guest slot。只有房主可讀 room root / raw state、更新完整狀態；guest 只能讀自己的 projection／reply、寫自己的命令與 presence。不能改別人的 hostUid／guestUid、覆寫不相關房間、假冒 join UID 或讀另一玩家私有 projection。

規則限制命令、牌組 JSON、state/view 大小；version 陳舊操作被拒。房主只使用已驗證引擎結算普通 UI 操作。**Firebase rules 無法驗證複雜 OCG 規則，惡意房主可讀隱藏牌或偽造自己的房間狀態。** 權限隔離已測，不等同伺服器防作弊。私人對戰有 36 小時期限；離線房主遺留資料須按 README 定期清理。

## 9. APK／GitHub Releases

已知 APK 來源為使用者提供安裝 ZIP，版本 0.7.2-native-preview，固定附件名 `HoloLens.apk`。簽章有效但為 debuggable 預覽版，使用 prerelease tag；下載頁清楚標示。正式 metadata 存在時使用 `/latest/download/HoloLens.apk`，否則回退已知具名預覽版。metadata 不使用 token、不執行 Release body HTML、不接受任意回傳下載 URL，故外部內容不能把按鈕導向別的主機。

APK 大小及 SHA-256 見 README。0.7.2 APK 並非由本庫保留的 0.2.2 Android 程式建出，不聲稱 source reproducibility。自動 workflow 預設受 `ANDROID_SOURCE_READY` 閘門保護，避免誤發舊 App。正式金鑰未提供、未建立或改簽。

## 10. 部署命令

根 README 提供 `npm ci`、`firebase login/use`、`npm run build`、`firebase deploy`／`--only hosting` 及七天 preview 命令。規則／索引已部署到 `hololive-ocg`；預覽站驗證後，新 Firebase 正式網址 `https://hololive-ocg.web.app` 已發佈。原 Sites 網站／自訂網域未更改。

## 11. Firebase Console 手動工作

三種登入、兩個資料庫、Web config 與初次規則已完成，毋須重做。新自訂網域需加入 Authorized domains。正式切換前先在舊站匯出資料，驗證使用者跨網域匯入；避免假設 localStorage 可跨主機。App Check 未啟用，未提升 Spark 或開啟付費排程。

## 12. GitHub 手動工作

現成 APK 發佈不需要簽署金鑰。往後從程式自動建置需先補齊 0.7.2 對應 source、相同 signing key 和 README 所列四個 Secrets。設定 Environment reviewers、workflow source-ready variable，再手動輸入新版本／versionCode（必須大於 13），檢查草稿後發佈。切勿把 APK 放入 Git 歷史。

## 13. 免費額度

已盡量減少讀寫，但完整 room snapshots 仍含兩副牌和遊戲 log，長對局有傳輸成本。100 simultaneous RTDB connections 包含多分頁及工具連線，不等於 100 對對戰。静態圖使用現有外部圖片主機；啟動只載入卡庫 JSON 和部分畫面，沒有下載整個卡圖庫。限額數字及來源見 README；超額後本機組牌仍可用，新的雲端登入／同步／對局可失敗。

## 14. 原專案發現的問題及遷移注意

- 原網站用 Worker API + D1 session，Spark Hosting 不能直接執行；採並存的 build adapter，保留回退。
- 原 web 草稿僅一個 localStorage key，沒有完整離線已保存牌組庫；本次新增 UID 本機牌組库和遷移副本。未發現原 web IndexedDB/PWA。
- 原 App 已有本機收藏／掃卡及自有 bridge，但來源不是新提供 APK 的版本；不擅自改動或加入 PvP／AI。
- 原卡庫是快照，有缺少官方圖／OCR 參考圖；未補造圖或移入 Storage。卡片資料／效果測試不是逐張所有可能組合的完備證明。
- 原 TypeScript 有 Simulator payload、可選附件／顏色與 variant union 等型別問題；已作相容修正，未改 engine 邏輯。
- 正式 bundle 實測發現混合動態／靜態匯入共用模組時，輸出遺失原匯出名称，導致保存失敗。已將已載入的資料服務／驗證函數固定匯入，保留 PvP 的獨立延遲 chunk；已於修正版線上站確認保存、更新及 URL 重新載入成功。未把只有 SDK 通過當成整個 UI 已通過。
- SW 使用 version hash；HTML/card JSON 重新驗證、hash assets 長快取；新 SW 等舊頁關閉後啟用，避免對局中強制 reload。帳號／RTDB／GitHub metadata 不進 SW cache；離線首次未載入的卡圖仍須網絡。

## 15. 驗證紀錄與範圍

| 項目 | 結果／範圍 |
| --- | --- |
| 既有回歸測試 | 2,078 pass，0 fail；卡庫／組牌／scanner 邏輯／OCG engine／AI 等既有測試 |
| 同步／release 純邏輯 | 12 pass；metadata 正式／指定預覽版邊界、衝突／歸檔／額外欄位保留 |
| Firestore／RTDB emulator rules | 7 組 pass；owner/guest/outsider、隱藏資料、偽冒 UID、過期房間、invalid write |
| 實際 Firebase SDK 整合 | 3 組 pass；Auth、Firestore transaction、離線修改、同時編輯、stale editor、備份、帳號隔離；兩個 client 建房／加入／ready／起手配置／應援／主階段／重連及陳舊操作拒絕；本機 AI reload |
| TypeScript | `tsc --noEmit` 通過 |
| Firebase production build | 通過，29 個 Hosting 輸出檔，無 APK 或私鑰 |
| 舊 Sites build | 通過，原 `/`、`/account`、`/simulator` 和 API routes 仍存在 |
| Google login | 真實 Firebase 預覽站已用專案擁有者帳號登入成功，姓名／頭像與已同步狀態正常 |
| 線上牌組／session | 真實 Google session 跨重新整理保留；在瀏覽器建立牌組、編輯名稱、透過牌組 URL 重新載入成功；帳號頁顯示已同步、封存成功；登出回本機模式。僅留下已封存的「Firebase 驗證牌組（已編輯）」測試資料。 |
| 第二瀏覽器 | Chrome／Edge 同一 emulator 帳號，已讀到相同完整牌組與卡圖版本 |
| 桌面／手機 UI | Chrome 桌面卡庫及 390×844 下載頁已目視檢查；沒有橫向溢出 |
| APK | Android 官方 apksigner v3 簽署通過；版本、minSdk、ABI、hash 已驗證；不是實機安裝測試 |
| 公開 APK 下載 | GitHub prerelease 已公開；無 Authorization／cookies 完整下載 576,750,232 bytes，SHA-256 與原檔一致；`/latest` 目前 404 是因沒有正式版，網站具名預覽 fallback 可用。 |
| Hosting HTTP | 八個直接路徑 200；HTML no-cache、hash asset immutable、SW no-store；線上 cards.json 1,276 卡號 |
| 正式站離線 UI | Chrome 斷網模擬後重新開啟 `/deck`，1,276 卡號仍載入、加卡、保存本機牌組成功；驗證後已恢復瀏覽器網絡設定。 |
| 原站可用性 | 最終檢查原 Sites 網址仍 HTTP 200；沒有修改原站部署或 DNS。 |

另見最終交付的 live-checks.json（HTTP／下載驗證）及 migration-files.json（實際檔案差異）。測試不宣稱逐卡每一種狀態都完整覆盖，也不宣稱手機 App 已整合 Firebase。
