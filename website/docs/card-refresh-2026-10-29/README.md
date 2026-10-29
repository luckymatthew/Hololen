# Official card-data audit — 2026-10-29

## Frozen source and exact delta

- Official listing: **203/203 pages, 3,039 rows**, including the single non-card teaching row (`null`, official ID 2993).
- Numbered records: **1,409 card numbers / 3,038 printings**.
- Against release commit `a789bcbac3f8ca5216f3188f30bb6177e97a40c9`: **22 new card numbers, 57 new printings, zero missing existing printings**. The seven simulation aliases remain separate.
- New card numbers: `hSD20-001`–`hSD20-014` and `hSD21-001`–`hSD21-008`.
- New images: 23 starter-deck images (22 new cards plus the new `hSD14-010` artwork), 12 collection images, and 22 PR images.
- Frozen full snapshot SHA-256: `cc2637434a3d29f38874b6152f2b18a9fce04a1b025a6959a0dc3483bb312817`.

[Official product index](https://hololive-official-cardgame.com/cardlist/) and [deck product details](https://hololive-official-cardgame.com/products_detail/sd_kyoko-mela/) establish **2026-10-30** for hSD20/hSD21, so new deck cards/printings remain previews on this capture date. hCO02/hCO03 are dated **2026-10-11**. Reprinted existing cards must not themselves become previews.

## Independent structured audit

The read-only audit compares every numbered source row with the original catalog: HP, LIFE, stage, colors, baton, Arts base damage, printed modifier, cost, and special target/value. It normalizes equivalent color encodings and blank/zero baton; it does **not** replace translated effect prose.

- Zero parser failures; no mismatches in HP, LIFE, stage, Arts base damage, or printed special bonuses.
- Three old hEB01 reprint **official HTML errors** appear in six listing rows. Listing and detail HTML agree with each other, but their printed PNGs agree with the preserved catalog instead:
  - `hBP01-050`, IDs 2515/2616: HTML omits the green Arts cost; PNG shows green + colorless.
  - `hBP03-029`, IDs 2541/2641: HTML adds a one-colorless baton cost; PNG has no baton cost.
  - `hBP03-050`, IDs 2545/2645: HTML omits red from the card's color; PNG shows blue + red.
- The original catalog also omits a printed `+` modifier on **183 cards / 475 printing rows** (480 Arts across those rows). This is a legacy display-metadata omission, not evidence of new errata. No old translated effects or gameplay fields were rewritten.
- [Latest errata](https://hololive-official-cardgame.com/rules/errata/) remains 2026-09-17. [One-copy restrictions](https://hololive-official-cardgame.com/rules/deck-building-rule/) remain `hBP01-030` and `hBP07-101`.

This is a catalog reconciliation, **not** complete behavioral verification of every card's simulator effects.

## Evidence and reproducibility

Commit-sized evidence:

- `source-manifest.json`: complete page hashes, source URLs, release dates, source/PNG hashes, capture provenance, and summary.
- `new-printings-source-fixture.json`: all 57 enriched new printing records, explicitly marked as an incomplete fixture rather than a full merge input.

The complete 26 MB `official-snapshot.json`, raw HTML, PNGs, and detailed comparison reports remain outside the build tree at `/tmp/hololen-official-capture-20261029` as local evidence; do not publish them as Hosting assets. The full snapshot is frozen and was not regenerated after merger use.

```sh
cd website
python3 -m unittest discover -s tests -p test_official_fetch.py -v
python3 scripts/audit-official-structured-metadata.py \
  /path/to/frozen-official-snapshot.json \
  /path/to/original-cards.json /tmp/structured-metadata-audit.json
```

Future latest checks should use a new timestamped directory. `fetch-official-audit.py` now fetches from the network **by default**, even if a raw file exists. `--resume` is explicit, retains the original recorded fetch time (or marks legacy time unknown), and records cache reuse; it is not proof of a fresh latest check.

## Safe implementation scope

The new full-list importer is selected only for schema version 2 snapshots; the previous PR/hEB01 importer remains backward compatible. It rejects incomplete captures, unknown card types or icon mappings, conflicting new-card reprints, duplicate stable identifiers, and disappearance of any existing printing before writing output. Existing card names, effects, core stats, IDs, variant IDs and seven simulation aliases are retained. Added product memberships and missing detail links have a complete reversible report in `report.json`.

The result contains **1,416 cards / 3,038 printings**: 1,409 official numbers plus seven compatibility aliases. All 22 new cards keep official Japanese effects, explicit fallback/translation status, and `not-audited` simulation status. Twenty-three new deck printings, including the new artwork on existing `hSD14-010`, have separate October 30 release/preview metadata. The preview boundary uses Japan time; release does not imply simulator implementation.

The card-import safety changes affect only three runtime source paths: the card detail view, simulator inspector presentation, and the catalog-only Oshi registry. Their reversible, exact-before/exact-after patches are pinned in `tests/fixtures/card-refresh-2026-10-29-runtime-changes.json`. Existing card presentation is rendered against the previous source and compared byte-for-byte in tests. New cards explicitly show that they are not suitable for automated battles; the two new Oshi have no activation buttons. No resolver, engine, AI, authentication, deck storage or Android source has changed.

`baseline-runtime-provenance.json` proves that a clean build of the exact release base matches all 15 production runtime artifacts byte-for-byte (HTML, service worker, and 13 JS/CSS chunks, including simulator/PvP). The previous catalog was 2,110,796 bytes with SHA-256 `c6db1d1cf260ae591291a35d05823f572158a1708e85e0986f60c9179944de0a`.

## Reproduction and publication

Use a fresh timestamped capture directory, not the frozen October 29 directory:

```sh
cd website
npm ci
python3 scripts/fetch-official-audit.py \
  --directory /tmp/hololen-official-YYYYMMDD-HHMMSS \
  --details-for-new-printings public/cards.json
node scripts/merge-official-card-refresh.mjs \
  /tmp/hololen-official-YYYYMMDD-HHMMSS/official-snapshot.json \
  public/cards.json /tmp/card-refresh-report.json
npm test
python3 -m unittest discover -s tests -p test_official_fetch.py -v
node scripts/check-firebase-build.mjs
# Only with the existing approved Firebase authorization:
firebase deploy --only hosting --project hololive-ocg
```

The existing Firebase predeploy hook rebuilds and checks the Hosting output. Never deploy an emulator build, APK, signing key, service-account key, source evidence directory or unrelated backend changes. Keep credentials outside this repository. The build uses only public production Firebase web-app configuration; it does not require changing project security settings.

Raw audit evidence is deliberately outside the checkout: Tailwind scans source files automatically, and untracked downloaded HTML must not affect the deployed CSS. Before the explicitly requested footer styles were added, the clean card-only build preserved the exact previous CSS SHA-256 `9b16807c57cbf65dab3875d11674638911b025c8d7b351e5e2feb60da27b79ff`.


## Website update log

A small footer button opens an accessible update-log dialog with the single verified October 29 update. Its table has all 57 newly added printing images, names and card numbers, explicitly distinguishing the 22 new card numbers from 35 added printings/alternate artworks on existing card numbers. No earlier website history was invented. The footer does not overlay active battle controls.

`public/website-updates.json` is generated from the exact catalog and merge report. `scripts/build-website-update-log.mjs` verifies the catalog SHA, printing identities and official artwork URLs, then appends a deterministic dated entry. Repeated execution is byte-idempotent and never overwrites previous entries. Future card updates should run this after the verified merger:

```sh
node scripts/build-website-update-log.mjs \
  /tmp/card-refresh-report.json public/cards.json public/website-updates.json
```

All 57 new official PNGs were fetched successfully, verified as 400 × 559 PNGs, and assigned unique SHA-256 hashes. Direct visual checks confirm both new Oshi LIFE/cost/stage skills and representative 2nd Holomem printed damage, plus modifiers, colors, costs and bonuses. This image verification is recorded in `new-art-verification.json`; it is not a simulator effect audit.

Checkpoint validation after the footer addition: 11 sync tests and 3656 regression tests passed, with 1 explicit missing-Android-fixture skip and zero failures; TypeScript, production build, Hosting guard, six dialog interaction cases and ten append-only data cases passed. Production deployment is paused for the separately authorized integrated UI redesign.
