# Holo Pocket Lab — Android 16 / iPhone source

2026-09-05 · `0.2.0-preview` · Android: `com.holocard.pocketlab`

## 0.2 修正與安裝

- 掃卡預設 **2×**，加入 1×／2× 快捷鍵、1–4× 滑桿、點按與按鈕重新對焦。取景框縮小，容許把手機拉遠；分析範圍會按實際預覽比例裁切，保留框邊裕量，分析解析度目標提高至 1920 × 1440。
- 取景倍率按鏡頭硬件上限處理，保存你的選擇；模糊畫面提示拉遠並重新對焦。改變倍率或對焦會丟棄舊畫面結果，避免誤用過期辨識。
- 舊版卡片詳情被強制替換為 **240 × 335** 縮圖。現在載入官方原始圖檔，不再次壓縮；卡片詳情圖片擴大。原圖下載後快取，上限 160 MiB；離線時先讀已快取原圖，否則用內置縮圖。抽查 `hBP01-060_U.png` 的官方原圖為 **400 × 559**，不是自行放大成假高清。
- iOS 原生專案在 `ios/`：AVFoundation、Apple Vision 日文 OCR、OpenCV 圖像索引核對及相同非對戰功能。**尚未在 Xcode 編譯、簽署或上傳 TestFlight，亦未完成 iPhone 真機測試。** 你已有開發者帳號；請在 Mac 依 `ios/README-安裝.md` 完成下一步。

**Android 0.2 與舊版並存。** 舊預覽版簽署金鑰隨原工作環境清理而遺失，無法以原簽章覆蓋更新。因此新版本使用新套件 ID，桌面名稱為「Holo Pocket Lab 0.2」。請保留舊 App；逐副牌組在舊 App 開啟後按「完整備份」，到新版「匯入」並「儲存本機」。這個備份按鈕匯出的是目前一副完整牌組，並非一次備份整個本機牌組庫。雲端牌組重新登入同一帳號即可讀取。本次預覽簽署金鑰另行保存，未放入原始碼或 APK。

Standalone Android app with native camera/OCR/image matching and a packaged, redesigned card-library/deck-building client. **No PvP and no single-player AI simulator.** The existing public website was not changed or redeployed.

This is a **debug-signed preview**, not a production release. Compilation, logic tests and package checks are not a substitute for testing the camera, performance and WebView UI on the user's Android 16 phone. No instant-scanning or 100% accuracy guarantee is made.

## 用法

1. 在 Android 16 手機安裝另附的 ARM64 APK。只為你信任的來源允許安裝；毋須關閉 Play Protect。
2. 「卡庫」可搜尋卡號、日文／繁中卡名、技能及效果，並按成員、顏色、階級和系列篩選。
3. 「掃卡」開啟原生鏡頭，或選擇一張相片。日文辨識模型已內置，不需要先下載語言資料。手持閃卡時輕微轉動避開反光。
4. 辨識到卡片會打開繁中效果；證據不足時顯示候選，由你確認。這不是對卡片真偽、品相或稀有度的鑑定。
5. 「組牌」可加減卡片、選擇卡圖版本、檢查推し／主牌／應援張數、儲存本機牌組及匯出備份。
6. 「我的牌組」可查看本機牌組，或切換到原網站的帳號／雲端功能。登入、雲端儲存及未內置卡圖需要網絡。

## 功能範圍

| 網站非對戰功能 | App 實作 |
| --- | --- |
| 卡庫、繁中閱讀翻譯、搜尋及多重篩選 | 保留網站完整卡片資料快照及查詢邏輯 |
| 大卡圖／效果列表、卡片詳情、平行版本 | 保留，另加手機底部導覽及閱讀版面 |
| 掃卡、相片辨識 | 原生 CameraX、內置 ML Kit 日文辨識及 OpenCV 局部圖像比對 |
| 牌組構築、版本數量、基本張數驗證 | 保留；驗證不代表所有賽制限制及最新禁限卡規則 |
| 草稿保留、帳號及雲端牌組增刪改查 | 本機草稿及原網站帳號 API；雲端整合尚待使用者登入真機驗證 |
| HoloSim 1.13 JSON 匯入／匯出 | Android 系統檔案選擇器及另存新檔；不支援的卡號明確提示 |
| 完整牌組備份 | 額外提供自家 JSON 備份，保留名稱及卡圖版本，不受 HoloSim 舊卡庫限制 |
| 本機牌組庫 | 額外提供最多 50 副牌組；重要資料請匯出備份 |
| PvP、單人 AI | 完全不包含引擎、連線房間或功能入口 |

## 資料與已知限制

- 卡片／繁中翻譯是 **2026-08-22 快照**：1,276 個卡號、2,653 款卡圖資料，不是即時更新卡庫。
- 內置 **2,319 張參考卡圖**及縮圖，涵蓋 **1,134 個卡號**；其餘 334 款參考卡圖未能完整取得。缺圖的卡號仍可文字搜尋及閱讀翻譯；圖像辨識覆蓋並非完整。
- APK 約 155 MiB，主要包含離線辨識模型、卡圖及特徵索引。安裝後需要額外空間；0.2 與舊版並存時兩份 App 各自佔用空間。
- 強烈反光、模糊、遮擋、畫面中多張卡、缺少參考圖、相似重印圖可能需要再次對準或手動選候選。
- 圖像特徵比對可處理旋轉；日文 OCR 對橫向／倒轉文字未必同樣可靠。
- 掃卡運算在裝置進行，應用程式不設相片上傳 API。互聯網用於原網站帳號／牌組 API 及官方原圖。網絡狀態權限只用來離線時立即回退縮圖，毋須等待連線逾時。
- 相片經系統選擇器取得，不索取整個相簿的存取權；鏡頭權限遭拒時仍可選相片及使用卡庫。
- 解除安裝／清除 App 資料會失去本機牌組及登入狀態。停用自動系統備份，請另行匯出重要牌組。
- APK 僅供 ARM64 手機，最低 Android 15（API 35），目標 Android 16（API 36）。x86_64 APK 僅用於開發測試。
- 測試簽章不是長期發行金鑰；之後若改簽章，可能需先匯出牌組、解除舊版再安裝。

