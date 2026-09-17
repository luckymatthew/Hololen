# hBP09 database update — 2026-09-17

## Scope and release state

The official product is **ボリュームヴォルテックス / Volume Vortex**, release date **2026-09-19**. This update imports the already-published card list; it does not represent an earlier product release.

Official product: https://hololive-official-cardgame.com/products/post/volume-vortex/

The pinned set contains 255 unique printing images across 131 card numbers: hBP09-001 through hBP09-111, fourteen older card-number reprints, and six new cheer numbers. The official product breakdown is 125 base cards plus 130 parallels.

**This is a database/source update, not proof of a Firebase deployment or a signed APK release.** Follow the release checklist below. New card gameplay effects have not been audited by this change.

## Included data

- `scripts/hbp09-official.json`: official Japanese fields, ability HTML and per-printing source URLs.
- `scripts/hbp09-art-manifest.json` and `public/card-art/hbp09-*.webp`: 255 verified local artwork files with SHA-256 checksums.
- `public/hbp09-cards.json`: complete release delta in the existing card schema.
- `public/cards.json`: merged website database; old card and variant IDs are retained.
- `public/hbp09-scanner-ja.json` and `public/scanner-ja.json`: Japanese reading/search strings. This does not retrain the 29 existing recognition models.
- `scripts/sync-hbp09-android-data.py`: current-native-source JSON/art updater; default is dry-run, `--apply` creates a backup before writing.

The community Traditional Chinese source did not contain hBP09 when captured. New effects use **official Japanese originals**, explicitly marked `effectLanguage: ja`, `translationStatus: official-japanese-fallback`. Existing reprint translations are preserved. Do not describe these as completed Traditional Chinese translations.

## Reproduce and test website data

Run from `website/`:

```sh
python -m pip install beautifulsoup4==4.13.5
python scripts/merge-hbp09.py
python tests/hbp09.test.py
npm ci
npm test
```

The CI workflow `Verify and package hBP09 databases` additionally supplies the pre-update catalog for the preservation test. It validates complete numbering, all 255 printing images, old IDs, preview conversion, required statistics, actual image checksums and repeated-import idempotence. Test failure exits are not hidden by log piping.

## Apply to the CURRENT Android source

**Do not rebuild the repository's stale 0.2.2 mobile project as a replacement for the public 1.1.0 app. Do not replace newer AI Lab code with the older public version.**

The prior Codex 1.1.0 project is under `work/Hololens-1.0.0/HoloCardScanner` in the 2026-09-12 task; its folder name is historical. Use whichever current source tree includes the intended latest AI and account features.

From `website/`, first dry-run against that source:

```sh
python scripts/sync-hbp09-android-data.py --assets "PATH_TO_CURRENT_HoloCardScanner/app/src/main/assets"
```

Inspect the counts, then apply:

```sh
python scripts/sync-hbp09-android-data.py --assets "PATH_TO_CURRENT_HoloCardScanner/app/src/main/assets" --apply
```

Only these catalogs and related images are changed:

```text
cards.json
app/offline-cards.json
native/firebase-cards.json
art-map.json
scanner-ja.json
card-art/hbp09-*.webp
```

The updater merges each current catalog independently. It preserves all unrelated card data, existing card/variant IDs and the native offline image path convention. It does not touch Java/Kotlin, DEX, native engine scripts, Google login, deck saves, configuration credentials or signing material. A second dry-run should report zero changed files.

## Release checklist still requiring the authorized local environment

1. Website: `npm test`, then the existing authorized Firebase Hosting deployment for project `hololive-ocg`. Verify the actual public `cards.json`, not only the build folder. Expected catalog version: `2026-09-17-hBP09`.
2. Android: apply the data updater to the CURRENT source, increment the normal Gradle versionCode, run the current project's unit tests, and use its established release/signing workflow with the original key. No private key or password belongs in this repository or the data ZIP.
3. Real device: update without uninstalling; verify old decks remain, new card search/filters/images work offline, new variants can be added/removed and decks synchronize. Verify the latest AI behavior remains intact.
4. Publish an actually verified signed APK and installation ZIP, then update the website's download fallback to that exact release. Do not point it at an unsigned or nonexistent file.
5. New-card simulator abilities are a separate audit; `simulationStatus: not-audited` must not be interpreted as tested support.

The workflow artifact `hbp09-database-update` contains the website production build, native data generated from the public 1.1.0 baseline, checksums, source updater and test logs. For a newer native source, prefer the merge script over copying the baseline's whole JSON files.
