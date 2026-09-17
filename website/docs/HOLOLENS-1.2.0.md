# Hololens 1.2.0 — hBP09

This release is built from the user-confirmed 1.1.0 native source, not the older
`mobile/HoloCardScanner` checkout in this repository. The complete matching Android
source is distributed as `Hololens-1.2.0-Source.zip` with the v1.2.0 release.

Catalog version: `2026-09-17-hBP09`; 1,392 card numbers, 2,906 printings.
The three Android catalogs preserve all previous card/printing IDs and include
255 verified official set images. The existing OCR models are unchanged; the
Japanese OCR dictionary includes the new cards. Six pre-existing hEB01 cheer
printings still have no artwork; no new hBP09 artwork is missing.

The APK retains the 1.1.0 deck controls, delete/restore, Google login, held scanner
candidates and existing AI/PvP code. The only native behavior changes are guarded
new Oshi activations and atomic profile snapshot persistence. Ten font-style
literals were replaced with equivalent named constants to satisfy Android lint.

Validation: 2,101 website regressions, 11 sync/release tests, 16 catalog tests,
68 Android tests, 6 native boundary/catalog tests and 7 offline-session tests.
Debug and release lint each report zero errors and 49 warnings. Signing matches
the original certificate, with v3 signatures and 16 KiB ZIP/native alignment.
See `hololens-1.2.0-verification.json` for package checks and source differences.

Package: `com.holocard.pocketlab.preview06`, versionCode 16, Android 15+, ARM64.
APK SHA-256: `88d48a1b317867953f4d77e21cc9114832be3af4f08e512e820fd1d2bd3d4bfd`.

New card effects remain unaudited; seven new Oshi skills cannot be activated.
Physical-device upgrade, camera accuracy, Google sign-in and full live deck sync
have not been tested. Automated tests are not device acceptance tests.
