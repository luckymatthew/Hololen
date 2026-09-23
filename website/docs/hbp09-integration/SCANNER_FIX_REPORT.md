# Hololens 1.2.5 掃描修復報告

版本：1.2.5 / versionCode 24。合併目標是目前私人 `android-current` 正式來源，基準為已發布的 1.2.4；沒有使用公開 repo 內的舊 Android preview。讀取「Review Scan Accuracy」的審查後，重新在實際正式來源重現問題，沒有把歷史審查結果當成本版驗證。

## 修正與證據

| 問題 | 本次處理 |
| --- | --- |
| 首批候選出現後停止分析 | 移除以保留候選狀態阻擋 camera/process/OCR 的條件。候選畫面與分析流程各自管理；後續清晰畫面可更新結果。 |
| 移開卡片後仍需手動選卡 | 空白、模糊、失敗畫面保留最後可用候選；不把這份保留資料當成新辨識證據。永不自動選卡或自動離開。 |
| 候選更新造成點擊失效或錯位 | 在完整手勢及 Android 延後執行的 click 期間保留原列，closure 綁定固定卡號。取消手勢後套用最新候選；明確重新掃描會作廢舊列。 |
| 重複合併加分 | ScanFusion 複製每個原始 Hit，保留所有欄位，重複合併不再修改原始分數、證據或旗標。 |
| 有效建議不在可見前五名 | 通過既有衝突否決後的建議保留在五個可選候選內；沒有放寬圖像／文字門檻或繞過卡號衝突。 |
| 回呼及跨畫面混淆 | 掃描 generation 與唯一 frame ID 分開追蹤；每畫面最多一票；舊／重複回呼不能改變新證據、釋放新工作或覆蓋較新畫面。 |
| OCR 與相簿生命週期 | 成功、失敗、取消共用一次性清理；ML Kit 完成前保留 bitmap。背景中斷的相片能恢復；舊相片回呼不能覆蓋新相片；真正失敗不會無限重試。 |

修正前的正式 Activity 在六項候選行為測試中有兩項失敗：後續結果不能更正首批候選，取消手勢後亦不能顯示更正。相同八項 fusion 回歸在舊程式有五項失敗，在修正後全部通過。純 JVM session/consensus 的 21 項測試全部通過。完整最終測試見下表；不能把分項結果重複相加。

## 本次最終驗證

| 驗證 | 本次結果 |
| --- | --- |
| JVM / Robolectric | debug 130、release 130 項全部通過，沒有跳過。包括 15 項真實 process/回呼資源生命週期測試。 |
| Lint 與建置 | debug/release 各 0 errors、41 warnings；ARM64、x86_64 release 及 instrumentation 完成。 |
| 網站回歸 | 2,350 項通過，TypeScript 與 production build 通過。 |
| 原生引擎 host | 80 項通過。 |
| 原簽章 APK 的 Android 掃描驗證 | 9 項全部通過；實際 AVD 相機在候選出現後仍處理 3 個新畫面，沒有按重新掃描或自動選卡。亦驗證更正、保留、觸控、舊回呼和 111 張 hBP09 縮圖。 |
| 圖像檢索／快取 | 8 張參照圖 × 3 輪，共 24 組的首位檢索一致；不同畫面不共享候選或確認證據；空白／合成失焦圖沒有繼承舊結果；已關閉 query 不能再用。比較器是早於 1.2.4 的歷史實作，不是 1.2.4 APK，因此不宣稱本版比上一版影像比對更快。 |
| AI／匯出裝置回歸 | 2 項通過：原先失敗的 revision 169 繼續至 183，提交 14 個動作；實際規則錯誤後，六種 Downloads JSON／ZIP 全部非空並經讀回驗證。 |
| 覆蓋安裝 | 1.2.4 → 1.2.5 安裝成功；744-byte 原有 profile 的 SHA-256 完全一致。 |
| APK | 兩個 ABI 原憑證、v3 簽章、16 KiB alignment、版本及 5,774 個素材逐一通過核對。 |

第一次新生命週期測試失敗是測試替身略過 ML Kit 初始化，InputImage 建立前便拋錯；保留了診斷證據，加入與 App 相同的初始化後 15 項全部通過，完整測試亦重跑通過。沒有移除或跳過失敗測試。

## 保留來源與發行身份

1.2.4 私人來源基準 SHA-256：`2f4fc2b2c93a70a2dda178729abb298d67dbb1c8bae3576603f655b84937f9e4`。本次與該來源逐檔比較，沒有刪除既有來源；5,774 個正式素材中 5,773 個位元一致。唯一改動的素材是更新 appBuild 的 `native/engine.js`；引擎、卡庫與 AI policy 版本雜湊不變。

hBP09 的 111 個新卡號／255 個印刷版本、2,572 筆掃描參照、所有卡圖及索引完整保留。CardVision 的門檻、1920×1440 相機分析設定、OCR、KEEP_ONLY_LATEST，以及單一畫面內的特徵重用均保留。牌組、同步、登入、PvP、存檔、AI、匯出功能來源未改；原生介面的版本標籤更新。

套件：`com.holocard.pocketlab.preview06`。沿用原私人簽署流程與憑證 SHA-256：`92a20ef4e5e7a93e96865577fc90978ba085c0723a0145bcda58c848f5b84f4a`。Android 15+，ARM64 安裝包；另驗證 x86_64 模擬器版本。私人完整來源與 focused scanner source/tests ZIP 留在擁有人工作目錄，不上傳私人來源、簽署材料或使用者記錄。

ARM64 APK：606,583,989 bytes；SHA-256 `1a17c2900730dc1f4c51cceea73d6e33bf6cc78b1d59b75c41a1cbddcb20e7cf`。

[版本頁](https://github.com/luckymatthew/Hololen/releases/tag/v1.2.5) · [APK](https://github.com/luckymatthew/Hololen/releases/download/v1.2.5/HoloLens.apk) · [安裝 ZIP](https://github.com/luckymatthew/Hololen/releases/download/v1.2.5/Hololens-1.2.5-Install.zip)。公開發布後的網路與瀏覽器核對另記於 DEPLOYMENT-1.2.5.md；以上本機簽署與裝置結果不冒充公開發布證據。

## 驗證限制

本次沒有連接實體手機，也沒有取得同一組有標籤的實拍影片／照片序列。模擬器相機只驗證分析持續執行；注入結果測試驗證實際 Android UI、手勢與生命週期；官方參照圖及合成空白／模糊圖測試驗證檢索與記憶體隔離。這些都不能量出真實鏡頭的 top-1 準確率、反光／對焦表現或端到端辨識延遲，因此沒有聲稱「瞬間辨識」或準確率百分比。

本次沒有重新驗證真實帳戶登入、完整線上牌組同步或跨實體裝置 PvP。既有 AI 首次複雜搜尋的速度限制仍然存在；掃描修正沒有改動搜尋預算或模型。

資源清理與相機背壓處理參照 [Android CameraX image analysis](https://developer.android.com/media/camera/camerax/analyze) 及 [ML Kit text recognition](https://developers.google.com/ml-kit/vision/text-recognition/v2/android)；實際結果以上述測試及封存雜湊為準。
