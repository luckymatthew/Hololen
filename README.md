# Hololive OCG — Firebase migration

保留既有繁中卡庫、組牌器、掃卡入口與 OCG 規則引擎，新增 Firebase 帳號、跨裝置牌組同步及 Realtime Database 私人對戰。網站與手機 App 的 PvP／AI 功能維持分開。

- 網站：`website/`，React 19 + Vite，Firebase Hosting 靜態 SPA。
- 原始碼與 APK：<https://github.com/luckymatthew/Hololen>。
- Firebase 專案：`hololive-ocg`（專案編號 `10748518089`），Spark。
- 正式 Firebase 網站：<https://hololive-ocg.web.app>；[Android 下載](https://hololive-ocg.web.app/download)。
- 測試站：<https://hololive-ocg--migration-yonpzisv.web.app>，2026-09-16 到期；可重新執行預覽部署延長。
- 完整架構、結構、權限及測試交付：[遷移報告](website/docs/firebase-migration.md)。

Firebase 網站已先經預覽站驗證，再發佈到原本空白的 Firebase 正式網址。舊網站仍在原部署平台運作，沒有切換舊站網域。Firebase 正式／預覽站共用本專案的真實 Authentication／Firestore／RTDB；模擬器使用完全獨立的 `demo-holo-ocg`。

## Firebase Setup

本次已完成 Web app 註冊、Google／電郵密碼／匿名登入、Firestore Standard `(default)`（香港 `asia-east2`）、Realtime Database（新加坡 `asia-southeast1`）及兩套私人安全規則部署。未啟用付費方案、Cloud Functions、Cloud Storage 或 Analytics。

新電腦／另一個 Firebase 專案：

1. 在 Firebase Console 選擇專案，維持 Spark；新增 Web app。
2. Authentication → Sign-in method：啟用 Google（設定公開名稱與支援電郵）、Email/Password、Anonymous。匿名帳號只用於私人房間，不可儲存帳號牌組。
3. 建立 Firestore Standard 的 `(default)` 資料庫及 Realtime Database，均選鎖定／正式模式。不要使用全域公開測試規則。位置建立後不能更改。
4. 在 `website` 複製 `.env.example` 為 `.env.local`，填入 Console 提供的公開 Web app config，以及實際 RTDB URL。交付資料夾已有本次設定，但 `.env.local` 不進 Git。
5. Authentication → Settings → Authorized domains 加入實際網站網域。Firebase 預覽部署會處理其預覽網域；自訂網域另行加入。Google popup 只要求姓名、頭像、電郵。
6. 執行以下規則部署和預覽部署，驗證後才切換正式站。

```powershell
cd website
npm ci
npx firebase login
npx firebase use hololive-ocg
npx firebase deploy --only firestore,database
npm run deploy:preview
```

往後更新 Firebase 正式網站：

```powershell
cd website
npm run build
npx firebase deploy
# 只發佈網站：npx firebase deploy --only hosting
```

`firebase.json` 的 predeploy 會重新建置、拒絕模擬器 bundle，並檢查 Hosting 內容沒有 APK／簽署金鑰。正式輸出是 `website/dist-firebase`。`/deck /cards /play /pvp /profile /settings /account /simulator /download` 皆可直接開啟和重新整理。

## Development

Node.js 22.13+；模擬器另需 Java 21+。

```powershell
cd website
npm ci
# 終端 1：啟動免費本機 Auth、Firestore、RTDB
npx firebase emulators:start --project demo-holo-ocg --only auth,firestore,database
# 終端 2：務必使用 emulator mode，以免寫入真正的專案
npm run dev -- --mode emulator
```

開啟 <http://127.0.0.1:5173>，模擬器介面 <http://127.0.0.1:4000>。`.env.emulator` 使用假的 demo 專案和公開測試 config。Google 模擬器帳號只在本機有效。

