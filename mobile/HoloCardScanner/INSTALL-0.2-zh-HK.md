# Holo Pocket Lab 0.2 — 安裝及試用

## Android 16

安裝另附的 `Holo-Pocket-Lab-0.2-Android16.apk`（ARM64 手機）。新版桌面名稱為 **Holo Pocket Lab 0.2**，會與舊 App 並存。

舊預覽版簽署金鑰隨原工作環境清理而遺失，所以本次用新套件 ID 保留舊 App 及其資料。**先不要移除舊版**：在舊版逐副開啟牌組 →「完整備份」→ 到新版「匯入」→「儲存本機」。有多少副本機牌組就各備份一次；備份包含該副牌組的卡圖版本。已存到雲端的牌組，在新版登入同一帳號即可讀取。

### 對焦

掃卡預設 **2×**。把手機拉遠，卡片放進較細的框內，毋須貼滿整個鏡頭畫面。可點按卡片或按「對焦」，也可切換 1×／2× 或用滑桿微調。實際最短對焦距離取決於手機鏡頭；反光時稍微轉動卡片，避免光斑遮住卡名和效果。

### 卡圖

卡片現在載入與網站相同的官方原圖，下載後留在快取中，沒有再次壓縮成 240 × 335 縮圖。先在有網絡時開啟卡片詳情；之後離線可讀已快取的原圖。原圖未取得時會回退內置縮圖。快取可被手機系統清理，上限 160 MiB。

卡庫、繁中翻譯、篩選搜尋、異圖版本、組牌、牌組備份、帳號／雲端及 HoloSim 1.13 JSON 功能保留；不含 PvP 或單人 AI。

## iPhone 16

APK 不能安裝到 iPhone。本次已另備 **原生 iOS Xcode 專案**，在原始碼 ZIP 的 `HoloCardScanner/ios/`。尚未完成 Xcode 編譯、簽署、iPhone 真機測試及 TestFlight 上傳，目前沒有可用的 TestFlight 邀請連結。

有有效 Apple Developer Program 會員資格及 Mac 時：

1. 安裝 Xcode 26 或更新版本，完整解壓縮原始碼。
2. 在 Terminal 進入 `HoloCardScanner`，執行 `python3 scripts/prepare-ios.py`，再開啟 `ios/HoloPocketLab.xcodeproj`。
3. 在 Xcode 登入你的開發者帳號，選擇你的 Team 及獨有 Bundle Identifier。
4. 連接 iPhone 16，依 Xcode 提示開啟 Developer Mode，先按 ▶ 編譯及真機測試。
5. 測試通過後：Product → Archive → Distribute App → App Store Connect → Upload。
6. 在 App Store Connect 的 TestFlight 加入自己為內部測試者並選取建置；iPhone 安裝 Apple TestFlight，接受邀請後按「安裝」。

詳細步驟及驗收項目見原始碼內的 `ios/README-安裝.md`。簽署及帳號操作在你自己的 Mac 處理，毋須提供密碼。

暫時沒有 Mac 時，可用 iPhone Safari 開啟 [現有網站](https://hololive-ocg-zh-deck-studio.matthewmelia.chatgpt.site)，分享 → 加入主畫面。這會使用現有網頁版掃卡，不是本次原生 iOS 掃描器。

## 驗證範圍

Android 已編譯並通過 21 項 Java 邏輯測試、APK 簽署與 16 KiB 對齊檢查；共用功能及 iOS JavaScript 橋接有 13 項通過的 Node 測試。iOS C++／Swift 與專案設定完成靜態檢查，**不等於 iOS 編譯或真機測試通過**。此次沒有實體手機接駁，新的最近對焦距離、反光辨識和實際速度需你試用確認。

官方安裝參考：[TestFlight](https://testflight.apple.com/)、[Apple 的 Xcode 分發流程](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)、[Apple SDK 上傳要求](https://developer.apple.com/news/upcoming-requirements/)。
