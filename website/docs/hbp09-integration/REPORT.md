# hBP09 integration — 2026-09-18

**Historical report.** See [2026-09-19 continuation](CONTINUATION-20260919.md) for current source, rule fixes, Android build/device/signing evidence and remaining release gates.

Status: **implementation and host validation completed to the available-source boundary; production Definition of Done NOT complete.** No website deployment or signed APK was produced in this run.

## Sources

- Production website base: `3aaaa392f3906fee00c49f92f01b7e03232d8639` (fetched main).
- Imported executable package: `hbp09-executable-20260918.1`, source evidence `f7cebc8c9bfdc6c7787550778669a172f861c592`.
- Translation supplement: 111 cards, 463 display fields, 168 non-empty rule fields. AI translation, not human/official approval.
- Available Android integration target: separately supplied **AI Review 1.0.0-ai-review.2** source. Its documentation explicitly says it does not include all 1.1.0/1.2.0 changes. It was not substituted for the production mobile tree. Native source remains in the companion integration archive.
- Repository `mobile/HoloCardScanner` remains the incompatible 0.2.2 preview; its source-ready release gate was preserved.

## Implemented

- Source-preserving Traditional Chinese website catalog, search, details and simulator display.
- hBP09 runtime/programs/hooks inserted into the production website reducer, with existing pending-choice interfaces and validated actions.
- Zero Holo Power X activation now available for hBP09-002.
- Deck-to-stage choices now expose stage targets, chosen card identity and legal back positions; occupied/invalid destinations reject without mutation.
- Simultaneous **hBP09** performance-end triggers offer player ordering and complete before the turn-reset sentinel. Arbitrary ordering with all legacy-set triggers remains un-certified.
- Native source three-way merge preserves optimized catalog views, the existing NativeRules API, native presentation helpers, expert AI policy, battle diagnostics and save schema.
- Native card names/search use a new immutable number+path+exact-source translator; details use field-specific translation. Original Japanese/canonical objects remain unchanged.
- Native X-payment availability, chosen-card drag payload and hidden-world sampling preserve continuation identities.
- Offline and Firebase native bundles rebuilt from the same merged native reducer. Firebase dispatch preserves init/create/join/public/action/validate; network/authentication code and stored user data were not modified.

## Verification

- Website: `npm test`: 11 sync/release tests + 2,277 regression tests, zero failures/skips; TypeScript and production build pass.
- hBP09 reducer/integration subset: 58 tests pass, including invalid actions, serialization/reload, AI continuations, X=0 and end-trigger ordering.
- Native AI/diagnostics/boundary suite: 43 tests pass. Includes retained older-card AI survival/win checks and battle-record reconstruction.
- Java translation class: compiled using JDK compiler module; all 463 translated fields checked for exact path/source guards, searchable text and no canonical mutation.
- Native integration: 12 web/native/bundled state transitions equal; 100 sampled AI worlds preserve a revealed selection; actual NativeRules init/prepare/commit/rollback/resume exercised; original save schema restored; diagnostic recording retained; opponent views omit the private choice.
- Official live card list: all 17 pages / 255 printings recaptured. Normalized rule-field text matches all 255 stored printings.
- Official errata checked: [hBP09-093](https://hololive-official-cardgame.com/errata/20/) concerns artwork; [hBP04-039 reprint](https://hololive-official-cardgame.com/errata/21/) concerns artist credit. These notices do not change gameplay rules. Artwork bytes were not re-certified against the corrected illustrations in this run.

Host-side bundle/Java checks are **not** Android ART, touch, installation, camera, Google-login or live deck-sync acceptance.

## Outstanding release gates and evidence

| Definition of Done item | Status |
| --- | --- |
| Website catalog and translation | Implemented and tested |
| Executable hBP09 handlers | Integrated and regression-tested; not exhaustive cross-set certification |
| AI and serialized PvP continuations | Host tests pass |
| Current production Android integration | Blocked: exact 1.2.0/current source not present |
| Available AI Review native integration | Implemented; bundles and host tests pass |
| Existing saves/decks | Native save schema and tested fixtures preserved; production upgrade not device-tested |
| Complete website test/typecheck/build | Pass |
| Browser/PvP interaction | Not completed: cloud browser rejected localhost with ERR_BLOCKED_BY_CLIENT |
| Android device/emulator | Not completed: no connected device/emulator/SDK |
| Website deployment | Not completed: Firebase projects:list returned Failed to authenticate |
| APK build with original signing identity | Not completed: current source and authorized original signing workflow unavailable |
| New public APK/checksum | None; existing release metadata left unchanged |

Remaining rule certification includes cross-set replacement costs, simultaneous multi-hit/Down reaction order, mixed legacy/hBP09 end triggers, and all 111 cards' combinations with older modifiers. Passing registration or the current scenario tests does not certify these permutations.

## Reproduce

Website: `cd website && npm ci && npm test`.

Native integration test: `node --experimental-strip-types website/integration-tests/hbp09-native.mjs /absolute/path/to/merged/native/source`.

The companion archive contains the exact native changes, original-source hashes, both generated JS bundles, native tests and validation logs. Apply only to the matching source, or manually three-way merge into the current production source. Never replace the production Android app with the stale preview or this earlier AI Review branch.

Before release, connect the exact current Android source and established signing runner, authenticate the existing Firebase project, then complete browser/device and remaining rules gates. Do not disable ANDROID_SOURCE_READY or create a replacement signing identity.
