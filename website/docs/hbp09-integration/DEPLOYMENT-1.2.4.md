# Verified Hololens 1.2.4 deployment

- APK release source: `c2662019a1cc48fefea4e07534d80ac54c69813d`.
- Final website source: `6fdb90b41b460e444c6d51455a3e3a27fc369448`.
- Stable release: https://github.com/luckymatthew/Hololen/releases/tag/v1.2.4
- Website: https://hololive-ocg.web.app/download
- ARM64 APK: **606,583,989 bytes**, SHA-256 `e201c91f8f6bd3f459a54e4907f6e668754ad7cd771b782519e2dd383da24c2a`. A complete anonymous public download matched the signed local APK.
- Install ZIP: **606,595,775 bytes**, SHA-256 `d1fbc3d8befe07673a3cee6d12a7edf8294c6eb6d0f78b18f9e45c45ad881095`. Local archive integrity and the embedded APK were verified; GitHub's uploaded asset digest matched.
- Both APK ABIs retain the original certificate, version code 23, v3 signatures and 16 KiB alignment. The public release contains ARM64 APK, install ZIP, README and checksums; private Android source, test fixtures and signing material were not published.
- Hosting was deployed only to the existing `hololive-ocg` site. All 18 checked build files and all 255 hBP09 printing images matched production bytes after the final deployment.
- A fresh browser tab displayed v1.2.4, 578.5 MiB and the correct APK/ZIP URLs. Existing theme preference was preserved; no console errors were observed in the final check.

The first production browser check caught a theme settings import error that local development did not reproduce. The follow-up website commit replaces the broken dynamic namespace access with named imports, retaining the Firebase guard and settings merge. All 2,350 website tests, type checking and the production build passed again. Production assets and the actual browser mount were then rechecked. The signed APK and its archives were unchanged by this website-only repair.

See [release behavior and measurements](RELEASE-1.2.4.md) and [sanitized verification](VERIFICATION-1.2.4.json) for exact test scope. Physical ARM64 phone/camera behavior, fresh login and real-account sync remain unverified in this run. Browser file-chooser import was blocked by the extension's local-file permission; the production importer separately accepted the actual Android export. Scanner reference-art timings exclude camera and OCR latency, and complex first-time Expert searches remain costly.