## 0.2 驗證紀錄

- Android Gradle `assembleDebug`、`testDebugUnitTest`、`lintDebug` 通過。21 項 Java 邏輯測試（包括新取景／裁切、硬件變焦限制及原圖 URL 範圍）通過。
- 7 項既有卡庫／搜尋／牌組匯出／功能範圍檢查、6 項 iOS JavaScript 橋接行為測試通過；TypeScript 型別檢查通過。
- C++ 圖像比對移植已用 OpenCV 官方 4.12.0 標頭作語法檢查；Swift 原始碼、Xcode 專案及 plist 作靜態語法／結構檢查。**這些都不是 Xcode 編譯或 iOS 真機測試。**
- 此次修正後沒有接駁實體 Android 或 iPhone；新取景的實際對焦、速度、反光及功耗需要真機驗證。舊版使用者已回報可以安裝並掃卡。
- APK 簽署、16 KiB 對齊與檔案大小見 `qa/package-verification.json`；本次整體紀錄見 `qa/revision-0.2.json`。

## 0.1 歷史驗證（不是 0.2 的新測試）

- Clean offline Gradle build: `assembleDebug`, `assembleDebugAndroidTest`, `testDebugUnitTest`, `lintDebug` succeeded.
- 15 Java logic unit tests passed; 7 Node data/search/export/scope checks passed; TypeScript type check passed.
- Android lint: 0 errors, 3 warnings (dependency version, focus-view accessibility, localized text formatting).
- APK signature verified; ZIP native-library alignment and all ARM64 ELF LOAD alignments checked at 16 KiB. See `qa/package-verification.json`.
- The host OpenCV regression on the user's 10 supplied photos found the correct candidate for all 10, automatically accepted 9 and left 1 for manual confirmation, with 0 wrong automatic selections. See `qa/visual-local-features.json`.
- **That small host regression excludes ML Kit, live CameraX, Android WebView and real-device timing.** Host timings are not phone latency estimates. This set was used during development, not as an independent accuracy benchmark.
- Android instrumentation tests compiled but did not execute: the available software-emulator setup could not start successfully (stale AVD state, then insufficient space for a clean emulator data partition). Do not describe instrumentation compilation as a passing device test.
- Native instrumentation sources are included; private photo fixtures are intentionally excluded from this source archive and the application APK. Without those fixtures the photo test is skipped explicitly.
- Physical Android 16 installation, real camera behavior, sustained scanning/battery use, cloud sign-in and complete touch-navigation acceptance testing remain required.

## Build

Requires JDK 17, Android SDK platform 36, build-tools 35.0.0 and Gradle 8.11.1 (wrapper included). Dependencies are pinned; the first build requires access to the official configured Maven/Google repositories.

```sh
./gradlew :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
```

The prepared web bundle and offline data/indexes are included, so rebuilding an unchanged Android app does not require Node or downloading card pictures.

To edit the client: install the exact packages in `web/package.json` with npm, then run `node scripts/build-web.mjs` from the project root. For proxy-equipped development environments, `scripts/gradle-build.py` reads only the usual configured proxy environment and optional `HOLO_JAVA_TRUSTSTORE`; it does not disable TLS validation.

Image-index regeneration is optional and separate from APK assembly:

```sh
python scripts/build-image-index.py --cache ../card-reference-cache --offline
python scripts/build-local-index.py
```

Run without `--offline` only when access to the official artwork host is authorized. The builder records unavailable files instead of inventing replacements. Dependencies: Python, NumPy and OpenCV. User photos are never training/reference data and are not packaged.

## Architecture / safety

- `MainActivity`: WebViewAssetLoader serves packaged HTML/JS/CSS and JSON using the existing website's HTTPS origin. Only explicit auth/deck API paths and official image paths may use the network; arbitrary HTML navigation, frames, file URLs and mixed content are blocked. SSL errors are cancelled.
- `ScannerActivity`: CameraX latest-frame analysis, focus/zoom/torch, photo picker, crop quality checks, bundled OCR, independent text/image evidence fusion, two-frame confirmation and lifecycle cancellation.
- `CardVision`: memory-mapped ORB descriptors; deterministic 8-table local-feature buckets; Hamming shortlist; ratio-filtered ORB matches and RANSAC geometric verification. Similarity scores are not probabilities.
- `TextMatcher`: normalized Japanese/name/skill/effect/number evidence. Shared character name, HP and stage alone do not trigger automatic selection. Conflicting strong text and image evidence requires user confirmation.
- The narrow JavaScript bridge exposes scanning and explicit user file picking/saving, not arbitrary file access. Account credentials are entered by the user through the existing cloud login form; no secrets or signing keys are included.

## Attribution

Unofficial fan reading tool. Card artwork and original text belong to COVER Corp. Chinese translations are unofficial; official Japanese text and rulings take precedence. Japanese skill-index attribution and the applicable Apache 2.0 license are in `app/src/main/assets/scanner-data-license.txt`. CameraX/AndroidX, ML Kit, OpenCV and React retain their respective upstream licenses.
