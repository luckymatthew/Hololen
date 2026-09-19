# Hololens 1.2.1 — hBP09 and AI Review

This release adds executable hBP09 integration and offline AI Review JSON/ZIP export to the current native Android app. It preserves NativeRules, the existing general AI, native interface, scanner, login, deck sync and schema-1 saves. Install the original-signed ARM64 APK over the existing app; do not uninstall first. Android 15 or newer is required.

Changes include Traditional Chinese hBP09 display text, serialized effect choices, Koyori assistant reveal-count fixes, finite hidden-card sampling, selected-card identity preservation and complete small split-heal allocations. AI exports contain actual candidate actions, scores and measured search statistics; unavailable values are explicitly labeled. Export files contain both players' offline hands/decks and are never uploaded automatically. PvP hidden state is excluded from this export workflow.

## Validation

- 11 website sync/release tests and 2,302 regressions, TypeScript and production build; Firebase emulator rules 7/7 and integration 3/3.
- Current native full host suite 55/55, plus a new independent two-attacker lethal sequence. Direct lethal, the uniquely surviving 20/40 heal split and selected-card identity across 500 hidden worlds also pass.
- Android debug/release unit tests, lint and release builds are rerun for versionCode 20. Original certificate, v3 signing, 16KiB alignment and every packaged asset are checked. The signed release is installed in place on Android 15 emulator, with profile/deck preservation, actual system file-save cancel/retry, JSON/ZIP readback and Activity recreation checks.
- 96 frozen smoke/holdout/comparison games across 12 deck families completed without failure or timeout; 19,795 actions replayed exactly during execution. Bounded exports explicitly retain 6,441 records and drop 13,354 older records while preserving reconstruction baselines.
- The 24-game baseline comparison isolates split-heal candidate coverage: 11 challenger wins, with a wide approximate paired 95% interval of 17.2%–74.4%. It does not establish improved overall strength. Configured budgets match but actual work differs.
- Browser and Android exports have been read back and checked against the handoff schema. Captured native and browser actions reconstruct and replay correctly; exact policy rerun determinism is not claimed.

The newly supplied `Hololens-1.2.0-Source.zip` matches the chosen production baseline in all 6,100 files. The separate `Hololen-1.2.0.zip` contains an old Android 0.2.2 preview and was not used. Formal 1.2.1 changes only version/build identity from the tested RC3 implementation; engine, catalog and AI source identities remain equal.

## Known validation limits

Formal release status does not mean every possible interaction was exhaustively tested. The missing historical AI Review source/reader prevents exact compatibility certification with that unavailable reader. Physical ARM64 phone camera, fresh Google sign-in and live account deck sync remain unverified in this environment. Emulator upgrade/export tests passed; injected stream failures were tested, but actual disk-full document-provider failure was not. Broad strategic-skip oracles and exhaustive cross-set combinations remain partial. All outcomes and the evidence-backed 38-row checklist are retained locally; no unavailable metric is invented.

Use `SHA256SUMS.txt` to verify downloads. The install ZIP contains the same APK, instructions and checksum. Private Android source and signing keys are not published. [Detailed RC3 test report](https://github.com/luckymatthew/Hololen/blob/codex/hbp09-production-integration-20260918/website/docs/hbp09-integration/AI-REVIEW-20260919.md) describes the measured policy behavior underlying this release.
