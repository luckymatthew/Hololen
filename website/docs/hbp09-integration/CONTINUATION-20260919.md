# hBP09 continuation — 2026-09-19

This supplements the historical 2026-09-18 report. The full release Definition of Done remains **incomplete** because the later AI Review source/export implementation is unavailable. The website changes are independently releasable. The original strict native integration harness still fails its `battleDiagnostics` assertion; it was not relaxed.

## Source preservation

- Fetched main: `3aaaa392f3906fee00c49f92f01b7e03232d8639`.
- Continued PR #2 from `f754eb98d5011582efa595fdcc221c9055e70d22`; no newer remote changes appeared on the final fetch.
- Located the established production Android 1.2.0 / versionCode 16 source and original Windows build/signing workflow. Ported the specific changes into a separate private copy, preserving its native UI, animations, authentication, deck sync/recovery, current AI and assets.
- Never built or modified the repository's stale Android 0.2.2 preview or disabled its source-ready gate.
- The AI Review 1.0.0-ai-review.2 full source is absent from all three supplied handoffs and the Supplement. The linked ChatGPT source download was blocked; the user has no local copy. Its diagnostics/export and additional AI improvements therefore cannot be certified as retained. The older overlay bundles were not substituted wholesale.

## Rules and data

- Nerissa hBP09-076 chooses a Holo Power **amount**, without revealing hidden card identities; validates funds and archives from the top. hBP09-090 also archives the top Power rather than allowing card selection.
- Multi-target special damage shares one batch identity, so one legacy Subaru reaction reduces every simultaneous hit in that batch, while printed Art damage remains separate. Simultaneous Down clears both units before Life Cheer allocation.
- Legacy Koyori tool and defending-player end triggers join the hBP09 performance-end queue. Active player resolves first, each owner orders its simultaneous triggers, and the turn reset waits until all finish. Legacy end effects no longer fire twice.
- Focused tests cover invalid amount/funds, serialization, card conservation, old/new end ordering, simultaneous damage/Down, and an ineligible Lui replacement of Matsuri's hand cost. These are concrete cases, not exhaustive certification of all card combinations.
- Re-fetched 255 official printing detail pages. Added the new hBP09-100 extra text, `このイベントは〈牛丼〉としても扱う`, including Traditional Chinese display. All captured normalized rule fields then matched. Translation now covers 464 display fields / 169 rule fields across 111 hBP09 cards; translation remains AI-produced.
- Re-downloaded the three official errata artwork printings (hBP04-039 C, hBP09-093 C/S), regenerated with the established WebP settings and verified hashes. The existing tracked WebP bytes already matched those corrected official images.

Official references: [card list](https://hololive-official-cardgame.com/cardlist/), [rules](https://hololive-official-cardgame.com/rules/), [errata 20](https://hololive-official-cardgame.com/errata/20/), [errata 21](https://hololive-official-cardgame.com/errata/21/).

## Verification

| Check | Result |
| --- | --- |
| Complete website suite | 11 sync/release + 2,282 regression; zero failures/skips |
| TypeScript / production build / Firebase artifact guard | Pass |
| Firebase emulator security rules | 7 pass |
| Firebase emulator integration | 3 pass |
| Production Firebase, two independent anonymous SDK clients | Pass: create/join/ready/setup/Cheer, opponent privacy, denied guest full-state read, stale action rejection, disconnect/reconnect; temporary room/accounts removed |
| Current production native host suite | 43 pass; includes full offline AI matches; distinct from the older handoff's 43 diagnostics tests |
| Current-source parity subset | 12 web/native/PvP-bundle transitions equal; 100 AI hidden-world samples retain selected printing |
| Original AI Review release harness | Fails missing `battleDiagnostics`; gate retained |
| Android debug and release unit tests | 68 per variant, zero failures |
| Android debug/release lint and builds | Pass; 0 lint errors, 49 existing warnings per variant |
| API 35 x86_64 emulator, actual signed release APK | 7 instrumentation checks pass; 1 supplied-photo check skipped because no photo samples were provided |
| Original-key signed 1.2.0 → signed RC update | Install-in-place succeeds; exact profile and saved deck preserved (2 additional staged checks) |

Browser observations on the local production implementation: real solo match setup, translated catalog/search/detail, collection count persistence after reload, X=0 payment/once-per-turn disabling, card-menu → selected printing → back slot with reload persistence, mixed legacy/hBP09 end ordering through completion and subsequent AI turn, desktop layout and 390×844 touch-mobile layout. Browser placement used the visible stage buttons; browser pointer dragging is not certified.

Android device checks execute the packaged QuickJS engine and Firebase bundle, translated catalog/art, hidden-Power and X=0 choices, privacy masking, prepare/commit/rollback and restart identity. Instrumentation injects an actual touch drag from the selected-card tray to back4, recreates the Activity and confirms the same printing and revision. Offline Japanese OCR and native libraries load; this does not certify camera accuracy on user photos.

The signed APK is a **local candidate**, `1.2.1-hbp09-rc1` / code 17, package `com.holocard.pocketlab.preview06`. The original certificate is retained. It is not promoted to the public stable download because the later AI Review/export preservation gate remains unresolved. Private source and key material are not published in this repository.

## Remaining acceptance gaps

- Recover/reconcile the later AI Review source and validate diagnostics/battle-data export and its additional AI tests.
- Physical ARM64 phone upgrade, live camera samples, Google sign-in, live account deck sync, browser-to-browser live PvP UI and browser pointer dragging. The production two-client SDK PvP/reconnect test passed separately.
- Broader old/new card permutation audits beyond the focused and full regression suites.
- Public stable APK promotion and download metadata update after those release gates pass. Existing public 1.2.0 download remains intact.

Website deployment from `1160db6a82c83d674916826373d02fac374425e0` succeeded at https://hololive-ocg.web.app/. Public HTML, service worker, catalogs and all 255 hBP09 artwork files match the build. Browser checks confirm the newly added 牛丼 text and stable download link. Service worker version: `holo-firebase-7c11213a95881d76`.

The existing public 1.2.0 APK was anonymously downloaded in all 72 exact byte ranges and hashed in order: 599,776,366 bytes, SHA-256 `88d48a1b317867953f4d77e21cc9114832be3af4f08e512e820fd1d2bd3d4bfd`. The newly signed candidate was not promoted. Deployment and public download evidence are recorded in `DEPLOYMENT-20260919.json`.
