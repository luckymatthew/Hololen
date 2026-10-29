# Website UI redesign — 2026-10-29

## Scope
Complete visual and interaction-state refresh of the existing Firebase website, not a new application or engine rewrite. Work started from the card owner's exact integrated source checkpoint (recorded in the preservation fixture). No Android, authentication, storage-schema, Firebase rules, engine, card-data or download endpoint changes.

## Sources and tooling
- Editable Figma system: https://www.figma.com/design/CkkImhoIVG5oxaZNuSj43E
- Official Transitions.dev skill and free recipes: https://github.com/Jakubantalik/transitions.dev/tree/main/skills/transitions-dev ; library https://transitions.dev/ ; community https://transitions.dev/community.html.
- Impeccable design guidance: https://github.com/pbakaus/impeccable ; static skill/reference sources reviewed 2026-10-29.
- Official skill installer failed before execution because its sandbox wrapper could not create a session file. Static Markdown guidance was retrieved from the official repositories; no third-party executable, paid recipe, Pro sign-in, background process or new runtime dependency was installed.

The application integrates selected free Transitions.dev CSS (modal, segmented tabs, accordion and toast) and adapts orchestration to React/native dialog lifecycle. Semantic timing tokens are centralized; reduced motion, interruption/repeated use and focus restoration are explicit. Impeccable Operate/Read, craft floor, motion, audit and polish guidance informed visual decisions and QA; no unavailable CLI detector or Figma capture is claimed as passed.

## Coverage map
| Surface | Controls/states retained and reviewed |
|---|---|
| Shared shell | All aliases, navigation, selected state, theme, guest/auth loading, lazy error recovery, SW update notice, no forced reload |
| Library | Search shortcut/clear, member/generation, color, stage, set, type, sort, grid/list, active chips/reset, deck-only, pagination, loading/failure/no results |
| Card reader | Artwork, alternate printing, rarity, preview release, literal Japanese fallback, warnings, rules/stats, add/remove/count, dismiss/Escape/focus return |
| Deck | Name/draft, 1/50/20 validation, sections and printing quantities, save, unsupported HoloSim export, import, clear confirmation, saved decks and simulator links |
| Account/settings | Google/email/register/busy/error, guest/local preservation, sync, backup import/export, search/sort, active/archive/undo, confirm, appearance sync |
| Scanner | Existing camera/photo/OCR lifecycle and permission/error controls, responsive protected dialog |
| Download | Existing live metadata/fallback, APK/ZIP/history/release links and release limitations |
| Simulator/PvP | Name, saved/imported player and AI decks, counts, disabled/busy/ready, room code, lobby/seats, board/hand/action/choice/log/inspector skin without engine changes |
| Footer log | Small bottom trigger, dated changes, exact new-card/new-printing distinctions, real images, loading/error/retry/cache, scrollable semantic table, keyboard/dismiss/focus |

## Preservation evidence
`tests/fixtures/ui-redesign-2026-10-29-runtime-changes.json` records exact before/after hashes and reversible source changes. Historical card/runtime guards restore only this explicitly scoped UI layer before evaluating their original card/footer baseline. Additional UI tests verify actual current components, retained data semantics and focus/motion behavior. Original catalog and game logic are not exempted.

## Verification
Final command results, browser evidence and source checkpoint are appended after integration. No screenshot-only or limited test is presented as a full gameplay verification.

### Pre-preview integrated checks
- `npm test`: 11 sync checks passed; 3,662 regression checks passed, 0 failed, 1 existing explicit skip for unavailable external Android fixture; TypeScript and production Vite build passed.
- Focused new component/helper/test ESLint: passed. Existing changed source lint errors decreased from 10 to 5; no new rule violations introduced. Whole-repository lint still has inherited failures, and default lint also scans ignored generated test bundles in `work/`.
- Firebase Hosting build guard passed. Served payload audited: 288 runtime/public files, no raw source, tests, docs, source maps, environment files, credentials, signing material or Android binaries.
- Independent source review: no remaining known runtime blockers after fixes to toast centering, tablet list, overlay scroll locks, focus specificity, chip observer lifecycle and keyboard cancellation race. Normal 150ms modal / 250ms toast interruption and retention verified independently as well as in committed tests.
- Historical original-card content, printing identities, literal official Japanese fallback, unsupported-effect warnings and per-printing preview dates pass preserved-content tests.
- Local-browser preview loopback is not reachable from cloud CUA. Installed executor Chromium cannot launch due sandbox socket restrictions. A parent-authorized short-lived Firebase Hosting preview is used for real browser QA; no production replacement at this stage.

### Preview inspection and final refinements
- Real guest browser QA at the available **1180 × 757** CSS viewport passed library search/type/reset/no-results, filter collapse, grid/list, native card dialog variant/Escape/backdrop/focus restoration, disposable printing-aware deck save/clear-cancel/archive/restore, account/settings, download metadata, labeled simulator lobby and exact 57-row update log.
- A valid disposable deck started **local-only solo AI** (the existing single-player branch stores only localStorage before any cloud identity/database call). Actual board, hand collapse/reopen, log drawer, effect inspector and Debut placement/setup confirmation were observed. No multiplayer room or authentication flow was exercised. These are UI checks, not comprehensive card-effect certification.
- Settled dark theme was readable. A transient palette-flip contrast flash prompted atomic foreground/background changes and matching explicit-dark selector specificity; the redundant native search clear icon was suppressed. Quantity targets standardized to 44px. Full aggregate rerun after these UI edits passed with the same 11 sync / 3,662 regression / 1 existing skip result.
- The first Hosting preview release succeeded, but auto-review correctly blocked the CLI's subsequent unauthorized Identity Toolkit domain synchronization. No auth retry was attempted. Read-only Console inspection shows the new preview domain absent; only localhost, primary Firebase/Hosting domains and a pre-existing migration preview are present. This establishes current state, not historical invariance because no full prior domain snapshot exists. Subsequent preview updates use the supported `--no-authorized-domains` flag.
- Real 390/768/1440 browser captures and browser-level reduced-motion preference testing remain unavailable: CUA exposes no resize/preference API, browser zoom did not change the CSS viewport, and the executor's installed Chromium cannot create its sandbox socket. Responsive design/state specimens are verified in editable Figma; reduced and normal motion lifecycle/timing paths are covered by component tests.
- Full source-only ESLint excluding generated `work/` and `dist-firebase/` still reports **36 inherited errors / 80 warnings**; focused new components/helpers/tests are clean. Existing changed-file error count decreased from 10 to 5. No engine/auth/storage cleanup was mixed into this UI task.

### Editable design evidence
Figma has 3 pages (System, Product, Play), 61 variables with native Light/Dark modes, 6 Noto Sans TC text styles, 9 component sets / 47 interaction variants. Final audit: 1,507 native nodes, 727 editable text nodes, 316 instances, 14 artwork masters / 85 discrete content image fills. No flattened complete-UI raster; zero unexpected fonts or bounds overflow. Contrast checks include functional cyan 4.62:1 and warning text 5.39:1. The optional scanner is explicitly unmounted, not a newly invented live feature.