一般 `npm run dev` 使用 `.env.local`，連接真實專案。`npm run build` 後可用 `npm run preview` 檢查靜態版本。

```powershell
npm test                  # 同步／版本測試、原有回歸、型別、Firebase build
npm run test:rules        # 自動啟動模擬器測試權限
npm run test:integration  # 自動啟動模擬器，實際兩個 SDK client 同步／對戰
npm run test:sites        # 原 Sites build + 原 SSR HTML 測試
```

執行自動啟動模擬器的測試前，先關閉手動啟動的同埠模擬器。已在執行時可直接 `node --test tests/firebase-rules.test.mjs` 及 `node scripts/test-integration.mjs`。測試不會寫入 `hololive-ocg`。

原平台仍可用 `npm run dev:sites`、`npm run build:sites`。保留 `.openai/hosting.json`、Worker、D1 schema/migrations 及舊帳號 API；原 Vite config 強制使用 Sites adapter，避免讀到 Firebase `.env.local` 後誤用新後端。

## 使用者資料與遷移

未登入可查卡、組牌、保存本機牌組與執行 AI。登入後，牌組寫到 `users/{uid}/decks/{deckId}`；每副一個文件，保留推し、主牌、應援、卡圖版本分配及額外中繼資料。設定／收藏使用 `users/{uid}/data/settings` 和 `collection`，JSON 格式可由 Android／iOS 共用。

保存先落本機，再延遲 1.5 秒同步；卡片加減不寫 Firestore。登入、手動同步、重新上線及回到分頁時拉取，正常 focus 拉取至少間隔一分鐘。並行修改保留兩份；封存可還原，不做雲端硬刪除。帳號／草稿按 UID 隔離。

首次啟動保留舊 `hololive-ocg-deck-draft-v1`，另存「遷移前草稿」。登入後由使用者按「匯入此裝置牌組」匯入 guest 牌組，原版本保留，避免共用瀏覽器自動把別人的牌組帶入帳號。完整備份包含目前帳號牌組、設定／收藏及草稿；恢復時保留不同版本。

**不同網域不能直接讀取舊網域的 localStorage。** 舊 Sites 帳號也不是 Firebase 帳號；先在舊站／App 匯出完整牌組 JSON，再到 Firebase 站匯入。沒有自動複製 D1 使用者資料或密碼。手機 App 的 Firebase 登入尚未實作；此交付建立共用資料契約，不把舊 App 當成已完成同步。

## APK Releases

網站 `/download` 的 APK 由 GitHub Releases 提供，不放 Firebase Hosting。正式版固定名稱為 `HoloLens.apk`，永久最新版入口：

<https://github.com/luckymatthew/Hololen/releases/latest/download/HoloLens.apk>

本次使用者提供的 `Hololens-0.7.2-Install.zip` 內 APK 是 **0.7.2-native-preview**，以 `v0.7.2-native-preview` 預覽版發佈。GitHub 的 `/latest` 不包含預覽版，因此目前網站明確提供此預覽版的具名下載連結；將來有附 APK 的正式 Release 後，自動切換到正式版。版本、大小、日期及更新說明來自公開 GitHub API，快取一小時，不需要 token；API 失效仍保留已知下載連結。

APK 檢查：577 MB 十進位／550.0 MiB；Android 15+、ARM64、versionCode 13，套件 `com.holocard.pocketlab.preview06`。SHA-256：

```text
927f06dec1e727a07f4a74a3a65d9c856e5ab9fc94a301a29b272a0079285ca1
```

Android 官方 `apksigner` 驗證 v3 簽章成功；它有 `debuggable` 旗標和預覽簽署憑證，不應宣稱正式版。未連接 Android 實機進行安裝／相機驗證。檔案僅重新命名，沒有重編譯或改簽。

### 手動上傳已簽署 APK

