# Hololens 1.2.5 publication

- APK release source: `4adb3fa809092322d97ccb31ec1d88912955e46f`.
- Final website implementation: `e25ac8222baf9eaef78acfc6f107344524411cfd`.
- Stable release: https://github.com/luckymatthew/Hololen/releases/tag/v1.2.5
- Website: https://hololive-ocg.web.app/download
- ARM64 APK: **606,583,989 bytes**, SHA-256 `1a17c2900730dc1f4c51cceea73d6e33bf6cc78b1d59b75c41a1cbddcb20e7cf`.
- Install ZIP: **606,587,420 bytes**, SHA-256 `13881bf3a406b936b08fee2ecfea6ef18e448778e4627d40f9b1545ec062a7ad`.
- GitHub reports matching uploaded digests for all four public assets: APK, Install ZIP, README and checksums. The private Android source, private test recordings and signing material were not published.
- Both APK ABIs retain the original certificate, versionCode 24, v3 signatures and 16 KiB alignment. The signed 1.2.4 to 1.2.5 emulator upgrade preserved the exact existing profile bytes.
- Firebase Hosting deployed only to the existing `hololive-ocg` site. Backend rules, Sites history and permanent Firebase configuration were unchanged.
- The actual production browser displays **v1.2.5**, **578.5 MiB**, Android 15 and the correct 1.2.5 APK/Install ZIP URLs. No console errors were observed. The system theme preference was preserved; no browser storage was cleared and no service worker was forcibly activated.

The first production browser check caught an older hardcoded Install ZIP link while the APK already followed 1.2.5. The final website commit makes both links follow the displayed release version. All **2,350 website tests**, type checking and production build passed again before redeployment. This website-only fix did not alter the signed APK or Android source archives.

The Google project-metadata API timed out during automatic default-site discovery despite successful token refresh and deployment permission checks. A temporary deployment config specifying the existing site completed the deployment; the configuration is retained as private verification evidence rather than a permanent project change.

An anonymous download of the full **606,583,989-byte APK** completed in 73 verified byte ranges. The reassembled SHA-256 exactly matched the signed local APK: `1a17c2900730dc1f4c51cceea73d6e33bf6cc78b1d59b75c41a1cbddcb20e7cf`. After the final website deployment, all **18 checked build files** and all **255 hBP09 printing images** matched production bytes. The final comparison also checked the stable v1.2.5 GitHub release and service worker `holo-firebase-0321cd9037c19029`. The earlier deployment comparison is retained separately as pre-final evidence.

See [scanner fixes and test scope](SCANNER_FIX_REPORT.md), [release notes](RELEASE-1.2.5.md) and [sanitized verification](VERIFICATION-1.2.5.json). Current release validation includes 130 JVM tests per Android variant, lint zero errors, 80 native host tests and 9 scanner plus 2 AI/Downloads emulator tests. The 111 hBP09 card images, actual thumbnail, six nonempty readback-verified Downloads exports and the original failing AI continuation were exercised on the signed APK.

No physical phone or labelled real capture sequence was available. Real-camera accuracy, focus/glare and end-to-end latency remain unverified; reference-art and injected-candidate tests are not an instant-recognition guarantee. Fresh real-account login, full online deck sync and cross-device PvP were not retested. Complex first-time AI searches remain costly.
