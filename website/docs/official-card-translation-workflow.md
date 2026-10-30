# Official card updates must include display translations

This workflow changes display/search data only. Keep the canonical Japanese
`public/cards.json`, stable card/printing IDs, quantities, costs, damage, raw tags,
manual warnings and rule resolvers intact. A translation is not implemented game
behavior, an official localization or human approval.

## Bounded update procedure

1. Capture a **fresh** official card list/evidence in a new directory and reconcile
   it with `scripts/merge-official-card-refresh.mjs`, retaining the verified
   schema-2 report and its source/catalog SHA-256 values. The importer may create
   an untranslated **draft**; it is not a publication-ready artifact.
2. Add every new nonempty display field to
   `public/official-cards-zh-Hant.json`: `name`, `abilityText`, `extra`, skill
   `name`/`effect`/`timing`, and each Arts `name`/`effect`. Include exact `path` and
   `original` guards, and a nonempty Traditional Chinese `translation`.
   Add display-only labels for new Japanese tags; never replace canonical tags.
3. Compute `sourceSha256` with `sourceTextSha256(card)` exported from
   `scripts/validate-card-translations.mjs`. It hashes canonical JSON of
   `{ number, jpName, fields: [{ path, original }], tags }`, with deterministic
   field and tag order. An official text revision requires an updated translation
   and source hash, not a blanket fallback or stale source override.
4. Retain AI/non-official review metadata. New bundles use
   `meta.translationStatus: "ai-translated-from-official-japanese"`,
   `displayOnly: true`, `changesGameplay: false`; each entry uses the same status,
   `humanReviewStatus: "not-reviewed"` and
   `engineSupportStatus: "not-changed-by-translation"`. Preserve Arabic numeric
   counts/thresholds in each new translated field. A static gate does not establish
   semantic correctness: independently review conditions, targets, reveal/look,
   optional/mandatory actions and quantities against the Japanese text.
5. Run:
   ```sh
   npm run validate:translations -- --refresh-report=path/to/report.json
   npm test
   python -m unittest discover -s tests -p 'test_official_fetch.py'
   node scripts/check-firebase-build.mjs
   ```
   The explicit report also checks newly required card numbers independently of
   importer flags. Do not remove missing-field/source checks to make a draft pass.
6. Finalize the separately tested native update manifest/revision only **after**
   all catalog/translation/scanner files are final. A translation-only byte change
   must change the content digest and update revision, and the app must download
   and activate a consistent version atomically. Confirm the supported app
   compatibility contract; do not silently replace an already released APK.
7. Append only genuine card/printing additions to card-addition history. Record a
   translation-only change separately with zero new-card/new-printing counts,
   the actual translated field count, revision and source/dataset digests. Never
   overwrite frozen history or imply a new effect implementation.
8. Publish only the exact tested source/artifact through the existing authorized
   Hosting-only pipeline, then compare live bytes/digests. No authentication,
   credentials, permissions, rules, billing or unrelated app/gameplay changes.

## Durable publication boundaries

`npm run build` runs the translation gate **before** Vite. The existing Firebase
Hosting predeploy runs that build and `scripts/check-firebase-build.mjs`; the
latter independently validates built JSON and requires exact source/artifact byte
identity. Calling Vite directly does not bypass the final Hosting guard.

The default datasets are the immutable historical `hbp09-zh-Hant.json` plus the
source-guarded `official-cards-zh-Hant.json`. The 111-card hBP09 dataset has a narrow
legacy source-hash/tag-policy exception, not a blanket exemption for future cards.
Its exact field guards remain required. Eight existing Cheer records have reviewed
Chinese names and no nonempty effects/tags, so there is no missing rule text to
invent. Any new effect or Japanese tag removes that exemption.

Historical preservation tests remain separate from the new translation layer.
Never rewrite their pinned original hashes to conceal unrelated differences.

## Native data-only contract (compatibility reader: 1.3.2 candidate)

Canonical Japanese card records and rules remain unchanged. `npm run data:translations`
adds only a top-level `cards.json.displayTranslations` member with schemaVersion 1,
locale `zh-Hant`, deterministic revision, displayOnly true and changesGameplay false.
It contains source-guarded `cards[number].fields` for both translation bundles and
optional display-only tag aliases. The full `cards.json` SHA therefore changes on a
translation-only edit; repeat generation without a content change is byte-identical.

Run `npm run data:translations` after changing translations, then test/commit the
exact resulting bytes. Build/Hosting checks reject stale embedded metadata. The
`sourceCatalogSha256` inside that member identifies the original Japanese catalog
bytes after removing only the embedded display member. Never replace Japanese card
rules with their Chinese display values. Native activation must verify originals,
then atomically refresh browsing/name/effect/search/scan translations while keeping
active/saved matches pinned. Installed 1.3.1 does not fetch remote translations;
this requires the separately versioned compatibility reader, not replacement 1.3.1
APK bytes. Native compatibility tests/release status are tracked separately.