1. 驗證版本、套件 ID、簽署憑證及 `apksigner verify --verbose` 結果。
2. 建立對應版本的 GitHub Release；測試包勾選 Pre-release，正式包才發布為正式 Release。
3. 上傳簽署 APK，附件必須叫 `HoloLens.apk`，附上 SHA-256 和更新說明，再按 Publish。
4. 登出 GitHub 的瀏覽器驗證下載；正式版發佈後確認 `/latest/download/HoloLens.apk` 可下載。

### 自動建置與 GitHub Secrets

`.github/workflows/android-release.yml` 只允許手動觸發，建置／驗證已簽署 ARM64 APK，產生**草稿 Release**供檢查後發佈，不會每次 commit 發版。

**目前保留的 Android 原始碼是 0.2.2-preview、versionCode 4、套件 `com.holocard.pocketlab`，不是使用者提供的 0.7.2 原始碼。** 自動建置設有 `ANDROID_SOURCE_READY` 防誤發閘門，預設跳過。先匯入與 0.7.2 相符的原始碼、確認相同套件 ID／簽署金鑰，更新 workflow 的版本底線及輸出路徑，再設 GitHub Repository Variable `ANDROID_SOURCE_READY=true`。不可把舊版程式只改版本號當成新版。

在 GitHub `android-release` Environment 設定以下 Secrets（可加 Required reviewers）：

| Secret | 內容 |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | 正式／既有相容金鑰檔的 Base64 |
| `ANDROID_STORE_PASSWORD` | 金鑰庫密碼 |
| `ANDROID_KEY_ALIAS` | 別名 |
| `ANDROID_KEY_PASSWORD` | 私鑰密碼 |

工作流程使用 Java 17、Android SDK 36、Gradle wrapper；Android 版本與 Release tag 使用同一次手動輸入。versionCode 必須大於所有已發佈版本（提供的 APK 已是 13）。金鑰只在 runner 暫存目錄存在，最後移除；沒有任何金鑰／密碼／Admin credential 進入 Git 或網頁。

## 免費方案與私人對戰限制

Spark 的目前配額：Hosting 10 GB 儲存／360 MB 每日傳輸；Firestore 1 GiB、每日 50,000 讀／20,000 寫；RTDB 100 同時連線、1 GB 儲存／每月 10 GB 下載。快取仍可能產生流量；這些配額由整個專案共用。超額可能暫停雲端功能，不能承諾永久免費且不限人數。[Firebase 官方價格](https://firebase.google.com/pricing)

私人 PvP 由房主瀏覽器執行未改動的規則引擎。房客只能提交自己的操作、讀自己的遮蔽視圖；房主能讀完整對局以結算。**房主必須保持對局頁面開啟，也能用修改版客戶端作弊或看到房客隱藏牌。這不是具防作弊保障的競技伺服器。** 如需可信任比賽，應把同一引擎搬到受控後端；Firebase Cloud Functions／Cloud Run 需要計費方案，或另找有額度限制的免費外部運算服務。[Firebase 方案](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)

房間 36 小時過期，房主下次建立房間時清理本機記錄的過期房間。從未回來的房主、遺失本機記錄的房間仍須管理者定期清理；沒有啟用付費排程／TTL。匿名登入及房間碼不能完全防止濫用、猜碼或耗盡免費配額；App Check 尚未強制啟用，公開大量使用前應評估。

## 最後需要由擁有者處理

- 檢查資料備份遷移流程，決定何時讓舊站使用者改用新 Firebase 網站／切換自訂網域。Firebase 正式網址已可用。
- 如要自動建置下一個 App 版本，提供 0.7.2 對應原始碼和原簽署金鑰，設定上述 Secrets；本次預覽 APK 的發佈不需要這些 Secrets。
- 實機測試 App 安裝、覆蓋更新、掃卡及手機下載。手機舊帳號仍依舊網站運作。
- 新域名加入 Auth Authorized domains；監控免費額度與過期房間。專案目前沒有啟用付費服務。
