# Hololens 1.2.5 — 持續掃描及辨識修正

第一批候選出現後會繼續掃描，較清晰的新畫面可以更正結果。移開卡片後仍保留候選，只有點按才會選取；按住候選時不會被新結果替換。

修正文字／圖像重複加分、可信建議不在可見候選、舊回呼／重複畫面計票，以及相片辨識中斷後無法恢復。保留原有辨識門檻、hBP09 卡圖／索引、每幀特徵重用、AI、規則、牌組、存檔及匯出功能。

Android 15+ / ARM64，versionCode 24，沿用原簽章，可直接覆蓋安裝。

本次驗證：每個 Android variant 130 項測試，lint 0 errors；2,350 項網站及 80 項原生 host 回歸；原簽章 APK 上 9 項掃描與 2 項 AI／Downloads 測試全部通過；24 組參照圖檢索、111 張 hBP09 卡圖、覆蓋安裝資料及兩個 ABI 簽章／素材核對通過。

沒有實體手機或有標籤實拍序列，因此不聲稱「瞬間辨識」或真實鏡頭準確率。複雜 AI 首次搜尋仍可能需時。

完整修復、來源及測試限制：[SCANNER_FIX_REPORT.md](https://github.com/luckymatthew/Hololen/blob/v1.2.5/website/docs/hbp09-integration/SCANNER_FIX_REPORT.md)。

ARM64 APK：606,583,989 bytes；SHA-256 `1a17c2900730dc1f4c51cceea73d6e33bf6cc78b1d59b75c41a1cbddcb20e7cf`。

[版本頁](https://github.com/luckymatthew/Hololen/releases/tag/v1.2.5) · [APK](https://github.com/luckymatthew/Hololen/releases/download/v1.2.5/HoloLens.apk) · [安裝 ZIP](https://github.com/luckymatthew/Hololen/releases/download/v1.2.5/Hololens-1.2.5-Install.zip)。公開發布後的網路與瀏覽器核對另記於 DEPLOYMENT-1.2.5.md；以上本機簽署與裝置結果不冒充公開發布證據。
