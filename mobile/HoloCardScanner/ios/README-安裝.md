# iPhone 16 / TestFlight

這是 **iOS 原生版本的 Xcode 原始碼**。此 Linux 工作環境沒有 Apple SDK，尚未完成 Xcode 編譯、Apple 簽署、iPhone 真機驗證或 TestFlight 上傳；不是可以直接安裝的 IPA。

## 你已有 Apple 開發者帳號：下一步

1. TestFlight 需要有效的 **Apple Developer Program 會員資格**；只有免費 Personal Team 帳號可以用 Xcode 在自己的裝置測試，但不能上傳 TestFlight。在 Mac 安裝 **Xcode 26 或更新版本**。Apple 目前要求 App Store Connect 上傳的 App 使用 Xcode 26／iOS 26 SDK 或更新版本建置；本 App 的最低 iOS 系統設定仍為 iOS 18，涵蓋 iPhone 16。
2. 完整解壓縮本原始碼，保留 `ios`、`app/src/main/assets` 及 `scripts` 的相對位置。不要只取出 `.xcodeproj`。
3. 在 Terminal 進入 `HoloCardScanner` 資料夾，執行：

   ```sh
   python3 scripts/prepare-ios.py
   open ios/HoloPocketLab.xcodeproj
   ```

   準備程式會從 OpenCV 官方 GitHub 下載 **4.12.0 iOS framework，約 221 MB**，核對 SHA-256 並保留官方隱私資料。這是開發電腦首次編譯需要的套件；使用者開啟 App 不用下載這個檔案。不要把它當成 APK／IPA 安裝。

4. 在 Xcode → Settings → Accounts 登入自己的 Apple 開發者帳號。
5. 選專案 → `HoloPocketLab` Target → Signing & Capabilities → 選你的 **Team**，勾選 Automatically manage signing。Bundle Identifier 預設為 `com.holocard.pocketlab.ios`；如果已被其他團隊註冊，改成你團隊獨有的識別碼。
6. 用 USB 連接 iPhone 16，信任電腦，按 Xcode 提示開啟手機的 Developer Mode。選該 iPhone 作為執行目標，再按 ▶。先檢查掃卡、相片、對焦、離線卡庫、HD 卡圖、牌組備份及帳號登入。官方 OpenCV 這個 framework 以實體 iPhone 建置為目標；本專案沒有宣稱可直接跑 Apple Silicon Simulator。
7. 真機通過後，選 `Any iOS Device (arm64)` → **Product → Archive** → Organizer → **Distribute App → App Store Connect → Upload**。首次需在 App Store Connect 建立與 Bundle Identifier 相同的 App 紀錄；顯示名称如已被佔用，可另選名稱。
8. 在 App Store Connect → 該 App → TestFlight，等建置處理完成，加入自己為內部測試者並選取該建置。iPhone 安裝 Apple 的 **TestFlight**，以受邀帳號開啟邀請，再按「安裝」。對外邀請其他人通常需要 Beta App Review；本次沒有建立邀請連結或提交審核。

帳號、證書及簽署金鑰只需在你自己的 Mac／Apple 帳號管理，不要把密碼放進程式碼。

## 版本內容與待驗證範圍

- 與 Android 共用完整繁中卡庫、搜尋／篩選、卡圖版本、牌組工房、本機牌組、雲端帳號／牌組、HoloSim JSON 及自家備份；不含 PvP 或單人 AI。
- 原生 AVFoundation 主廣角鏡頭、2× 預設取景、1–4× 變焦、點按對焦、硬件最近對焦距離提示、補光及系統相片選擇器。
- 原生 Apple Vision 日文 OCR；OpenCV ORB／RANSAC 和同一份離線特徵索引作圖像核對。原始碼已移植，iPhone 速度及辨識率仍需真機測試，不能沿用 Android 的測試數字。
- 高清卡圖使用官方原圖，下載後快取；沒有網絡或原圖不可取得時，回退內置縮圖。快取上限 160 MiB，可被系統清理。
- 相片不會上傳；鏡頭／相片辨識在裝置內執行。帳號、牌組 API 及高清卡圖需要網絡。
- 底層 WKWebView 使用本機 origin；雲端請求經受限制的原生橋接，只支援既有帳號與牌組路徑。此雲端整合尚待登入真機驗證。
- 內置卡庫是 **2026-08-22** 快照，不是自動即時更新。私有測試相片與簽署金鑰不在原始碼內。
- `.xcprivacy` 提供這份實作的資料流申報：偏好設定、快取時間戳、選用的雲端帳號識別及牌組內容。上傳時的 App Privacy 表單需按你實際部署的網站服務核對。

## 驗收時最有用的檢查

在兩個平台各用原先的閃卡、卡套及反光環境測試：先 1×，再拉遠改 2×；比較卡片輪廓、文字清晰度、誤判和候選。正面、橫放、較暗及反光時都試一次。開卡片詳情後關網絡，再開同卡，確認已快取原圖。把一副有異圖版本的牌組匯出，再重新匯入，確認張數與版本保留。權限拒絕、切換相片、返回 App 和再次掃卡也需驗證。

## 官方參考

- [Apple：上傳 SDK 要求](https://developer.apple.com/news/upcoming-requirements/)
- [Apple：Xcode 分發測試版本](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)
- [Apple：TestFlight](https://testflight.apple.com/)
- [OpenCV 4.12.0 官方發行檔](https://github.com/opencv/opencv/releases/tag/4.12.0)

未有 Mac 時，可先用 Safari 開啟 [現有網站](https://hololive-ocg-zh-deck-studio.matthewmelia.chatgpt.site)，分享 → 加入主畫面。這只會加入現有網站，使用瀏覽器的掃卡引擎，不會安裝本次原生 iOS 版本。
