# Hololens 1.2.6 — website and Android card-effect alignment

The website and production Android app now include the completed local-card-text-to-engine alignment repairs across hBP09, older sets, starters, promos and Oshi/Support effects. Trigger conditions, costs, legal selections, required choices and resulting state changes are synchronized with the reviewed local card text.

This release preserves the production native Android project, original signing identity, offline operation, trained AI, scanner and hBP09 images, accounts/deck sync, saved games, diagnostics and JSON/ZIP exports. Android 15+ / ARM64; versionCode 25. Install directly over the existing app without uninstalling.

Validation on the final local release sources:

- Website regression: 3,973 passed; synchronization/release tests: 11 passed; TypeScript and production build passed.
- Android packaged Offline/PvP JavaScript host tests: 640 passed; NativeRules privacy/initialization smoke passed.
- Android JVM tests: 130 debug + 130 release passed. Debug/release lint: zero errors, 50 warnings per variant. Release build succeeded.
- ARM64 and x86_64 APKs: original certificate, v3 signature, 16 KiB alignment, package/version metadata and all 5,774 embedded assets verified.
- Release-time maintenance fixed one missing optional TypeScript field declaration and stale Android test fixtures (unknown filler card, initial hand, Collab top-card payment, Bloom stage and normalized required-search minimum).

The completed alignment matrix covers 2,468 ability slots: 2,319 aligned and 149 repaired. Execution evidence remains explicit: 1,505 focused, 10 reused and 953 source-reviewed without a direct per-slot test. These counts do not claim exhaustive gameplay or official-rule re-audit.

No physical Android device was attached for this release. Real-camera latency/accuracy, physical-device update, Google login and live multiplayer were not reverified. Host tests and APK validation do not substitute for those checks.

ARM64 APK SHA-256: `c41c0dbf481a7a770012fed103e50ae249404a58bae2001c513efa79e960d9ab`

[Website and downloads](https://hololive-ocg.web.app/download)
