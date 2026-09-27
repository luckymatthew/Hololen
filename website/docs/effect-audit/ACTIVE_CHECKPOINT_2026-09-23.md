# Active card-effect audit checkpoint — 2026-09-23

This checkpoint is intentionally **incomplete**. It records the first closed repair batch and the exact continuation point; it is not a completion claim.

## Current denominator

- Website catalog snapshot: `public/cards.json`, 1,392 card numbers and 2,906 printing variants; the Android production catalog has the same 1,392 card-number set. The source data is an inventory, not proof of correct rules text or implementation.
- The older `summary.json` in this directory is dated 2026-09-05 and covers 1,276 card numbers / 1,746 effect fields. It is historical evidence only; it does not cover the current hBP09/hSD19 catalog or demonstrate runtime rule correctness.
- The new `CARD_EFFECT_MATRIX_CURRENT.json` is generated from the current catalog and must be kept in sync as this audit progresses. Each ability row carries an independent status. Unverified rows are not silently carried over as correct from the older ledger.
- The official card-list search currently reports 2,982 results, which does not directly reconcile to the local 2,906 printing variants; clarify excluded rule/example records and product scope before claiming catalog exhaustiveness.

## Batch 1 — hBP09-093 《応援するホロリス》

**Finding:** the rules engine allowed the Support with one stage Holomem and one Cheer, and allowed the selected Cheer to be reassigned to its original source Holomem. Both behaviors contradict official Q735–Q737.

**Repair:** reject use before committing the Support when no Cheer can be moved to another own stage Holomem; exclude each selected Cheer’s original zone from its target set. The conditional archive-Cheer clause is evaluated after the mandatory reassignment.

**Evidence:**

- Official card-list text and Q735–Q737: https://hololive-official-cardgame.com/cardlist/?id=2810&expansion=hBP09&view=text
- Official erratum (2026-09-17) concerns illustration correction only: https://hololive-official-cardgame.com/errata/20/
- Website regression: `tests/effect-audit-hbp09-093-q735.test.mjs`.
- Android packaged QuickJS bundle regression: `android-current/tests/hbp09-release.test.mjs`.
- Android JNI instrumentation regression: `android-current/app/src/androidTest/java/com/holocard/scanner/nativegame/Hbp09DeviceTest.java`.

**Current status:** website source and packaged Android JS bundle pass Q735/Q736/Q737 tests. Actual browser interaction and Android JNI instrumentation remain unverified. Do not mark this ability fully verified until both runtimes are exercised.

## Batch 2 — hBP09-094 《さかまたとおそろい》, Q738/Q739

**Finding:** checked the documented reset-order and reset-immunity edge cases. The implemented effect directly rests the selected opposing back Holomem; it does not become a reset event, and replacement during reset does not clear the rested state.

**Evidence:** `website/tests/effect-audit-hbp09-094-reset.test.mjs` and `android-current/tests/hbp09-release.test.mjs` each exercise both rulings through the production rules entry point. The Android package fixture checks the authoritative saved pending-choice state where the public view intentionally redacts the opposing choice type.

**Current status:** headless website and the packaged Android JS bundle pass. Browser UI and JNI/device runtime remain blocked by unavailable current app/device sessions.

## Batch 3 — hBP09-102 《僕に続けー！》, Q746–Q748

**Finding:** Q748 exposed a real legality defect: the engine allowed activation with both the deck and Holo Power empty. Q746/Q747 also require taking one Holo Power whenever one is available, including when the deck is empty.

**Repair:** gate activation on Hajime being the Oshi and at least one payment source (deck or Holo Power) being nonempty; retain the existing required selection behavior.

**Evidence:** `website/tests/effect-audit-hbp09-102-power-ruling.test.mjs` first reproduced Q748 as a false legal activation, then passes Q746–Q748 after the shared eligibility repair. `android-current/tests/hbp09-release.test.mjs` runs the same cases against the rebuilt packaged bundle.

**Current status:** website and packaged Android JavaScript tests pass; browser choice controls and Android JNI/device remain unverified.

## Batch 4 — revision-169 AI recovery and native review payloads

**Finding:** the attached original Android 1.2.3 rules bundle deterministically rejects the saved revision-169 action with an `undefined` JSON-state error. The current production bundle completes the AI continuation through the next non-AI decision, retains decision telemetry, and returns nonempty `match.json` and `ai-review.json` plus manifest/README.

**Regression:** `android-current/tests/ai-repair-release.test.mjs` reproduces the old bundle failure and verifies continuation/export against the current `app/src/main/assets/native/engine.js`. The current two tests pass in the host Node VM.

**Limit:** this evidence does not validate QuickJS/JNI, Android SAF Downloads writes, or a real ZIP saved on device. No connected Android device or configured emulator is available. The Java export-readback tests still require runtime execution, not only compilation.

## Batch 5 — official hBP09 Q740–Q751 coverage

**Rule sources:** official Q740–Q751 entries dated 2026-09-11, including per-card official Q&A on hBP09-095, -097, and -104; official comprehensive rules 1.9.0 dated 2026-06-12 remains the shared-rule baseline. Q746–Q748 are in Batch 3 and Q738/Q739 in Batch 2.

**Coverage added:** Q740 pre-resolution Archive counting for hBP09-095; Q741–Q743 single-Holomem/single-Cheer cycle for hBP09-097; Q744 current Support excluded from hBP09-098's Archive condition; Q745 turn-wide Arts count for hBP09-101; Q749/Q750 tied maximum HP plus buff persistence through Bloom for hBP09-104; and Q751 mandatory shuffle after an unproductive search through hBP09-090.

**Result:** all six new website cases pass through `applyAction`; all six corresponding packaged Android JavaScript cases pass through NativeRules `prepare`/`commit` and choice handling. These tests found no additional code defect in those exact branches. The hBP09-090 Q751 test asserts recorded shuffle entropy with no eligible search result, rather than inferring shuffle from the unchanged card count.

**Current status:** headless state-settlement is evidenced for the cited Q740–Q751 card branches. Browser choice controls, QuickJS/JNI, and physical device are still blocked/unverified. This does not verify every other branch of these abilities or the remaining 2,460+ matrix entries.

## Batch 6 — official hBP09 Q715/Q716 attack and hand-size timing

**Coverage:** Q715's separate Center and Collab Arts damage events do not combine into one 100-damage event; Q716 checks the attacker's post-draw hand size when hBP09-069 modifies incoming Arts damage.

**Evidence:** `tests/effect-audit-hbp09-q715-q716.test.mjs` and the prior packaged-bundle regression described in the existing test evidence. Website behavior passes. Current device/JNI and UI evidence is still outstanding.

## Batch 7 — official hBP09 Towa Q709–Q713 and repeat-Arts rulings

**Sources:** official hBP09-005 card/Q&A, including Q709–Q713: https://hololive-official-cardgame.com/cardlist/?id=2722&view=text. Cross-card sources include hBP01-023 and Q53/Q226: https://hololive-official-cardgame.com/cardlist/?id=56; hEB01-010 Q695/Q696: https://hololive-official-cardgame.com/cardlist/?faq=&id=2576; and Beach Ball Q702: https://hololive-official-cardgame.com/cardlist/?faq=&id=2508.

**Reproduced defects and repairs:**

- Q53/Sora repeat-Arts commands could switch to another opposing Holomem. Bind this card's repeat to the chosen target identity as well as attacker and Art.
- If the chosen target was knocked out, the repeat marker stayed active after the knockout committed, blocking every other attacker. Clear that marker and re-rest the attacker once its exact target has left play.
- hEB01-033 Beach Ball movement was prompted before Arts damage. Q702 requires damage first, movement second and hEB01-010's repeat afterward. Schedule only this tool's movement trigger after the complete damage batch.

**Coverage:** `tests/effect-audit-hbp09-005-q709-q713.test.mjs` and `tests/effect-audit-repeat-arts-rulings.test.mjs` cover Q709 legal second Art, Q710 printed-cost enforcement, Q711 no intervening attack, Q53 repeat order and target, Q712 ten actual uses/draws, target-down cleanup, Q695/Q696 repeated action/retargeting, Q713 five repeats/six Arts, and Q702 damage/tool/repeat order. `tests/simulator-summer-support-batch247.test.mjs` protects prior Beach Ball +10 behavior. These 12 focused cases pass after repair; Q702's before-fix case failed because damage was still zero when the move choice appeared.

**Current status:** website engine and candidate API state-settlement pass for the listed branches. Packaged Android JS parity for repeat-Arts is included in `android-current/tests/repeat-arts-release.test.mjs` and passed in the 2026-09-23 host suite. This is partial ability evidence, not exhaustive card coverage. UI/browser verification and Android QuickJS/JNI/device parity remain outstanding.

## Batch 8 — hBP02-102 Shion Fan Q227 and hBP01-005 Lui Oshi skill Q34/Q35

**Sources:** hBP02-102 Japanese text and official Q227: https://hololive-official-cardgame.com/cardlist/?id=369 and https://hololive-official-cardgame.com/rules/question/faq/ . hBP01-005 Japanese Oshi-skill text and Q34/Q35: https://en.hololive-official-cardgame.com/cardlist/?expansion=hBP01&id=35&view=text .

**hBP02-102 finding:** Q227 distinguishes damage being fixed (when the Fan archives) from damage having been received (after HP decreases). The sampled production engine timing matched that rule; the old direct-queue tests did not prove an actual attack. Added real `applyAction(attack)` regressions: two attached Shion Fans both archive for positive Arts damage; a damage-reduced-to-zero Arts leaves the Fan attached. No source repair was justified by these scenarios.

**hBP01-005 finding:** Q34 permits mixed Holo Power and hand-card payment; Q35 permits archiving more Holo Power than hand cards, up to available Holo Power. Website coverage already existed. Added Android packaged-bundle real choice/action parity tests for mixed payment and a 4-Holo-Power/one-hand-card Q35 payment.

**Evidence:** `website/tests/simulator-shion-fan-zero-audit.test.mjs` (12/12), `website/tests/simulator-lui-payment-audit.test.mjs` (25/25), `website/tests/effect-audit-repeat-arts-rulings.test.mjs` (6/6); Android `tests/shion-fan-q227-release.test.mjs`, `tests/lui-payment-release.test.mjs`, and `tests/repeat-arts-release.test.mjs` (7/7 combined). Website focused outputs are saved under `evidence/effect-audit/20260923-batch-09-website-*.log`; Android focused output is `evidence/effect-audit/20260923-batch-09-android-focused-final.log`.

**Current status:** website source and packaged Android JS host-route cases pass. Q227's Arts +10 clause and Shion-only attachment restriction remain unverified, and none of these results proves Android QuickJS/JNI/device UI execution.

## Environment recheck — current Android source/runtime

The actual production Android source is present at `C:\Users\lucky\Documents\ChatGPT\Hololive OCG\android-current` (application id `com.holocard.pocketlab.preview06`, version 1.2.5, versionCode 24, compileSdk 36). It has full NativeRules source and current website-simulator-derived offline/PvP bundles. Do not use `mobile/HoloCardScanner` version 0.2.2-preview as a substitute.

Fresh Android host suite: `node --test tests/*.test.mjs` — 107/107 passed in 84.6 seconds on 2026-09-23. This validates host-level source/package fixtures, including current bundle dispatch through Node/VM test adapters; it does **not** execute Android QuickJS/JNI or device UI. Fresh package-focused Q227, Q34/Q35, and repeat-Arts checks: 7/7 passed.

Android Gradle build/instrumentation is blocked in this environment: the required Gradle 8.11.1 distribution is absent from the wrapper cache, and `gradlew --offline ... testDebugUnitTest testReleaseUnitTest lintDebug lintRelease assembleDebug assembleRelease` attempts to download it but network access fails with `java.net.SocketException: Permission denied: getsockopt`. Android SDK paths/environment variables and `adb.exe`/`emulator.exe` are absent; no physical device is connected. Do not call the old APK artifacts a current candidate or sign them.

The original signing script `android-current/scripts/sign-release-windows.ps1` is present and pins the installed-app certificate SHA-256 to `92a20ef4e5e7a93e96865577fc90978ba085c0723a0145bcda58c848f5b84f4a`; the matching keystore has not been located in the available scanned locations. A private-source archive named `outputs/Hololens-1.2.5-PRIVATE-source.zip` is absent, but the full source tree is present. Signing continuity must be verified against the actual candidate and original key before a release build can be claimed.

Local website production preview smoke check on 2026-09-23: homepage rendered 1,392 catalog cards and simulator route loaded its solo/private-match UI. Start buttons were disabled with no deck loaded; no browser match/effect choice was played. This does not count as browser gameplay verification or production deployment.

## Baseline and environment

- Website fresh full suite/build on 2026-09-23: 2,366 Node test assertions passed, zero failed; package script also reported 11/11 supplementary checks and Vite production build succeeded. Logs: `evidence/effect-audit/20260923-batch-09-website-full-final.log` and `evidence/effect-audit/20260923-batch-09-website-build.log`.
- Current regenerated matrix: 1,392 cards, 2,468 ability rows, 3,135 clauses; 19 ability rows partial, 2 clauses partial, 2,449 rows and 3,133 clauses unverified; all 1,392 card checks unverified; `complete:false`. Do not infer that a whole card is verified from a single covered branch.
- Current website/Android local catalog parity: 1,392 card numbers and 2,906 printing variants each; no missing numbers or gameplay-field differences across the compared fields. Official list search reports 2,982 records; product/printing denominator still unreconciled. Provenance and hashes: `evidence/effect-audit/20260923-batch-09/source-and-data-provenance.json`.
- Current connected-device check: no Android devices attached. Android SDK and emulator executable/system image are absent.
- Release signing: preserve the original identity; do not substitute a key. The release signing workflow's expected certificate is documented above; the original keystore still needs to be made available/located.
- No website deployment, public artifact publication, push, or merge has been performed.

## Resume here

1. Continue official-source batches with a concrete clause selected from the unverified matrix; add at least one isolated semantic failing-before test, fix only when the root behavior is wrong, and update clause evidence/status. Keep source URL and exact Q&A/ruling metadata.
2. Resume the hBP09 JNI/device cases Q738/Q739 and Q746/Q747/Q748 when Gradle 8.11.1, Android SDK, and device/emulator become available.
3. Reconcile released products and printing variants to the official card list, including boosters, starters, promos, Oshi skills and Support clauses; the 1,392/2,906 local catalog is equal across runtimes but unreconciled with the 2,982 official results.
4. Independently construct source-grounded cases for every remaining ability and shared-rule branch. Keep all rows unverified until the required evidence exists; continue updating the generated matrix and provenance hashes.
5. Verify scanner latency/art, enemy-hand count UI, JSON/ZIP delivery/readback, AI recovery, offline/deck/account features, browser gameplay/effect choices, original signing continuity, and actual Android QuickJS/JNI/device behavior. Current host tests and local website route smoke test do not close these gates.
6. Do not publish/deploy/merge. Do not declare complete while any applicable row or production runtime gate remains unverified/blocked.

## Batch 11 — hBP09-109 《メイクアップ》 and repeat-Bloom shared rule (2026-09-24)

**Official sources:** current official Japanese card text: https://hololive-official-cardgame.com/cardlist/?id=2963. Comprehensive Rules ver. 1.9.0, last updated 2026-06-12: https://hololive-official-cardgame.com/wp-content/themes/tcg/assets/img/rule/whole_rule_ver190.pdf (5.14.2 damage through Bloom; 5.17.3.1 one Tool per Holomem; 5.28.1 repeat-Bloom bypasses only the already-Bloomed-this-turn condition once; 8.3.2-8.3.4 ordinary Bloom restrictions; 10.8.1-10.8.3 automatic-ability timing). The inspected official card entry had no card-specific Q&A or erratum.

**Reproduced defect:** actual website applyAction and packaged Android NativeRules prepare/commit scenarios each performed a normal Bloom, then the hBP06-090 extra Bloom on that same FLOW GLOW unit, then reached hBP09-109's Performance-end trigger. Before repair, both incorrectly offered the same unit again because the generic repeat-Bloom turn flag was not tracked per stage unit.

**Repair:** track extraBloomUsedTurn on the stage unit whenever a shared repeat-Bloom effect resolves; filter that unit from additional repeat-Bloom effects, including Makeup. Preserve eligibility for other units. Mark Makeup use at commit. Legacy midturn saves that contain a prior generic extra Bloom but lack the per-unit attribution now migrate to a conservative unknown-use marker, preventing a second Bloom where identity cannot be recovered. Normal name, level, entry-turn and HP checks still apply, and damage/rest state remains on the same stage unit. Android offline and PvP bundles were rebuilt from the real current Android source.

**Evidence:** website/tests/effect-audit-hbp09-109-makeup.test.mjs and android-current/tests/hbp09-109-makeup-release.test.mjs each pass 14/14. They cover +20 Arts, valid end-step Bloom, legal name/level/HP constraints, both optional declines, FLOW GLOW/turn/entry restrictions, one use per target, a different eligible target, legacy-save migration, 1st-Center gate, below-1st exclusion and Tool cap. The new regression failed against both pre-fix runtimes before the shared per-unit rule repair. Saved outputs: evidence/effect-audit/20260924-batch-11/website-focused.log and android-packaged-focused.log.

**Related full verification:** website npm test: 2,384 passed, 0 failed; typecheck passed and Vite Firebase production build succeeded. Android node --test tests/*.test.mjs: 126 passed, 0 failed. Logs: website-full-final.log and android-host-full-final.log. Provenance, current source and generated artifact hashes: evidence/effect-audit/20260924-batch-11/provenance-batch11.json.

**Coverage state:** current denominator is 1,392 cards / 2,906 printings / 2,468 abilities / 3,135 clauses. 22 ability rows and 8 clauses are PARTIAL; 2,446 ability rows and 3,127 clauses remain UNVERIFIED; all 1,392 card-level checks remain UNVERIFIED; complete:false. These host tests do not close browser choice UI or Android QuickJS/JNI/device execution. No production deployment or release build was performed.

## Resume point recorded after Batch 11 (superseded) — 2026-09-24

At that point the next action was to pick another official ability and add a source-grounded test. Batches 12–15 below record the work since then and supersede the older counts above.

## Batch 12 — shared hidden-zone card counts (2026-09-24)

**Official source:** Comprehensive Rules 1.9.0, clauses 4.1.2.2–4.1.2.3: https://hololive-official-cardgame.com/wp-content/themes/tcg/assets/img/rule/whole_rule_ver190.pdf . Card count is public for private zones; hidden card identities remain private unless revealed.

**Finding:** the actual current Android production code already retained the opponent hand count while redacting identities across the Firebase public-state projection, packaged NativeRules online orientation, and packaged UI badge. The user screenshot also shows the expected “對手手牌 6張” display. No source defect was reproduced, so no repair was made.

**Evidence:** `android-current/tests/opponent-hand-count-release.test.mjs` covers both viewer orientations, public projection, packaged `engine.js`, `firebase-rules.js`, `app.js` and `app.css` rendering/redaction. Node host assertions pass. `website/docs/effect-audit/shared-rule-audit.json` and the matrix generator now track shared rules separately from the fixed card denominator.

**Current status:** PARTIAL. Packaged host behavior is checked; live PvP count updates and portrait/landscape Android WebView presentation remain unverified on a browser/device.

## Batch 13 — hBP09-008 Subaru Gift, Q714 (2026-09-24)

**Official source:** https://hololive-official-cardgame.com/cardlist/?id=2725 (Japanese card text and Q714 dated 2026-09-11); Comprehensive Rules 1.9.0.

**Finding:** current website hook compares the damage from the individual Arts event. Q714 says damage from distinct Center and Collab Arts is not aggregated to meet the Gift threshold. No defect was reproduced in these branches, so no production repair was made.

**Evidence:** `website/tests/effect-audit-hbp09-q715-q716.test.mjs` runs two real 20-damage Arts actions (40 cumulative, no trigger) and one real 50-damage Arts event (Gift deals 30 special damage). `android-current/tests/hbp09-qa715-716-release.test.mjs` repeats the event behavior in the packaged offline engine and PvP reducer. Focused results: website 3/3; Android combined Q714–Q716 and hand-count tests 5/5. Both runtime rows remain PARTIAL pending actual UI/device execution.

## Batch 14 — hBP09-014 Subaru Gift, Q717 (2026-09-24)

**Official source:** https://hololive-official-cardgame.com/cardlist/?id=2731. The current Japanese text triggers once during the opponent turn after at least 200 Arts damage in one event and returns all Cheer on the opponent Center to the bottom of that Cheer deck in a chosen order. Official Q717 (2026-09-11) says separate Center and Collab Arts whose damages sum to 200 do not trigger it. Comprehensive Rules 1.9.0 clauses 9.1.2 and 10.6.1.1, 10.6.3.1–10.6.3.3 govern the Arts checkpoint and resolving rule processes before waiting automatic abilities.

**Finding:** no rules defect was reproduced in the tested website or packaged Android bundles. One initial Android offline test tried to submit a manual choice owned by the AI; the real offline flow instead runs the AI step. Correcting that test harness to let the AI resolve its mandatory ordering showed the existing behavior is correct.

**Evidence:** `website/tests/effect-audit-hbp09-014-q717.test.mjs` settles two actual 100-damage Arts events separately and one actual 200-damage Arts event, including the defeated Subaru’s Life Cheer before the Gift trigger and the selected deck-bottom order. `android-current/tests/hbp09-q717-release.test.mjs` verifies those event semantics against packaged offline `engine.js` (including AI-owned choice) and PvP `firebase-rules.js`. Focused runs: website 2/2 and Android 2/2.

**Runtime limits:** website `applyAction`, current Android packaged JavaScript offline prepare/commit/AI and PvP dispatch all pass on the host. Browser UI and Android QuickJS/JNI/device gameplay remain unverified.

## Batch 15 — hBP09-023 Zeta Gift, Q718 (2026-09-24)

**Official source:** https://hololive-official-cardgame.com/cardlist/?id=2740. The card's Gift rolls twice when this Holomem downs an opponent, if its controller's Oshi is Vestia Zeta; when the dice sum equals both players' combined Life count, the opponent loses one Life. Q718 (2026-09-11) says the Gift cannot be used after the Down process has finished.

**Finding:** no source defect was reproduced. The decisive timing case gives both players four Life and uses a deterministic 4+4 roll while Zeta's actual 120 Arts downs a 110 HP Hajime. The Gift's additional Life loss and Life Cheer become pending while the defeated Holomem is still `downPending`, before normal Down processing removes its Life. After the mandatory Life Cheer choice, normal Down handling removes the second Life. Delaying the Gift until after that would compare against the wrong combined Life total.

**Evidence:** `website/tests/effect-audit-hbp09-023-q718.test.mjs` runs the complete website `applyAction` attack/Down pipeline and checks both Life-loss records and state boundaries. `android-current/tests/hbp09-q718-release.test.mjs` runs the production packaged offline NativeRules prepare/commit attack followed by the AI-owned Life Cheer choices. Focused runs pass 1/1 each. Full suites after adding this case are running; record their final counts below.

**Runtime limits:** website simulator source and packaged Android JavaScript offline/AI path are host-verified. Browser gameplay and Android QuickJS/JNI/physical-device execution remain unverified. This ability row is PARTIAL.

## Batch 16 — hBP09-037 Fantastic Driver, Q719 (2026-09-24)

**Official source:** https://hololive-official-cardgame.com/cardlist/?id=2754. Official Japanese text lets the controller return one own Back Holomem with #FLOW GLOW and all Holomem stacked under it to hand when this Holomem downs an opponent. Q719 (2026-09-11) explicitly says Cheer and other cards attached to that Holomem do not return; all attached cards go to Archive.

**Finding:** no production rules defect was reproduced. The website and current packaged Android rules select only an eligible #FLOW GLOW Back unit, return its entire Holomem stack to hand, archive attached Cheer and Tool cards, and then continue the defeated opponent's normal Down Life sequence. A first website test stopped while the Life Cheer card was pending and its whole-state conservation assertion therefore reported it as missing. The card was still represented by `pendingChoice.cheerCard`; after completing that choice, full card conservation passed. This was a test-accounting issue, not a lost card or engine repair.

**Evidence:** `website/tests/effect-audit-hbp09-037-q719.test.mjs` and `android-current/tests/hbp09-q719-release.test.mjs` each pass 1/1. Both include a non-#FLOW GLOW Back unit as a negative target. The Android case runs packaged NativeRules prepare/commit and the offline AI's Life Cheer choice. `evidence/effect-audit/20260924-batch-11/website-full-batch16.log` records 2,389 tests passing, TypeScript passing, and a successful Firebase production build. `android-full-batch16.log` records 133/133 tests passing. `provenance-batch16.json` records current hashes and the partial coverage state.

**Runtime limits:** website `applyAction` and packaged Android JavaScript/NativeRules through the Node host adapter pass. Actual browser choice UI and Android QuickJS/JNI/device gameplay remain unverified. This ability row is PARTIAL.

## Batch 17 — hBP09-042 / hBP09-004 / hBP09-107, Q720/Q721 (2026-09-24)

**Official sources:** hBP09-042 `https://hololive-official-cardgame.com/cardlist/?id=2759`; hBP09-004 `https://hololive-official-cardgame.com/cardlist/?id=2849`; hBP09-107 `https://hololive-official-cardgame.com/cardlist/?id=2824`; Comprehensive Rules 1.9.0.

**Finding:** Q720 confirms that hBP09-042's Arts attachment activates hBP09-004's once-per-turn Oshi Stage Skill and draws two. That behavior was already correct. Q721 confirms hBP09-107's +40 Arts applies to the same hBP09-042 Arts that attaches it. This exposed a real timing defect: the engine queued 70 damage before the Archive Tool choice and left it at 70 after attaching the Sword. The website and packaged Android offline tests reproduced the defect.

**Repair:** the attach hook updates only the matching pending hBP09-042 Arts damage record by +40 once. A Tool already attached before the Arts still gives exactly +40, avoiding double counting. The same source change was ported to the actual Android `web/lib/simulator` source and both offline/PvP bundles were rebuilt.

**Evidence:** before-fix outputs `evidence/effect-audit/20260924-batch-11/website-q720-before-fix.log` and `android-q720-before-fix.log`; focused suite `website-q722-after-fix.log` and `android-q722-after-fix.log`; tests `website/tests/effect-audit-hbp09-q720-q721.test.mjs` and `android-current/tests/hbp09-q720-q721-release.test.mjs`. This batch's immediate full suites passed 2,391 website checks plus TypeScript/Firebase build and 136 Android host/package tests; later final suites after Batch 18 are recorded below.

**Runtime limits:** website source and the actual production Android packaged offline NativeRules/PvP reducer pass host tests. The browser app preview loaded, but Q720's full SimulatorClient interaction was not browser-tested. Android QuickJS/JNI/device remains blocked.

## Batch 18 — hBP09-043 / hBP09-044 Tool limits, Q722/Q723 (2026-09-24)

**Official sources:** hBP09-043 `https://hololive-official-cardgame.com/cardlist/?id=2760`; hBP09-044 `https://hololive-official-cardgame.com/cardlist/?id=2761`; Comprehensive Rules 1.9.0 clauses 4.4.4, 5.14.2, 5.14.3, 5.17.3.1 and 5.17.3.3.

**Findings:** Q722 exposed a real shared-rule defect. After hBP09-044 with two Tools Blooms into hBP09-043, the website and both Android packaged reducers kept both Tools attached; official Q722 says one is sent to Archive. Q723 is already correct: the extra Tool on hBP09-044 must have #カエラ'sアームズ. The initial negative test expected the entire Tool play to fail, but that Tool remained legal on another Holomem; the corrected test verifies that Kaela is absent from its target list.

**Repair:** the common post-Bloom path now reevaluates Tool and Mascot capacities from the newly visible top card before resolving Bloom and attached-card triggers. It presents a mandatory choice of an excess attachment, archives it, and repeats the check if the count is still over the limit. The hBP02-013 two-Mascot capacity exception remains represented.

**Evidence:** before-fix failures are in `website-q722-before-fix.log` and `android-q722-before-fix.log`. Focused after-fix outputs are `website-q722-after-fix.log` (6/6 with Q719/Q720 regressions) and `android-q722-after-fix.log` (7/7 with Q720 regressions). Tests are `website/tests/effect-audit-hbp09-q722-q723.test.mjs` and `android-current/tests/hbp09-q722-q723-release.test.mjs`. Browser proof is `browser-q722.log`; it shows the real source engine offered Bloom, then both Tool choices, and finished with one Tool attached, one archived, and no pending choice.

The browser harness is `website/tests/browser/effect-audit-q722.html` and `.mjs`. It exercises the actual current simulator module and card catalog in the browser; it is not a full SimulatorClient React match interaction. The Firebase production candidate page was also loaded at `http://127.0.0.1:5174/simulator`.

## Latest resume state — 2026-09-24

Fresh complete suites after both repairs: `website-full-batch17-final.log` records 2,394 passed, 0 failed, TypeScript passed, and Firebase production build passed; `android-full-batch17-final.log` records 140 passed, 0 failed. `node scripts/build-hbp09-bundles.mjs` rebuilt the real Android offline NativeRules and PvP Firebase reducer from `android-current/web/lib/simulator`.

The regenerated matrix has 1,392 cards, 2,906 printings, 2,468 ability rows and 3,135 clauses. Current status: 30 ability rows PARTIAL, 2,438 UNVERIFIED; 17 clauses PARTIAL, 3,118 UNVERIFIED; all 1,392 card checks UNVERIFIED; two shared rules PARTIAL; `complete:false`. Q722/Q723, hBP09-004 Oshi stage skill, hBP09-042 Arts, hBP09-044 Gift and both hBP09-107 clauses are only PARTIAL as recorded in the per-clause matrix. Provenance: `evidence/effect-audit/20260924-batch-11/provenance-batch17-18.json`.

Resume with a fresh official Japanese-text/Q&A branch from an UNVERIFIED ability row. Continue the complete card and shared-rule audit; do not mark the audit complete from these partial rows or a high test count. Actual Android APK/device verification remains blocked: Gradle 8.11.1 and Android SDK/emulator are unavailable, no device is connected, and the original signing keystore is not located. Website production build/browser source harness pass, but no deploy, push, merge, public publication, signed APK, or release was performed. Preserve scanner, saved games, AI and account/deck/export behavior during future changes.

## Batch 19 — hBP09-063 Student of Time, Q730 (2026-09-24)

**Official sources retrieved 2026-09-24:** hBP09-063 Japanese card page and Q730 `https://hololive-official-cardgame.com/cardlist/?id=2780`; alternate printing page `https://hololive-official-cardgame.com/cardlist/?id=2893`; Q588 `https://hololive-official-cardgame.com/cardlist/?id=1791`; official FAQ Q195 `https://hololive-official-cardgame.com/rules/question/faq/`; Comprehensive Rules 1.9.0 PDF `https://hololive-official-cardgame.com/wp-content/themes/tcg/assets/img/rule/whole_rule_ver190.pdf`, clauses 5.7 and 10.1.3.1. Q730 says the bottom card is drawn face down; Q588 says the bottommost card is first when drawing from the bottom; Q195 distinguishes an effect draw failure on an empty deck from losing in the hand step.

**Finding:** no production behavior defect was reproduced. The dedicated `drawBottom` operation removes the last instance from the simulator's top-first main-deck array and adds it directly to the owner's hand without a reveal event. Its named-use key is player-wide and turn-scoped. The official behavior passed deterministic order, no-reveal, private-view, empty-deck, across-copy limit, next-turn reset, persistence, and card-conservation checks.

**Evidence:** website `tests/effect-audit-hbp09-q730.test.mjs` passes 3/3; browser harness `tests/browser/effect-audit-q730.html` passes in the actual current Chrome source-engine/card-catalog page (`evidence/effect-audit/20260924-batch-11/browser-q730.log`). Android `tests/hbp09-q730-release.test.mjs` passes 3/3 against the actual packaged offline `engine.js` and PvP `firebase-rules.js` through Node VM adapters; it compares website and Android final state and checks offline save/restore. Full `npm test` passes 2,397 regression checks, 11 sync checks, TypeScript, and Firebase production build (`website-full-batch19.log`). Full Android Node suite passes 143/143 (`android-full-batch19.log`). Scanner index safeguards pass 3/3 in the bundled Python runtime with an import-only `cv2` shim: the offline incomplete-cache path raises before any OpenCV operation (`android-scanner-index-validation-batch19.log`). The direct Python runs show the shell lacks Python and the bundled runtime lacks OpenCV (`android-scanner-preservation-batch19.log`); the actual image-processing/scanning path was not exercised.

**Coverage status:** matrix row `hBP09-063:keyword` and its two clauses are PARTIAL because Android QuickJS/JNI/WebView and physical-device execution remain unavailable. `hBP09-063:arts.0` is still UNVERIFIED. Batch 19 provenance and source/package SHA-256 hashes are in `evidence/effect-audit/20260924-batch-11/provenance-batch19.json`. Current inventory: 1,392 card records, 2,906 printings, 2,468 ability rows and 3,135 clauses; 31 PARTIAL / 2,437 UNVERIFIED ability rows, 19 PARTIAL / 3,116 UNVERIFIED clauses, three PARTIAL shared rules, all 1,392 card identity/basic-action checks UNVERIFIED; `complete:false`.

**Next:** continue from an UNVERIFIED row using current official Japanese text and Q&A; do not treat the unrelated Arts ability on hBP09-063 or the overall card as verified. Re-run the website and packaged Android suites after any shared-rule or source changes. Physical QuickJS/device behavior, scanner feature extraction, and the other Android feature/device smoke checks remain unverified.

## Batch 20 — hBP06-008 / hBP09-087 LIMITED Support allowance, Q509/Q732 (2026-09-24)

**Official sources retrieved 2026-09-24:** hBP09-087 Japanese card text and Q732 `https://hololive-official-cardgame.com/cardlist/?id=2804`; hBP06-008 Japanese SP Oshi Skill text and Q509 `https://hololive-official-cardgame.com/cardlist/?expansion=hBP06&id=1605&view=image`; Comprehensive Rules 1.9.0 PDF `https://hololive-official-cardgame.com/wp-content/themes/tcg/assets/img/rule/whole_rule_ver190.pdf`, clauses 8.4.2, 8.5.1 and 8.6.2. Q732 says no additional two LIMITED Supports may be used after the Matsuri SP skill already enabled two and both were used. Q509 says that SP skill does not make LIMITED Supports legal on the first player's first turn. Clause 8.4.2 permits an active Back Holomem to Collab without a Bloom-level restriction.

**Finding:** no production behavior defect was reproduced. Both effects assign the total per-turn allowance of two rather than adding allowances. The engine counts two actual LIMITED Supports, preserves that count when the later Collab effect resolves, and rejects a third. The first-player first-turn restriction remains independently enforced. An active hBP09-087 2nd Holomem in Back legally Collabs.

**Evidence:** website `tests/effect-audit-hbp09-q732.test.mjs` passes 4/4, including Q732 exact order, reverse activation order, Q509, action-candidate rejection, and 2nd Collab. Browser harness `tests/browser/effect-audit-q732.html` passes against the current website engine and catalog; result is recorded in `evidence/effect-audit/20260924-batch-20/browser-q732.log`. Android `tests/hbp09-q732-release.test.mjs` passes 6/6 against the actual packaged `engine.js` offline NativeRules and `firebase-rules.js` PvP reducer. Full website run: 2,401 regression checks and 11 sync checks passed, TypeScript passed, and Firebase production build passed (`website-full-batch20.log`). Full Android Node host/package suite passes 149/149 (`android-full-batch20.log`). Provenance and 22 source/package hashes with no missing files are in `evidence/effect-audit/20260924-batch-20/provenance-batch20.json`.

**Coverage status:** `hBP06-008:spOshiSkill`, `hBP09-087:keyword`, and shared rule `rule-8.6.2-limited-allowance-does-not-stack` are PARTIAL; card-specific prerequisites and actual Android QuickJS/JNI/WebView/device behavior remain outstanding. `hBP06-008:oshiSkill` and `hBP09-087:arts.0` remain UNVERIFIED. Current inventory: 1,392 card records, 2,906 printings, 2,468 ability rows and 3,135 clauses; 33 PARTIAL / 2,435 UNVERIFIED ability rows, 21 PARTIAL / 3,114 UNVERIFIED clauses, four PARTIAL shared rules, and all 1,392 card identity/basic-action checks UNVERIFIED; `complete:false`.

**Latest resume state — 2026-09-24:** continue from an UNVERIFIED ability/shared-rule row using live official Japanese text and card-specific Q&A; do not equate a correct Q732 allowance with full hBP06-008 or hBP09-087 verification. Device verification remains blocked because Android SDK/Gradle emulator and a physical device are unavailable. Preserve this branch and all pre-existing working-tree material. No deploy, publication, merge, push, signing or release has been performed.

## Batch 21 — hBP09-050 Subaru Collab movement, Q725 (2026-09-24)

**Official sources:** hBP09-050 Japanese text and official Q725 at `https://hololive-official-cardgame.com/cardlist/?id=2767`; Comprehensive Rules 1.9.0 clauses 5.16.1, 8.4.2, 13.2.1 and 13.2.2.

**Finding:** effect-driven movement of an opponent's Back Holomem into Collab is not itself a Collab action and does not activate that Holomem's Collab Effect (Q725). No current website or packaged Android defect was reproduced. The movement also leaves the Collab action counters unchanged in the tested reducers.

**Evidence:** website `tests/effect-audit-hbp09-q725.test.mjs` 3/3; browser `tests/browser/effect-audit-q725.html/.mjs` PASS; Android packaged offline/PvP `tests/hbp09-q725-release.test.mjs` 6/6. Full website `evidence/effect-audit/20260924-batch-21/website-full-batch21.log`: 2,404 regression checks + 11 sync checks, TypeScript and Firebase production build pass. Android full suite: 155/155 (`android-full-batch21.log`). No source repair required. Matrix: 34 PARTIAL ability rows, 24 PARTIAL clauses and 5 PARTIAL shared rules; overall remains incomplete.

## Batch 22 — hBP09-050 Subaru Arts, official card text (2026-09-24)

**Official source:** hBP09-050 Japanese card text at `https://hololive-official-cardgame.com/cardlist/?id=2767`; Comprehensive Rules 1.9.0 clauses 2.1.2, 2.15.1, 2.4.2.2 and 4.4.2.1–4.4.2.2.

**Finding:** the Art deals 100 printed damage, gains +50 against a purple target, and +20 per own stage Oozora Subaru. Current website and packaged Android rules count Center, Collab and Back top cards controlled by the acting player, exclude the opponent's Subaru and apply the purple bonus separately. No source defect reproduced.

**Evidence:** website `tests/effect-audit-hbp09-050-arts.test.mjs` 3/3; current source-engine browser harness PASS; packaged Android offline/PvP tests `tests/hbp09-050-arts-release.test.mjs` 6/6. Full website `website-full-batch22.log`: 2,407 regression + 11 sync, TypeScript and Firebase build pass; Android full 161/161. The official RR page was available; direct SR/UR page ids 2887 and 2863 were inaccessible from this environment, so printing-specific page parity stays unverified. Matrix: 35 PARTIAL abilities, 25 PARTIAL clauses, 5 PARTIAL shared rules.

## Batch 23 — hBP09-057 Towa Arts, Q728/Q729 (2026-09-24)

**Official sources retrieved live:** hBP09-057 Japanese text, Q729 and Q728 at `https://hololive-official-cardgame.com/cardlist/?id=2774`; Comprehensive Rules 1.9.0 clauses 9.1.1–9.1.2, 9.2 and 10.6.1. Q728 says other Holomen's Arts count toward Towa's second-Arts Support search. Q729 says other Holomen's Arts count toward the third-Arts special-damage effect. Clauses 9.1.1–9.1.2 allow each own Center/Collab Holomem's Arts in any order and create a checkpoint after each Arts play.

**Finding:** no production-source defect reproduced. The current program gates Towa's first Arts to the second current-turn Arts, looks at four, reveals/adds a Support and returns the remainder to the bottom in chosen order. Its second Arts gates special damage 50 to any opponent Holomem at the third current-turn Arts. Damage is separately settled from printed Arts damage. The website suite executes two actual Sora Arts and then Towa; packaged Android offline/PvP suites start from a lawful committed-Arts state and check both branches.

**Browser harness note:** direct Towa Art 1 against a synthetic opponent Collab lane failed its source-engine target-presence assertion even though the harness input checkpoint contained that lane. The harness now uses the legal opponent Center for normal Arts damage and a Back Holomem for the special-damage choice. Website source regression and Android packaged tests still run the Art against an opponent Collab and pass. This browser-fixture discrepancy was not reproduced in those other runtimes and remains an investigation item; no production code was changed.

**Evidence:** website focused suite `website/tests/effect-audit-hbp09-057-q728-q729.test.mjs` 5/5; browser `website/tests/browser/effect-audit-hbp09-057-q728-q729.html/.mjs` PASS; Android packaged offline NativeRules + Firebase PvP `android-current/tests/hbp09-057-q728-q729-release.test.mjs` 10/10. Full website `website-full-batch23.log`: 2,412/2,412, 11 sync checks, TypeScript and Firebase production build pass. The first Android all-tests parallel run passed 170/171 because `android-offline-ui.test.mjs` exceeded its 12-second timeout under load; isolated file passed 4/4, then the complete Android suite in serial mode passed 171/171 (`android-full-batch23-serial.log`). Current rules matrix: 1,392 cards, 2,906 printings, 2,468 ability rows, 3,135 clauses; 37 ability rows PARTIAL, 29 clauses PARTIAL, 6 shared rules PARTIAL; 2,431 ability rows and 3,106 clauses UNVERIFIED, every one of 1,392 card identity/basic-action checks UNVERIFIED, `complete:false`.

**Access and release limits:** recheck on 2026-09-24 found no `adb`, empty `ANDROID_HOME`/`ANDROID_SDK_ROOT`, and no `android-current/local.properties`; QuickJS/JNI/WebView/device verification and signed candidate build cannot be claimed. No deployment, publication, merge, signing or release was performed.

**Next resume:** investigate the browser-only opponent-Collab targeting fixture discrepancy; then continue from an UNVERIFIED ability in the official hBP09 list (including untested abilities on hBP09-057 and later card identities), and continue across older sets/starters/promos/Oshi/Support and shared rules. Keep the audit incomplete until the full matrix and runtime/device gates have direct evidence.

## Batch 24 — hBP09-010 Subaru Collab and Arts (2026-09-24)

**Official sources:** Japanese hBP09-010 card page `https://hololive-official-cardgame.com/cardlist/?id=2727`; Comprehensive Rules 1.9.0 `https://hololive-official-cardgame.com/wp-content/themes/tcg/assets/img/rule/whole_rule_ver190.pdf`, clauses 5.7.2, 5.12.1, and 5.17.3.1. The official C printing says its Collab draws two, then returns two hand cards to the deck bottom in a chosen order. Its Arts archives one opposing Support Tool and deals 30. The first three official errata pages were inspected; no hBP09-010 erratum was found. The card page contains Q&A for hBP09-011 and hBP09-012 but none for hBP09-010. The alternate S printing's official endpoint returned an internal error, so its printing-page parity is unverified.

**Finding:** no production rules defect was reproduced. The website's hBP09 program and the separately packaged Android offline/PvP rules resolve the mandatory opponent-owned Tool selection before Arts damage, reject skip/stale choices, preserve the remaining Tool, deal 30 when there is no Tool, and perform Collab's ordinary Holo Power placement before the two draws and ordered bottom-deck choice.

**Evidence:** `website/tests/effect-audit-hbp09-010.test.mjs` passes 3/3 against current `applyAction`; `android-current/tests/hbp09-010-release.test.mjs` passes 7/7 against the current packaged offline `engine.js`, packaged PvP `firebase-rules.js`, and bundled C/S catalog entries. The in-browser source-engine/catalog harness was manually driven through both choices: Arts PASS (selected Tool archived under opponent ownership, other Tool retained, 30 damage applied) and Collab PASS (draw two, choose two in order, place at deck bottom). These runs exercise the source engine and browser choice UI through a deterministic audit harness, not the complete SimulatorClient match flow. In-memory kill mutations disabling the hBP09-010 Art and Collab handlers each made only the corresponding focused test fail, confirming that both regression suites detect a missing effect. Full website `website-full-batch24.log` passed 11/11 sync checks, 2,415/2,415 regression tests, TypeScript, and Firebase production build. Full Android `android-full-batch24-serial.log` passed 178/178 host/package tests.

**Runtime and matrix status:** local Android access was rechecked: no Android SDK, `adb`, `local.properties`, or release keystore is available; app metadata currently resolves to `com.holocard.pocketlab.preview06`, version 1.2.5 / versionCode 24. We did not create a stale-preview build or claim QuickJS/JNI/physical-device verification. The packaged JavaScript and catalog are tested, but device execution and the alternate S printing remain outstanding, so the two hBP09-010 ability rows and clauses are PARTIAL, not VERIFIED. The regenerated matrix remains `complete:false`; 39 ability rows PARTIAL / 2,429 UNVERIFIED, 31 clauses PARTIAL / 3,104 UNVERIFIED, six shared-rule rows PARTIAL, and all 1,392 card identity/basic-action checks UNVERIFIED.

**Next:** continue from hBP09-012's unverified Bloom Effect and Arts, then return to unresolved abilities on previously sampled cards. Investigate B23's browser-only opponent-Collab harness discrepancy separately; do not inflate other abilities' status. No deployment, publication, merge, signing, or release was performed.

## Batch 25 — shared previous-turn Down eligibility and damage (2026-09-24)

**Official sources:** hBP09-012 Japanese card entry `https://hololive-official-cardgame.com/cardlist/?id=2729`; hBP09-014 and Q717 `https://hololive-official-cardgame.com/cardlist/?id=2731`; hBP09-091/Q734 `https://hololive-official-cardgame.com/cardlist/?id=2808`; hBP09-094/Q738/Q739 `https://hololive-official-cardgame.com/cardlist/?id=2811`; Comprehensive Rules 1.9.0 `https://hololive-official-cardgame.com/wp-content/themes/tcg/assets/img/rule/whole_rule_ver190.pdf`, clauses 7.1.1, 9.1.1–9.1.2 and applicable checkpoints.

**Reproduced defect:** the shared `previousDowns` fact counted an own Holomem Down in the prior turn only when `sourcePlayerIndex` was the opponent. The Japanese card clauses identify the Down Holomem and turn, not who caused it. A turn-7 entry with `ownerIndex=0, sourcePlayerIndex=0` yielded 80 instead of hBP09-012's expected 130; the same source filter blocked hBP09-091/hBP09-094 legal Support gates and omitted hBP09-014 damage.

**Repair:** website and Android HBP09 runtimes now count the actor-owned Down events on the immediately preceding turn without filtering on source. The Android offline NativeRules engine and Firebase PvP reducer were rebuilt from the current Android source. No separate feature or UI code was replaced.

**Evidence:** before-fix repros are in `evidence/effect-audit/20260924-batch-25/website-hbp09-012-before-fix.log` and `android-hbp09-012-before-fix.log`; actual browser source engine/catalog Bloom+Arts result is `browser-hbp09-012.log`. Final website focused tests cover hBP09-012 Bloom and previous-turn Arts (+50 with source-independence and negative controls), hBP09-014 Q717 and +40 each for one/two own Downs, hBP09-091 eligibility, and hBP09-094 eligibility/reset; see Batch 26 focused log. Android package tests cover offline and PvP equivalents.

## Batch 26 — hBP09-091 Q734 and hidden-zone fail-to-find (2026-09-24)

**Rule correction:** an initial test asserted that hBP09-091's deck search must choose a match when one is present. The official Comprehensive Rules 1.9.0 clause 10.7.2.3.5 expressly allows a player to fail to find a card in a hidden zone even when a matching card is present. I removed the tentative mandatory-search source change and the mutation that treated this legal behavior as a failure. Superseded initial-expectation logs were renamed; the prior invalid mutation/log was removed. No search-minimum runtime change remains.

**Conformance work:** hBP09-091 keeps its valid Q734 behavior: with AZKi Oshi and a qualifying own preceding-turn Down, selected 1st AZKi/Iroha can be directly staged even if neither name was already on the Stage. Tests now exercise both finding both and declining AZKi while still searching/staging Iroha, then verify deck shuffle and Support archival. Browser evidence is `evidence/effect-audit/20260924-batch-26/browser-hbp09-091-q734.log`.

**Focused evidence:** website 15/15 in `website-focused-rule-corrected.log`; Android packaged offline/PvP 27/27 in `android-focused-rule-corrected.log`. Complete current website run `website-full-batch26.log`: 11/11 sync checks, 2,426/2,426 regression checks, TypeScript and Firebase production build passed. Complete serialized Android host/package suite `android-full-batch26-serial.log`: 194/194 passed, including offline AI full-match save/relaunch and current packaged Offline/PvP NativeRules. The browser harness loads the current website engine and catalog, and both positive and fail-to-find hBP09-091 paths visibly PASS.

**Matrix:** 1,392 card records, 2,906 printings, 2,468 ability rows, 3,135 clauses; 43 ability rows PARTIAL / 2,425 UNVERIFIED; 42 clauses PARTIAL / 3,093 UNVERIFIED; eight shared rules PARTIAL; all 1,392 identity/basic-action card checks UNVERIFIED; `complete:false`. hBP09-091's LIMITED clause and hBP09-094's LIMITED clause remain UNVERIFIED; shared Limited tests do not substitute for per-card proof.

**Runtime/release limit:** rechecked this turn: no `adb`, `ANDROID_HOME`, `ANDROID_SDK_ROOT`, Android `local.properties`, or release keystore was found under `android-current`. The real packaged JavaScript is host-tested, but QuickJS/JNI/WebView/device operation and a signed APK candidate cannot be claimed. We did not deploy, publish, merge, sign, or release. Batch provenance and local source/package hashes are in `evidence/effect-audit/20260924-batch-26/provenance-batch26.json`.

**Next audit row:** begin hBP09-013 Collab keyword and Arts against the official Japanese card page `https://hololive-official-cardgame.com/cardlist/?id=2730`; then continue every still-UNVERIFIED clause across hBP09 and older sets. Keep the overall task incomplete until the full official-source, regression, browser, production-Android and per-clause completion gates are met.

## Batch 27 — hBP09-013 Subaru Collab and Arts (2026-09-24)

**Official source:** current Japanese hBP09-013 card entry `https://hololive-official-cardgame.com/cardlist/?id=2730`, retrieved 2026-09-24. The Collab effect reveals one Support named 〈大空警察〉 or 〈スピード違反〉, adds it to hand, then shuffles. Its Arts has 100 printed damage and the red-target +50 icon. Comprehensive Rules 1.9.0 §10.7.2.3.5 permits failing to find a card in a hidden deck even when a matching card is available. The page shows no hBP09-013-specific Q&A. The alternate S-printing endpoint could not be retrieved; no all-printing parity claim is made.

**Finding:** no source-engine or packaged NativeRules defect reproduced. The production Collab search offers exactly the named Supports, preserves the ordinary Collab Holo Power placement, allows fail-to-find, adds the selected instance, and shuffles. The Arts applies +50 against red, but not blue.

**Evidence:** website `tests/effect-audit-hbp09-013.test.mjs` passes 4/4; interactive local browser harness `tests/browser/effect-audit-hbp09-013.html/.mjs` passes selected Support, fail-to-find, red 150 and blue 100. Packaged Android `tests/hbp09-013-release.test.mjs` passes 6/6 across Offline NativeRules and PvP reducer. Full website `website-full-batch27.log` passed 11/11 sync tests, 2,430/2,430 regression tests, TypeScript and Firebase production build. Full serialized Android host/package suite `android-full-batch27-serial.log` passed 200/200.

**Coverage status:** hBP09-013 Collab and Arts are PARTIAL, not VERIFIED. The C printing's official text and source/bundle behavior are covered; S-printing official-page parity, complete SimulatorClient flow, and Android QuickJS/JNI/WebView/device remain open. Current matrix: 1,392 cards, 2,906 printings, 2,468 ability rows and 3,135 clauses; 45 ability rows PARTIAL / 2,423 UNVERIFIED, 43 clauses PARTIAL / 3,092 UNVERIFIED, eight shared-rule rows PARTIAL, all 1,392 identity/basic-action checks UNVERIFIED; `complete:false`.

**Runtime/release limit:** Android source packages and JavaScript reducer tests are verified in host adapters, but this environment still has no Android SDK/adb, attached device/emulator, Android `local.properties` or release keystore; physical device execution and signed candidate build remain blocked. No deploy, publication, merge, signing or release was performed. Browser interaction detail is in `evidence/effect-audit/20260924-batch-27/browser-hbp09-013.log`; local file/source/package hashes are in `provenance-batch27.json`.

**Next:** continue to hBP09-015 and subsequent unverified clauses using official Japanese text and applicable rulings. Keep the overall audit incomplete until every applicable ability/clause/shared rule and production runtime gate has direct evidence.

## Batch 28 — hBP09-015 Hajime Gift and Arts (2026-09-24)

**Official sources retrieved live:** hBP09-015 C printing `https://hololive-official-cardgame.com/cardlist/?id=2732`; S printing `https://hololive-official-cardgame.com/cardlist/?id=2911`; Comprehensive Rules 1.9.0 `https://hololive-official-cardgame.com/wp-content/themes/tcg/assets/img/rule/whole_rule_ver190.pdf`, clauses 5.18, 8.7.2–8.7.3, 9.1.1–9.1.2 and 10.3.4.1; current official errata index `https://hololive-official-cardgame.com/rules/errata/`. C and S pages match on the Gift and Arts text, stats and color. Neither card page displays hBP09-015-specific Q&A; the current errata index lists hBP09-093 and hBP04-039 from the current product, not hBP09-015. This is a current-page/index check, not exhaustive historic Q&A archival reconciliation.

**Finding:** no production rule defect reproduced. Gift reduces only hBP09-015's own current Center Baton cost by one Colorless when its owner controls at least three Stage Holomem; the Collab lane counts, opposing Holomem do not, and the ability is inactive below a Bloom top card. Arts gains 20 only after any own Holomem has Batoned earlier this turn; no prior-turn carry applies. Website tests cover the 3/2 threshold, Collab count, opponent exclusion, current Center/source scope, top-card validity, positive current-turn Arts and no/prior-turn negatives.

**Evidence:** website `tests/effect-audit-hbp09-015.test.mjs` passes 7/7; current source-engine/browser-card-catalog harness `tests/browser/effect-audit-hbp09-015.html/.mjs` passes all five manually operated controls. Android `tests/hbp09-015-release.test.mjs` passes 13/13 against the actual packaged `app/src/main/assets/native/engine.js` offline NativeRules and `firebase-rules.js` PvP reducer through Node VM adapters. Full website `npm test` passes 11/11 sync checks, 2,437/2,437 regression checks, `tsc --noEmit` and Firebase production build (`evidence/effect-audit/20260924-batch-28/website-full-batch28.log`). Full serialized Android host/package suite passes 213/213 (`android-full-batch28-serial.log`). Browser results are in `browser-hbp09-015.log`; test logs are in the same B28 evidence directory.

**Matrix:** regenerated `CARD_EFFECT_MATRIX_CURRENT.json` records both hBP09-015 abilities and clauses as PARTIAL, with live C/S text sources and runtime/test evidence. Inventory: 1,392 cards, 2,906 printings, 2,468 ability rows, 3,135 clauses; 47 ability rows PARTIAL / 2,421 UNVERIFIED; 45 clauses PARTIAL / 3,090 UNVERIFIED; eight shared rules PARTIAL; every card identity/basic-action/printing-equivalence check remains UNVERIFIED; `complete:false`.

**Runtime limits:** Browser harness uses the current website engine and catalog, not the complete SimulatorClient match interface. Android tests execute the actual packaged JavaScript bundles in Node VM adapters; QuickJS/JNI/WebView and physical device/emulator remain unavailable. No website deployment, publication, merge, signing, APK candidate or release was performed. Source hashes and exact baseline are in `evidence/effect-audit/20260924-batch-28/provenance-batch28.json`.

**Next:** continue the official Japanese text, Q&A, errata and independent clause audit with hBP09-016. Do not substitute hBP09-016's Collab effect test for its Arts or card identity/basic-action checks; keep the global audit incomplete.

## Batch 29 — hBP09-016 Collab search and vanilla Arts (2026-09-24)

**Official source and rule:** hBP09-016 U printing `https://hololive-official-cardgame.com/cardlist/?id=2733`; Comprehensive Rules 1.9.0 `https://hololive-official-cardgame.com/wp-content/themes/tcg/assets/img/rule/whole_rule_ver190.pdf`, §§8.4.3, 10.7.2.3.3 and 10.7.2.3.5; current official errata index `https://hololive-official-cardgame.com/rules/errata/`. Japanese text limits the Collab search to the second player's first turn and up to two own-deck 轟はじめ Holomem with Baton cost one; selected cards are revealed and added to hand, then the deck is shuffled. The ordinary Arts costs one Colorless and deals 30. The card page shows no hBP09-016-specific Q&A; the current errata index does not list this card, without claiming exhaustive historic archive coverage.

**Finding and tests:** no production rules defect was reproduced. Website tests pass 6/6 and the local current source-engine browser harness passed all five search/timing/fail-to-find/Arts controls. Android tests against the current packaged offline NativeRules engine and Firebase PvP reducer pass 10/10, including an offline save/reload with a pending search. Full website `npm test` passed 11/11 sync checks, 2,443/2,443 regression assertions, TypeScript no-emit, and Firebase production build. Full serialized Android host/package suite passed 223/223. Logs are in `evidence/effect-audit/20260924-batch-29/`.

**Coverage and blockers:** the regenerated matrix records both hBP09-016 abilities and the Collab clause as PARTIAL. At this checkpoint: 1,392 cards, 2,906 printings, 2,468 ability rows, 3,135 clauses; 49 ability rows PARTIAL / 2,419 UNVERIFIED; 46 clauses PARTIAL / 3,089 UNVERIFIED; eight shared rules PARTIAL; all 1,392 identity/basic-action checks UNVERIFIED; `complete:false`. Website coverage uses a local source-engine harness, not the complete production SimulatorClient. Android verification loads the real packaged JavaScript through Node VM adapters, not QuickJS/JNI/WebView or a device. Recheck found no `adb`, Android SDK/default SDK path, system Gradle, `local.properties`, device/emulator, or release signing material. No source rule change, deploy, publication, merge, signed build, or release was made. Batch provenance and hashes: `evidence/effect-audit/20260924-batch-29/provenance-batch29.json`.

**Next:** hBP09-017 Gift/Arts, official C/S page ids 2734 and 2912; then continue each unresolved hBP09 clause and all older sets/starters/promos/Oshi/Support. Do not infer card identity or actual-device verification from these rule-engine tests.

## Batch 30 — hBP09-017 Arts-damage Gift and vanilla Arts (2026-09-24)

**Official sources:** Japanese C page `https://hololive-official-cardgame.com/cardlist/?id=2734` and S page `https://hololive-official-cardgame.com/cardlist/?id=2912` agree on card identity and effects: the Gift reduces Arts damage to this Holomem by 30; its one-Colorless Arts deals 30 with no additional effect text. Comprehensive Rules 1.9.0 `https://hololive-official-cardgame.com/wp-content/themes/tcg/assets/img/rule/whole_rule_ver190.pdf`, §§5.22.1–5.22.4, 9.1.1–9.1.2, 10.3.4.1 and 13.4, define damage reduction, Arts resolution, active top-card scope and Gift keyword. Neither official card page shows hBP09-017 Q&A. The current official errata index was checked and does not list hBP09-017; this is not an exhaustive historical-Q&A reconciliation.

**Finding and coverage:** no production defect was reproduced. Website tests pass 4/4; packaged Android offline NativeRules and Firebase PvP tests pass 5/5; the local browser harness passed all three manual controls. The cases establish a 30-point reduction in Center/Collab/Back, a zero floor, no reduction to Special damage, and no Gift while hBP09-017 is underneath a different Bloom top. C/S Japanese text and catalog variants match. No production rule source changed.

**Full regression:** website `npm test` passed 11/11 sync checks, 2,447/2,447 regression assertions, TypeScript no-emit and Firebase production build (`evidence/effect-audit/20260924-batch-30/website-full-batch30.log`). Complete serialized Android host/package suite passed 228/228 (`android-full-batch30-serial.log`). Browser results and focused logs are in the same B30 evidence folder.

**Matrix and runtime limits:** current inventory: 1,392 cards, 2,906 printings, 2,468 ability rows, 3,135 clauses; 51 ability rows PARTIAL / 2,417 UNVERIFIED; 47 clauses PARTIAL / 3,088 UNVERIFIED; eight shared rules PARTIAL; all 1,392 identity/basic-action checks UNVERIFIED; `complete:false`. Browser harness is not the complete website SimulatorClient. Android tests use actual packaged JavaScript bundles under Node VM adapters, not device execution. Rechecked current access: the real Gradle Android project and wrapper are present, but `adb`, Android SDK/default path, system Gradle, local.properties, connected device/emulator and signing material are unavailable; therefore actual APK runtime, signed candidate APK and signature-continuity gates remain blocked. No deploy, publication, merge, signing or release occurred. Provenance and source/test hashes: `evidence/effect-audit/20260924-batch-30/provenance-batch30.json`.

**Next:** continue hBP09-018's Bloom Effect and Arts independently, then return to every unresolved hBP09 and prior-set ability/clause, promo, Oshi, Support, shared rule and per-card identity/basic-action row. The overall audit remains incomplete.

## Batch 31 — hBP09-018 Center Bloom and Arts (2026-09-24)

**Official sources:** Japanese hBP09-018 C page `https://hololive-official-cardgame.com/cardlist/?id=2735` and S page `https://hololive-official-cardgame.com/cardlist/?id=2913` agree on 1st 轟はじめ, Center-only Bloom draw two, 30+ Arts and Collab-only +20. Comprehensive Rules 1.9.0 `https://hololive-official-cardgame.com/wp-content/themes/tcg/assets/img/rule/whole_rule_ver190.pdf`, §§5.7.1–5.7.2, 7.3.2.1, 8.3.1–8.3.4, 9.1.1–9.2.2, 10.3.3, 10.3.4.1, 10.5.1–10.5.2, 12.3.3.1–12.3.4.5 and 13.3.2. Official hBP09-002 deck recipe confirms the Center Bloom draw-two and Collab 50 damage. Current errata index and the card pages were checked; neither page showed a card-specific Q&A. This does not claim a complete historic Q&A-archive reconciliation.

**Finding:** no production source-rule defect reproduced. Back Bloom does not draw; Center Bloom draws the top two once and preserves order through save/reload; 1/0-card effect draws handle their boundary without the hand-step deck-out rule. Center/Collab Arts resolve at 30/50, preserve the paid Colorless Cheer, and Back is not an Arts source. No production engine change was needed; this batch adds evidence-backed tests and browser harnesses only.

**Evidence:** website focused `tests/effect-audit-hbp09-018.test.mjs` 6/6; current local source-engine browser harness 7/7 (`evidence/effect-audit/20260924-batch-31/browser-hbp09-018.log`); Android actual packaged offline NativeRules plus Firebase PvP reducer tests 8/8 (`tests/hbp09-018-release.test.mjs`), including pending-choice save/reload and canonical state parity. Full website `website-full-batch31-final.log` passed 11/11 sync checks, 2,453/2,453 regression checks, TypeScript no-emit and Firebase production build. Full serialized Android host/package suite `android-full-batch31-serial.log` passed 236/236 across 45 files.

**Matrix:** 1,392 cards, 2,906 printings, 2,468 ability rows, 3,135 clauses; 53 ability rows PARTIAL / 2,415 UNVERIFIED, 49 clauses PARTIAL / 3,086 UNVERIFIED; eight shared-rule rows PARTIAL; every 1,392 card identity/basic-action check remains UNVERIFIED; `complete:false`.

**Runtime boundary:** the browser harness exercises the current website source engine and packaged catalogue, not the whole production SimulatorClient. Android JavaScript bundles are executed in Node VM adapters, not QuickJS/JNI/WebView or a device. Recheck found no Android SDK, `adb`, system Gradle, `local.properties`, device/emulator or project keystore; no candidate APK was built or signed. No deployment, publication, merge or release occurred.

**Next:** hBP09-019 Back-only Bloom Baton-cost reduction and Center-only Baton Arts bonus; then continue every remaining hBP09 and prior-set clause, all starters/promos/Oshi/Support/shared rules, and the per-card identity/basic-action and printing-equivalence gates.

## Batch 32 — hBP09-019 Back Bloom Baton reduction and Center Arts (2026-09-24)

**Official sources:** Japanese hBP09-019 card detail page id 2736 and the official hBP09-002 Hajime deck recipe `https://hololive-official-cardgame.com/deck/hbp09-002/`; Comprehensive Rules 1.9.0 `https://hololive-official-cardgame.com/wp-content/themes/tcg/assets/img/rule/whole_rule_ver190.pdf`, §§2.10.1, 7.1.1, 7.7.4, 8.3.4, 8.7.1–8.7.4, 9.1.1–9.2.2, 10.3.3–10.3.4.1, 10.10.1.1–10.10.1.5, 12.3.4.1–12.3.4.5 and 13.3.2. Current Q&A exact-number and errata-index checks found no card-specific hBP09-019 ruling/erratum; historic archive completeness is not asserted.

**Finding:** no production-source defect was reproduced. The Back Bloom Effect offers only the controller’s Stage Holomen, including itself, reduces the selected target’s Colorless Baton requirement by two for the current turn with a zero floor, and allows a one-Cheer Center Baton while preserving Cheer. The modifier expires at the end of the turn. The Center-only Arts rises from 40 to 60 after any own Baton in the current turn; Collab remains 40 and Back cannot attack. Catalog variants are R/SR with matching recorded Japanese text.

**Evidence:** combined website focused tests for hBP09-018/019 pass 12/12; `website/tests/browser/effect-audit-hbp09-019.html/.mjs` was manually driven in the current browser and passed 7/7; `android-current/tests/hbp09-019-release.test.mjs` passes 7/7 against the packaged offline NativeRules and Firebase PvP bundles. Website `npm test` passes 11/11 sync checks, 2,459/2,459 regression tests, TypeScript no-emit and Firebase production build (`evidence/effect-audit/20260924-batch-32/website-full-batch32.log`). Full serialized Android host/package suite passes 243/243 across 46 files (`android-full-batch32-serial.log`).

**Matrix and limits:** after B32, the matrix records 1,392 card records, 2,906 printings, 2,468 ability rows, and 3,135 clauses; 55 ability rows PARTIAL / 2,413 UNVERIFIED, 52 clauses PARTIAL / 3,083 UNVERIFIED, eight shared rules PARTIAL, all 1,392 card identity/basic-action checks UNVERIFIED, `complete:false`. Browser tests use the current website engine/catalog and do not cover the whole SimulatorClient. Android tests load the real packaged JavaScript bundles in Node VM adapters, not QuickJS/JNI/WebView or device. Current access check found no SDK, `adb`, `local.properties`, attached device/emulator or project signing keys, so no signed APK candidate was built. No deployment, publication, merge, signing or release occurred.

## Batch 33 — hBP09-020 Reset Gift, special Arts damage, and Center cost reduction (2026-09-24)

**Official sources:** Japanese hBP09-020 U page id 2737 `https://hololive-official-cardgame.com/cardlist/?id=2737` and S page id 2914 `https://hololive-official-cardgame.com/cardlist/?id=2914` agree on the 2nd white 轟はじめ (190 HP), Gift 奇想天外な盤面, and Arts 悟ればいいんだ！. Comprehensive Rules 1.9.0 `https://hololive-official-cardgame.com/wp-content/themes/tcg/assets/img/rule/whole_rule_ver190.pdf`, §§2.4, 4.1.4, 7.2.2–7.2.3, 7.7.4, 9.1.1–9.2.2, 10.3.3–10.3.4.1, 10.10.1.1–10.10.1.5, 12.3.3.1–12.3.3.1.1, 12.3.4.1–12.3.4.5 and 13.4. The hBP01 official card-list result was used to confirm hBP01-017’s White+Colorless Arts as a cost-reduction control. Neither hBP09-020 detail page displayed a card-specific Q&A; current official Q&A and errata pages were checked, without claiming exhaustive historical archive coverage.

**Finding:** no production-source defect was reproduced. The Reset Step Gift keeps hBP09-020 active when it returns from Collab to Back; ordinary hBP09-018 rests. Its Arts is 60 base, with +50 only against Purple. When used from Collab, the effect reduces only the owner’s Center Arts White requirement by one for the current turn; a White+Colorless Arts still requires Colorless, Center-source Arts cannot grant the Collab-only effect, and the modifier is gone after the actual turn boundary. Tests confirm Cheer remains attached under the normal Arts-payment rule.

**Evidence:** `website/tests/effect-audit-hbp09-020.test.mjs` passes 5/5; browser harness `website/tests/browser/effect-audit-hbp09-020.html/.mjs` was manually run and passes 5/5; `android-current/tests/hbp09-020-release.test.mjs` passes 4/4 against the actual packaged offline NativeRules and Firebase PvP reducer. PvP tests perform real turn transitions and Reset Step; offline expiry uses a later valid saved-state fixture because the offline runtime correctly rejects host commands acting as the AI player. Full website `npm test` passes 11/11 sync, 2,464/2,464 regression tests, TypeScript no-emit and Firebase production build (`evidence/effect-audit/20260924-batch-33/website-full-batch33.log`). Full serialized Android host/package tests pass 247/247 across 47 files (`android-full-batch33-serial.log`).

**Matrix:** 1,392 cards, 2,906 printings, 2,468 abilities and 3,135 clauses; 57 ability rows PARTIAL / 2,411 UNVERIFIED; 54 clauses PARTIAL / 3,081 UNVERIFIED; eight shared-rule rows PARTIAL; all 1,392 identity/basic-action checks UNVERIFIED; `complete:false`. B33 provenance and current source/test hashes are in `evidence/effect-audit/20260924-batch-33/provenance-batch33.json`.

**Runtime boundary:** website verification uses current source `applyAction` and a dedicated browser harness, not the full SimulatorClient. Android tests exercise the actual packaged JavaScript bundles in Node VM adapters; QuickJS/JNI/WebView and physical-device execution remain unavailable. Rechecked this batch: Gradle wrapper exists, but no SDK, `adb`, system Gradle, `local.properties`, attached device/emulator or project keystore is available. No APK build/signing, deploy, publication, merge or release was attempted.

**Next:** continue with every hBP09-021 clause against its official Japanese card page, then all remaining hBP09, prior sets, starters, promos, Oshi and Support effects, shared rules, product/printing reconciliation and per-card identity/basic-action gates. Keep the global audit incomplete until all evidence and runtime gates are closed.

## Batch 34 — hBP09-021 same-turn Baton Arts and on-Down Gift (2026-09-24)

**Official sources:** Japanese hBP09-021 RR page id 2738, SR id 2873, and UR id 2859 were inspected and agree on identity, statistics, Gift and Arts text. The official hBP09-002 deck recipe confirms 160 damage after a Baton and Holo Power gain on an opponent Down. Comprehensive Rules 1.9.0 `https://hololive-official-cardgame.com/wp-content/themes/tcg/assets/img/rule/whole_rule_ver190.pdf`, §§4.1.3–4.1.3.2, 7.1.1, 8.7.1–8.7.4, 9.1.1–9.2.1, 10.3.4.1, 11.3.1.1–11.3.2, 11.5.1, 12.3.3.1–12.3.3.1.1, 12.3.4.1–12.3.4.5 and 13.4. Official FAQ Q207 confirms a matching “when this Holomem downs an opponent” condition can trigger when Special damage causes the Down; Q160 describes sequential processing for multiple Downs. No hBP09-021-specific Q&A was located, and the current official errata index did not list it; this is not exhaustive historical archive proof.

**Finding:** no production-source rule defect was reproduced. hBP09-021 deals 80 base, gains +80 after any own Holomem Batons this same turn (not a prior turn), and its Red +50 icon applies only to Red targets. Its Gift moves exactly one main-deck top card to its owner's Holo Power when this active top Holomem downs an opponent. It does not trigger for no Down, a different source, a covered copy or an empty deck. No existing production rules file needed a change.

**Evidence:** website `tests/effect-audit-hbp09-021.test.mjs` passes 5/5; the interactive browser harness `tests/browser/effect-audit-hbp09-021.html/.mjs` passes 6/6, including a real Collab→Baton→Arts path; Android `tests/hbp09-021-release.test.mjs` passes 11/11 against the packaged offline NativeRules and Firebase PvP rules, including offline AI choice resolution, exact top-card transfer, and source/empty-deck controls. Website `npm test` passes 11/11 sync checks, 2,469/2,469 regression assertions, TypeScript no-emit and Firebase production build (`evidence/effect-audit/20260924-batch-34/website-full-batch34.log`). Serialized Android host/package tests pass 258/258 across 48 test files (`android-full-batch34-serial.log`).

**Matrix:** 1,392 cards, 2,906 printings, 2,468 abilities, 3,135 clauses; 59 ability rows PARTIAL / 2,409 UNVERIFIED; 56 clauses PARTIAL / 3,079 UNVERIFIED; eight shared rules PARTIAL; all 1,392 identity/basic-action card checks UNVERIFIED; `complete:false`. Both hBP09-021 ability rows and their clauses remain PARTIAL because complete SimulatorClient, actual-device and product-image/basic-action gates are open. Focused/browser/full-suite/access evidence and hashes are stored in `evidence/effect-audit/20260924-batch-34/`.

**Runtime boundary:** website checks use the current source `applyAction` and browser harness, not full production SimulatorClient match UI. Android uses the actual packaged JavaScript rule bundles in Node VM adapters, not QuickJS/JNI/WebView or a physical device. Rechecked: no Android SDK/default path, `adb`, system Gradle, `local.properties`, attached device/emulator or project signing material is available. The signed APK candidate remains blocked. No deployment, publication, merge, signing or release occurred.

**Next:** begin hBP09-022's unconditional opponent Stage target and conditional “also 2nd” transformation against official Q705/Q706, then continue all remaining card abilities, shared rules, product/printing identity and per-card checks. Keep the complete audit gate open.

## Batch 35 — hBP09-022 Watame Bloom target and Arts (2026-09-24)

**Official sources:** Japanese hBP09-022 R page id 2739 and SR page id 2874 were opened and matched on 2026-09-24. Both show Bloom `わためいとの楽園`, the one-opponent-Stage target followed by a 10-Holo-Power condition for temporary 2nd status, plus the Arts `花がきれいだねぇ`: two White Cheer, 100 damage, Purple-target +50, and a separate +50 condition at four Holo Power. Official Q705/Q706 explain that a treated-as-2nd target remains its original 1st and can satisfy either a 1st or 2nd Subaru Oshi search. The official errata index was checked and did not list hBP09-022; this is not a historic-archive completeness claim. Comprehensive Rules 1.9.0 §§7.7.4, 9.1.1–9.2.2, 10.5.1–10.5.2, 10.7.2.3.1, 10.7.2.3.4 and 12.3.3.1–12.3.4.5 support mandatory target selection, no-legal-target behavior, expiry, costs and damage modifiers.

**Reproduced defect and repair:** before the change, at 9 Holo Power Bloom produced no required `stageTarget` choice because the rule program incorrectly nested target selection under the 10-power predicate. The same defect reproduced independently in the actual packaged Android offline NativeRules and PvP NativeRules. Moved only the target selection outside the threshold branch; the selected target receives temporary 2nd status only when the condition passes. Applied the matching source change in the website and Android mirror and regenerated packaged offline/PvP bundles. Existing identity, AI/account/save/scanner/export code was untouched.

**Evidence:** website focused regression passes 4/4, and the manually driven current-source browser harness passes 6/6, including target save/reload, Q705/Q706, the four Arts damage values and R/SR Japanese catalogue identity. Android focused regressions pass 5/5 against the actual packaged Offline and Firebase PvP rules in Node VM adapters. The pre-fix focused runs failed at the same missing target in website source and both packaged Android paths. Full website tests pass 2,473/2,473 regression assertions plus 11/11 sync checks, TypeScript no-emit and Firebase production build (`evidence/effect-audit/20260924-batch-35/website-full-batch35.log`). Full serialized Android host/package suite passes 263/263 assertions across 49 files (`android-full-batch35-serial.log`). Focused logs, before-fix logs, browser result and runtime-access evidence are in the B35 evidence directory.

**Matrix:** 1,392 local card records, 2,906 printings, 2,468 ability rows, 3,135 clauses; 61 abilities PARTIAL / 2,407 UNVERIFIED; 59 clauses PARTIAL / 3,076 UNVERIFIED; eight shared-rule rows PARTIAL; all 1,392 identity/basic-action card checks UNVERIFIED; `complete:false`. hBP09-022 Bloom and Arts are PARTIAL because complete website SimulatorClient behavior, QuickJS/JNI/WebView/device operation, printing artwork and exhaustive card/product identity gates remain unverified.

**Runtime and release limits:** website browser verification used the current local source engine, not the entire production battle UI. Android tests executed the actual packaged offline and PvP bundles under Node VM adapters, not QuickJS/JNI/WebView or a physical device. Current access recheck remains blocked by missing Android SDK/default SDK path, `adb`, project `local.properties`, connected device/emulator and project signing keystore. No APK candidate was signed and no website deployment, publication, merge or release was performed. Local input/output hashes and environment status are recorded in `evidence/effect-audit/20260924-batch-35/provenance-batch35.json`.

**Next:** audit hBP09-023's clauses against official Japanese sources and Q718, with independent threshold/target/turn-boundary cases; then continue every remaining hBP09 and older set, starter, promo, Oshi, Support, Cheer, shared-rule, identity and printing gate. The global audit is still open.

## Batch 36 — hBP09-023 classification and clause-matrix parser repair (2026-09-25)

**Official source:** Japanese hBP09-023 R page id 2740 and SR page id 2875, plus official Q718, were checked against Comprehensive Rules 1.9.0. No gameplay-rule defect was reproduced for the audited hBP09-023 abilities.

**Audit-tool defect and repair:** the clause parser split effect text at every exclamation mark, including punctuation inside the Japanese/romanized skill name `Good Luck, holoh3ro!`; that could create misleading clause rows. Added a shared audit-clause parser and regression coverage so punctuation in names no longer splits printed abilities.

**Evidence:** matrix clause tests pass 11/11; the B36 browser and Android focused tests pass 8/8 and 18/18 respectively. Full website regressions pass 2,483 assertions, sync passes 11/11, TypeScript and production build pass. Full Android packaged host suite passes 280 assertions across 50 files. These Android tests use the actual packaged JavaScript rules through host adapters, not QuickJS/JNI/device execution. Detailed B36 logs are in `website/evidence/effect-audit/20260925-batch-36/`.

## Batch 37 — hBP09-024 Riona's Extra (2026-09-25)

**Official source:** Japanese hBP09-024 R page id 2741 and SR page id 2876. The Extra says the owner loses two Life when this active-top Holomem is Downed; Comprehensive Rules 1.9.0 §2.11.2.2 and §§11.3.1.1–11.3.1.2 govern replacement of ordinary Down Life damage. Current card-number Q&A search returned zero and the current errata index has no entry; these are current-page checks, not exhaustive historic archive claims.

**Finding:** an actual attack that Downs active-top Riona reduces five Life to three in website source, packaged Android offline NativeRules, and Firebase PvP rules. No rules-engine defect was reproduced. Website, browser and Android focused coverage passed 5/5, 8/8 and 8/8. Full website passed 2,488 regression assertions, 11/11 sync checks, TypeScript and Firebase build; Android host/package tests passed 288 assertions across 51 files. Full SimulatorClient and Android QuickJS/JNI/device paths remain unverified. Evidence is in `website/evidence/effect-audit/20260925-batch-37/`.

## Batch 38 — hBP09-025 Noel Stage-Skill HP Gift (2026-09-25)

**Official sources:** Japanese C id 2742 and S id 2915 match. hBP09-003 Noel Oshi provides a positive Oshi Stage Skill control; hBP09-006 Vivi Oshi has no Oshi Stage Skill; hBP09-028 provides a 150-HP top-card control. FAQ Q166 and Comprehensive Rules 1.9.0 §§2.9.1, 4.4.2.1, 10.7.1 and 13.4.1 apply. Current card-number Q&A returned zero and the current errata index has no entry; this is not an exhaustive archive claim.

**Finding:** the continuous Gift correctly adds 20 effective HP only while this Noel is the active top card and its owner's Oshi has an Oshi Stage Skill. At 130 damage it survives with the Stage-Skill Oshi and is Downed with an Oshi lacking that skill. No rules defect was reproduced. Website/browser focused tests pass 4/4 each; Android packaged offline/PvP tests pass 6/6. Full website passes 2,492 regression assertions, 11/11 sync, TypeScript and Firebase build; Android host/package tests pass 294 assertions across 52 files. Full SimulatorClient, Android QuickJS/JNI/device, and complete printing-artwork reconciliation remain open. Evidence is in `website/evidence/effect-audit/20260925-batch-38/`.

## Batch 39 — hBP09-026 Noel search ordering and single shuffle (2026-09-25)

**Official sources:** [Japanese hBP09-026 U card page](https://hololive-official-cardgame.com/cardlist/?id=2743&expansion=hBP09&view=text); [official Noel deck recipe](https://hololive-official-cardgame.com/deck/hbp09-003/) confirms hBP09-100 ノエルの特盛牛丼 is treated as 牛丼; Comprehensive Rules 1.9.0 §§1.3.2, 5.6.1, 5.6.1.1 and 10.7.2.3.5; official FAQ Q751. The current card-number Q&A search returned zero results and current errata index has no hBP09-026 entry; this is not exhaustive archive verification.

**Reproduced defect and repair:** before the change, website source and both Android packaged rules independently shuffled after the first search group, before the Gyudon search, and shuffled twice when both groups found no card. The keyword has two independent optional searches but one final printed shuffle. Reworked both source programs so each group can fail independently and a single final shuffle follows both searches; regenerated packaged Android offline and Firebase PvP rules.

**Evidence:** pre-fix failure logs, focused tests, browser evidence and source record are in `website/evidence/effect-audit/20260925-batch-39/`. Website focused tests pass 5/5. The manually operated current-source Chromium harness passes 4/4: both matches in search order with one final shuffle, a missing Noel group with Gyudon resolved, Q751 with neither match and one shuffle, and first-player/later-turn restrictions with ordinary Collab and Arts intact. Android tests against the actual packaged offline and PvP rule bundles pass 9/9 including catalog target identity. Full website `npm test` passes 11/11 sync checks, 2,497/2,497 regression assertions, TypeScript no-emit and Firebase production build (`website-full.log`). The full Android packaged host suite passes 303/303 assertions across 53 files (`android-full-serial.log`).

**Current matrix:** 1,392 local card records, 2,906 printing variants, 2,468 ability rows and 3,130 clauses; 68 ability rows PARTIAL / 2,400 UNVERIFIED; 67 clauses PARTIAL / 3,063 UNVERIFIED; eight shared-rule rows PARTIAL; all 1,392 identity/basic-action/printing-equivalence checks UNVERIFIED; `complete:false`.

**Runtime and release boundary:** browser coverage is a source-engine harness, not full production SimulatorClient gameplay. Android coverage loads the real packaged JavaScript in Node VM adapters; QuickJS/JNI/WebView and physical-device validation remain blocked by the missing SDK, adb, local Android configuration, attached device/emulator and release signing material. No deployment, publication, merge, signing or APK release occurred.

**Next:** finish B39 full-suite and provenance evidence, then audit hBP09-027 and continue every remaining ability, shared rule, card identity and printing. Keep the global audit incomplete until all required source and runtime gates are met.

## Batch 40 — hBP09-027 Noel's undamaged-HP Arts reduction Gift (2026-09-25)

**Official sources:** Japanese C page id 2744 and S page id 2916 were inspected live and match: hBP09-027 白銀ノエル, green 1st, 160 HP, 2-Colorless Baton, Gift 団長出陣！, and 40-damage Green+Colorless Arts. Both printings carry the same Gift text. The current official card-number Q&A search returned zero results; the current errata index has no hBP09-027 entry. These current-page checks are not exhaustive historical archive checks. Comprehensive Rules 1.9.0 §§12.3.4.4–12.3.4.5 describe adding other Arts modifiers before dealing the resulting Arts damage; official FAQ Q167 distinguishes Arts damage from card-effect special damage.

**Finding:** no rules-engine defect was reproduced. The active-top Noel Gift subtracts 50 only from Arts damage received while Noel has zero prior damage and the Arts source is a 1st Holomem. The result is floored at zero; any prior damage disables the reduction. Debut Arts and special damage do not qualify. The effect applies when Noel is in Center or Collab and stops when Noel is covered by another top Bloom.

**Evidence:** `website/tests/effect-audit-hbp09-027.test.mjs` passes 7/7 across identity, damage floor, prior-damage cutoff, source level, position, covered-card lifetime and a real Arts that first deals special damage. The manually operated current-source browser harness passes all 7 checks. `android-current/tests/hbp09-027-release.test.mjs` passes 10/10 against the actual packaged offline and Firebase PvP JavaScript rule bundles in Node VM adapters. The first Android special-damage attempt exposed a missing 2nd #歌 unit in the test fixture, not a production discrepancy; once the required official card condition was present, both packaged paths matched website behavior at 50 total damage. Browser, focused and official-source results are in `website/evidence/effect-audit/20260925-batch-40/`.

**Current matrix:** 1,392 local card records, 2,906 printing variants, 2,468 ability rows and 3,130 clauses; 69 ability rows PARTIAL / 2,399 UNVERIFIED; 68 clauses PARTIAL / 3,062 UNVERIFIED; eight shared-rule rows PARTIAL; all 1,392 identity/basic-action/printing-equivalence checks UNVERIFIED; `complete:false`.

**Runtime and release boundary:** browser coverage is a focused source-engine harness, not complete production SimulatorClient gameplay. Android coverage executes the actual packaged offline and PvP JavaScript bundles in Node VM adapters; Android QuickJS/JNI/WebView/device testing and signed APK build remain blocked by missing SDK, adb, local Android configuration, device/emulator and release signing material. No deployment, publication, merge, signing or APK release occurred.

**Full-suite evidence:** after adding B40 coverage, website `npm test` passes 11/11 sync checks, 2,504/2,504 regression assertions, TypeScript no-emit and Firebase production build (`website/evidence/effect-audit/20260925-batch-40/website-full.log`). Android host/package suite passes 313/313 across 54 files (`android-full-serial.log`). Fresh environment check is saved as `android-runtime-access.json`.

**Provenance:** B39 hashes and the batch-end matrix snapshot are recorded in `website/evidence/effect-audit/20260925-batch-39/provenance-batch39.json`. B40 source/test/evidence hashes and the current matrix/access snapshot are in `website/evidence/effect-audit/20260925-batch-40/provenance-batch40.json`.

**Next:** capture B39/B40 provenance, then audit hBP09-028. Continue every older set, starter, promo, Oshi, Support, shared rule and card identity/printing gate; never mark the global audit complete while any required row remains UNVERIFIED or production-runtime gate is blocked.

## Batch 41 — hBP09-028 Noel's Adventure Gyudon Bloom search (2026-09-25)

**Official sources:** live official Japanese hBP09-028 C id2745 and S id2917 pages agree on 白銀ノエル, green 1st, 150 HP, and Bloom Effect ノエルの冒険: `自分のデッキから、〈牛丼〉1枚を公開し、手札に加える。そしてデッキをシャッフルする。` The official hBP09-003 Noel recipe identifies hBP09-100 ノエルの特盛牛丼 as a search target. Comprehensive Rules 1.9.0 §§5.6.1, 5.6.1.1 and 10.7.2.3.5 plus FAQ Q751 govern the search and mandatory final shuffle. Live card-number Q&A search returned zero results. Current errata pages 1 and 2 contain no hBP09-028 entry; this is not an exhaustive historic archive claim. Full source notes are in `website/evidence/effect-audit/20260925-batch-41/official-sources.md`.

**Finding:** no production rules defect was reproduced. A real Bloom from a staged Noel Debut opens a revealed selection containing only eligible Gyudon; confirming it adds one card to hand and then shuffles once, preserving nonmatching cards. If no Gyudon exists, the effect finishes without a card choice but still shuffles once under Q751. The website helper and both Android packaged rules paths agree.

**Evidence:** website `tests/effect-audit-hbp09-028.test.mjs` passes 3/3; manually operated current-source Chromium harness `tests/browser/effect-audit-hbp09-028.html/.mjs` passes 3/3. Android `tests/hbp09-028-release.test.mjs` passes 4/4 against packaged offline and Firebase PvP rules. Full website `npm test` passes 11/11 sync checks, 2,507/2,507 regression assertions, TypeScript no-emit and Firebase production build (`website/evidence/effect-audit/20260925-batch-41/website-full.log`). Full serialized Android host/package suite passes 317/317 assertions across 55 files (`android-full-serial.log`). Browser/source notes, focused logs, current runtime boundaries, matrix snapshot and SHA-256 provenance are recorded in the B41 evidence directory.

**Current matrix:** 1,392 card records, 2,906 printing variants, 2,468 ability rows and 3,130 clauses; 70 ability rows PARTIAL / 2,398 UNVERIFIED; 69 clauses PARTIAL / 3,061 UNVERIFIED; eight shared-rule rows PARTIAL; all 1,392 card identity/basic-action/printing-equivalence checks UNVERIFIED; `complete:false`.

**Runtime and release boundary:** browser testing exercises current website source `applyAction`, not full production SimulatorClient gameplay. Android tests execute the exact packaged offline `engine.js` and Firebase `firebase-rules.js` through Node VM adapters, not QuickJS/JNI/WebView or a physical device. Device/runtime and signed-APK validation remain blocked by the previously captured missing Android SDK, adb, local project configuration, attached device/emulator and signing material. No build/signing, deployment, publication, merge or APK release occurred.

**Next:** audit both hBP09-029 clauses independently: its 2nd Noel search Arts and Buzz Extra replacement of the normal Down Life loss. Continue all remaining hBP09 and older card abilities, starters, promos, Oshi, Support, shared rules, and every card identity/basic-action/printing check. Keep the global audit incomplete while any row or runtime gate remains open.

## Batch 42 — hBP09-029 Noel Arts search and Buzz Down Extra (2026-09-25)

**Official sources:** Japanese hBP09-029 R id 2746 and SR id 2877 agree on card identity, BIG3懇親会 side N and the Buzz Extra. Comprehensive Rules 1.9.0 §§5.6.1, 5.6.1.1, 10.7.2.3.5 and 2.11.2.2; official FAQ Q159, Q196 and Q751 apply. The live hBP09-029 Q&A search returned Q750 only, which is about a separate Support modifier; current errata pages 1 and 2 do not list hBP09-029. These current-page checks do not claim exhaustive historical archive coverage. Detailed notes and direct official links are in `evidence/effect-audit/20260925-batch-42/official-sources.md`.

**Finding:** no production rules defect was reproduced. The Arts finds any eligible 2nd Noel, rejects other 2nd Holomem and non-Holomem, adds the selected card, performs one final shuffle, then completes 100 Arts damage. If no target exists, the mandatory shuffle still occurs under Q751 and the Arts damage resolves. When active-top Buzz hBP09-029 is Downed, the -2 Extra replaces ordinary -1 (exactly two Life are lost, not three); Life-to-Cheer occurs one at a time under Q159. A non-Buzz top Bloom covering the Buzz ends the replacement. Website and both packaged Android rules paths agree.

**Evidence:** website focused rules test passes 5/5; manually operated Chromium current-source harness passes 7/7; Android focused tests pass 8/8 across packaged offline and Firebase PvP rules. Full website `npm test` passes 11/11 sync checks, 2,512/2,512 regression assertions, TypeScript no-emit and Firebase production build (`evidence/effect-audit/20260925-batch-42/website-full.log`). Full Android host/package suite passes 325/325 across 56 files (`android-full-serial.log`).

**Matrix:** 1,392 local cards, 2,906 printing variants, 2,468 ability rows and 3,130 clauses; 72 abilities PARTIAL / 2,396 UNVERIFIED; 72 clauses PARTIAL / 3,058 UNVERIFIED; eight shared-rule rows PARTIAL; all 1,392 identity/basic-action/printing-equivalence checks UNVERIFIED; `complete:false`. The hBP09-029 Arts ability and Extra are PARTIAL, because full production SimulatorClient and Android application runtime verification remain outstanding.

**Runtime/access boundary:** Chrome exercised the current source `applyAction` harness, not the complete production match UI. Android used exact packaged Offline `engine.js` and Firebase PvP `firebase-rules.js` in Node VM adapters; this is not QuickJS/JNI/WebView/device execution. Fresh check found Java and Gradle wrapper but no Android SDK variables/path, `local.properties`, system Gradle, `adb`, device/emulator or named project release keystore. No Android build/signing, website deployment, publication, merge or release occurred. Runtime and access evidence plus input/output hashes are in `evidence/effect-audit/20260925-batch-42/`.

**Next:** audit hBP09-030 against both official Japanese printing text and applicable rules, then continue every remaining card effect, shared rule, official identity, basic action and printing reconciliation. Keep the global audit incomplete while required rows or runtime gates remain open.

## Batch 43 — hBP09-030 Noel's Gyudon recovery distribution (2026-09-25)

**Official sources:** Japanese hBP09-030 U id2747 and S id2918 have identical identity and effect text. The official Noel recipe explains the hBP09-031 and Gyudon interaction; hBP09-100 id2817 is expressly also treated as 〈牛丼〉. Comprehensive Rules 1.9.0 §§1.3.2.2, 5.23.1–5.23.1.1 and 10.7.2.3–10.7.2.3.4 govern zero repetitions, HP recovery and choices. Current card-number Q&A and current errata pages were checked; no hBP09-030 specific ruling or erratum surfaced. Source URLs and interpretation are in `evidence/effect-audit/20260925-batch-43/official-sources.md`.

**Reproduced defect and repair:** the printed Collab says one own Holomem recovers 10 HP for each archived Gyudon. Before repair, website and packaged Android Offline/Firebase PvP each collapsed multiple recoveries into one ordinary `stageTarget`, and showed an empty target prompt for zero Gyudon. Replaced the card-specific encoding with the existing shared `healDistribution` mechanic in website and Android production rule sources; each archive card now supplies one allocatable 10-HP increment, with no prompt at zero. Rebuilt both packaged Android rules bundles and generalized the user-facing allocation label from fixed 20 HP to per-increment recovery.

**Evidence:** pre-fix focused website and Android tests reproduce the same semantic failure. Post-fix website focused tests pass 8/8; exact packaged Android Offline and Firebase PvP NativeRules pass 10/10; the packaged Offline AI resolves a real choice created by packaged PvP rules. Manually operated Chromium current-source harness passes 7/7. An isolated mutation that disables the shared distribution operation is detected by five Android focused failures; production sources were not mutated. Full website checks pass sync 11/11, regression 2,520/2,520, TypeScript no-emit and Firebase production build. Full serialized Android host/package suite passes 335/335 assertions across 57 files. Logs are in `evidence/effect-audit/20260925-batch-43/`.

**Matrix:** 1,392 card numbers, 2,906 printings, 2,468 ability rows and 3,130 clauses; 74 ability rows PARTIAL / 2,394 UNVERIFIED; 74 clauses PARTIAL / 3,056 UNVERIFIED; eight shared rules PARTIAL; all 1,392 identity/basic-action/printing-equivalence checks UNVERIFIED; `complete:false`. hBP09-030 Collab and Arts remain PARTIAL because full SimulatorClient, QuickJS/JNI/WebView/device paths and global identity/product/interaction gates remain open.

**Runtime and release boundary:** browser evidence is a current-source `applyAction` harness, not the full production battle UI. Android evidence executes the exact packaged Offline and Firebase PvP JS rules in Node VM adapters, not Android QuickJS/JNI/WebView/device. Fresh check confirms Java and Gradle wrapper, but no Android SDK/default SDK path, `adb`, `local.properties`, device/emulator or project signing material is available. No local APK build/signing, deployment, publication, merge or release occurred. Source/test/log hashes and parsed summaries are in `evidence/effect-audit/20260925-batch-43/provenance-batch43.json`.

**Next:** begin hBP09-031's once-per-turn 〈牛丼〉 recovery Gift and remaining-HP/Noel-Oshi Arts threshold, then continue all remaining cards, shared rules, source reconciliation, mutation, interaction, persistence/replay and seeded stress gates. Keep the global audit incomplete until every applicable row and runtime gate is resolved.

## Batch 44 — hBP09-031 Noel's Gyudon Gift and threshold Arts (2026-09-25)

**Official sources:** live Japanese RR id2748, SR id2878 and UR id2860 card pages list hBP09-031; official Noel deck recipe confirms hBP09-100 is 〈牛丼〉; legacy hBP05-075 is also titled 牛丼. Comprehensive Rules 1.9.0 §§5.23.1–5.23.1.1, 10.7.2.1.1, 10.7.2.5.2 and 13.4 were checked. Card-page Q750 concerns a different Support. The current hBP09-031 Q&A search and current official errata index pages 1–3 did not surface a card-specific ruling or erratum. The current Q&A/errata checks do not claim exhaustive historical archive coverage. Detailed source notes are in `evidence/effect-audit/20260925-batch-44/official-sources.md`.

**Finding:** no website or packaged-rule defect was reproduced. The Gift grants +100 recovery once per turn per active hBP09-031 copy when that Holomem is healed by a 〈牛丼〉 ability, whether through hBP09-100 or legacy hBP05-075; the hBP09-030 archive-count recovery is not itself a 〈牛丼〉 ability. Its Arts adds +200 when a named Noel Oshi is used and remaining HP is at least 200 (exactly 200 qualifies); its independent Blue-target +50 stacks. Older Noel Oshi printings qualify by name. Website 10/10 and packaged Android Offline/Firebase PvP 13/13 agree.

**Evidence:** current-source manually operated Chromium harness passes 6/6. A targeted isolated mutation lowering the Arts threshold from 200 to 199 is detected by two failing Android package test cases, one in each packaged Offline/PvP bundle; production bundles were not modified. Website `npm test` completed with exit code 0: sync 11/11, regressions 2,530/2,530, TypeScript no-emit and Firebase production build passed. The serialized Android host/package runner completed with exit code 0: 58 test files, 348 cases, zero failures. Aggregate console results are recorded in `evidence/effect-audit/20260925-batch-44/full-suite-results.json`.

**Matrix:** 1,392 local cards, 2,906 printing variants, 2,468 ability rows and 3,130 clauses; 76 ability rows PARTIAL / 2,392 UNVERIFIED; 76 clauses PARTIAL / 3,054 UNVERIFIED; eight shared-rule rows PARTIAL; all card identity/basic-action/printing checks remain UNVERIFIED; `complete:false`. hBP09-031 Gift and Arts remain PARTIAL because full SimulatorClient and Android application runtime/device verification, printing reconciliation and global product-scope gates remain outstanding.

**Runtime and release boundary:** Chromium exercised the current source `applyAction` harness, not the complete production SimulatorClient. Android tests loaded the exact packaged Offline `engine.js` and Firebase `firebase-rules.js` through Node VM adapters, not QuickJS/JNI/WebView/device execution. Fresh access check confirms Java and Gradle wrapper are present, but Android SDK variables/path, `local.properties`, `adb`, device/emulator and release keystore files are absent. No Android APK build/signing, Firebase/site deployment, publication, merge or release occurred. Source and result hashes are recorded in `evidence/effect-audit/20260925-batch-44/provenance-batch44.json`.

**Next:** audit hBP09-032's optional Mascot/Fan hand cost, reveal/top-deck ordering and Gamer Cheer assignment; then continue all remaining card abilities and the global completion gates. Keep the audit incomplete while any effect, identity, basic-action, printing, shared-rule or runtime row remains PARTIAL/UNVERIFIED or inaccessible.

## Batch 45 — hBP09-032 Mio Collab and Arts (2026-09-25 continuation)

**Official text and rules:** Official Japanese C/S pages id 2749/2919 agree on 大神ミオ, green Debut, 100 HP, the optional revealed Mascot/Fan hand cost, deck-top return, Gamer-only Cheer assignment, and green 20 Arts. Comprehensive Rules 1.9.0 §§1.3.2.2, 5.11.1, 5.17.2, 5.21.1–5.21.2, 10.4.1–10.4.2.2, 10.7.2.3.1, 12.3.3.1–12.3.3.1.1 were checked; current Q&A search returned zero and current errata pages 1–3 did not list the card. See `evidence/effect-audit/20260925-batch-45/official-sources.md`.

**Finding:** no production behavior defect was reproduced. The optional cost filters to Mascot/Fan, publicly reveals and returns that same card to the deck top, with no reshuffle; after payment, Cheer goes only to an own Gamer. With an empty Cheer Deck the valid Gamer choice resolves without fabricating Cheer. Green 20 Arts requires but preserves its green Cheer, rests its source and deals 20. Earlier failing assertions were test-authoring errors corrected from CR §§1.3.2.2 and 12.3.3.1.1; no rule source changed.

**Evidence:** website production-source tests pass 9/9; manually operated Chromium harness passes 11/11; tests against the exact packaged Android Offline and Firebase PvP rules pass 13/13. An isolated mutation removing the Gamer tag filter was caught by four focused cases across both packages and left production package hashes unchanged. Logs and mutation evidence are in `evidence/effect-audit/20260925-batch-45/`.

**Runtime boundary:** browser evidence is a source `applyAction` harness, not complete production SimulatorClient play. Android evidence executes the exact packaged JS rule bundles in host Node VM adapters, not Android QuickJS/JNI/WebView or a physical device. No Android build/signing, website deployment, merge, publication or release occurred.

## Batch 46 — hBP09-033 Mio Bloom optional mill and conditional Cheer (2026-09-25)

**Official text and rules:** Official Japanese U id 2750 and S id 2920 pages agree on 大神ミオ, green 1st, 170 HP, Bloom Effect 濡れ髪ミオしゃ and 50 Arts. CR 1.9.0 §§1.3.2–1.3.2.2, 5.21.1–5.21.2, 10.4.1–10.4.2.2, 10.7.2.3.1 and 12.3.3.1–12.3.3.1.1 were checked. The current official hBP09-033 Q&A page returned zero results; current errata index pages 1–3 contain no card entry. See `evidence/effect-audit/20260925-batch-46/official-sources.md`.

**Finding:** no production rule defect was reproduced. Paying the optional pre-colon action archives exactly one deck-top card regardless of its type. The condition only sends Cheer when that archived card is a Support. Then one Cheer-deck top can go to any own Stage Holomem; the card has no name/tag/color restriction. Decline preserves deck/archive/Cheer; empty source decks produce no phantom card. The printed green plus colorless 50 Arts resolves and preserves its required Cheer.

**Evidence:** website production-source tests pass 7/7; manually operated Chromium harness passes 8/8; exact packaged Android Offline/Firebase PvP tests pass 13/13. An isolated mutation replacing the Support-triggered Cheer assignment with a valid no-target operation is detected by four focused tests (two in each package); original package hashes are unchanged. Test outputs and mutation records are in `evidence/effect-audit/20260925-batch-46/`.

**Current matrix after Batch 46:** 1,392 card records, 2,906 printings, 2,468 ability rows and 3,130 clauses; 80 ability rows PARTIAL / 2,388 UNVERIFIED; 78 clauses PARTIAL / 3,052 UNVERIFIED; eight shared-rule rows PARTIAL; all 1,392 identity/basic-action/printing checks UNVERIFIED; `complete:false`.

**Runtime and publication boundary:** Chromium used current website source, not the full production battle UI. Android tests used exact packaged `engine.js` and `firebase-rules.js` through host Node VM adapters; installed app, QuickJS/JNI/WebView and device remain unverified. Android SDK/adb/device/signing access remains unavailable per the prior fresh access audit. No build/signing, deployment, publication, merge or release occurred.

**Next:** continue hBP09-034 and then every remaining hBP09/older card effect, starter, promo, Oshi and Support, followed by shared-rule, identity/printing, interactions, persistence/replay, mutation and seeded-stress gates. Do not mark the audit complete while any row or runtime gate is open.

## Batch 47 — hBP09-034 Mio Collab, Buzz Extra and Arts (2026-09-25)

**Official sources:** Official Japanese R id 2751 and SR id 2879 pages list 大神ミオ as a 240 HP green 1st Buzz Holomem, with a two-card Mascot/Fan Collab cost, 100 HP recovery, 110 Arts and Extra「このホロメンがダウンした時、自分のライフ-2」. CR ver. 1.9.0 §§2.11.2.2–2.11.2.2.1, 5.23.1–5.23.1.1, 10.4.1–10.4.2.2, 10.7.2.3.1 and 12.3.3.1–12.3.3.1.1 were checked. Official FAQ Q159/Q196 confirms Life processing is one card at a time and -2 replaces ordinary Down loss rather than producing -3. Card-number Q&A search returned zero; current errata pages 1–3 have no entry. See `evidence/effect-audit/20260925-batch-47/official-sources.md`.

**Finding:** no production defect was reproduced. The optional cost accepts exactly two archived Mascot/Fan cards in any mixture; returned cards become deck top in the selected order. An Event or Holomem is not eligible, and one eligible card cannot pay. If paid, one own Stage Holomem recovers up to 100 HP. The 110 Arts requires green/green/colorless Cheer, rests the source, keeps cost Cheer attached, and is rejected without mutation when only two Cheer are attached. Downing this Buzz via that Arts makes its owner lose exactly two Life.

**Evidence:** website current-source tests pass 6/6; manually operated Chromium harness passes 8/8; tests against the exact packaged Android Offline and Firebase PvP rule bundles pass 7/7. An isolated mutation excluding archived Fan cards is caught by four Android tests across both packages; production bundle hashes stay unchanged. Focused logs and mutation results are in `evidence/effect-audit/20260925-batch-47/`.

**Fresh full-suite evidence:** website `npm test` exits 0 with 11/11 sync tests, 2,552/2,552 regression tests, TypeScript no-emit and Firebase production build. Android `node scripts/run-host-package-tests.mjs` exits 0 with 61 files and 381/381 assertions, zero failures or skips. The latter executes host/package suites, not Android application UI or QuickJS/JNI.

**Release runtime boundary:** rechecked current environment: Java and `gradlew.bat` exist, but `ANDROID_HOME`/`ANDROID_SDK_ROOT`, standard SDK paths, `adb`, both root/app `local.properties`, attached device/emulator and named `.jks`/keystore files are absent. A local `:app:assembleDebug` attempt stopped before Gradle configuration because wrapper Gradle 8.11.1 was not cached and its download from `services.gradle.org` was denied by network permissions. Thus no APK candidate, installed-app, signed identity or real-device verification is claimed. No deployment, publication, merge or signing occurred. Exact snapshot is `evidence/effect-audit/20260925-batch-47/android-runtime-access.json`.

**Matrix after Batch 47:** 1,392 card records, 2,906 printings, 2,468 ability rows and 3,130 clauses; 83 ability rows PARTIAL / 2,385 UNVERIFIED; 80 clauses PARTIAL / 3,050 UNVERIFIED; eight shared-rule rows PARTIAL; all 1,392 identity/basic-action/printing checks UNVERIFIED; `complete:false`.

**Next:** continue hBP09-035 and then every remaining hBP09/older effect, starter, promo, Oshi and Support, while reconciling each identity/printing. Follow with full interaction, persistence/replay, mutation and seeded-stress gates. Keep the audit incomplete while any card row, clause, shared rule or production runtime gate remains open.
## Batch 48 — hBP09-035 Mio Bloom and Arts (2026-09-25)

**Official sources:** Official Japanese RR/SR/UR pages for hBP09-035 agree on 大神ミオ, green 2nd, 210 HP, the Mio-Oshi Bloom effect, 180+ Arts, Blue +50 and its optional two-card Main Deck archive cost with +30 Arts per archived Support. Comprehensive Rules v1.9.0 §§1.3.2, 10.4.1–10.4.2.2, 10.7.2.3.1–10.7.2.3.5 and 12.3.3–12.3.4 were checked. The current card-number Q&A search returned zero entries; current errata index pages 1–3 have no hBP09-035 entry. Details and source URLs are in `evidence/effect-audit/20260925-batch-48/official-sources.md`.

**Reproduced production defect and repair:** The Arts code offered its yes/no two-card cost even when the Main Deck contained zero or one card. With one card, it permitted the impossible partial cost. This contradicts CR §10.4.2.2, which prohibits paying any portion of a cost if any required part is impossible. Website `lib/simulator/hbp09/programs.mjs` and the maintained Android web rule source now gate that optional choice on at least two Main Deck cards. The current Android Offline and Firebase PvP rule bundles were rebuilt from the Android app’s own rule source. Ordinary Arts damage still resolves when the optional cost is unavailable.

**Behavior and evidence:** Website focused cases pass 9/9; manually operated current-source Chromium harness passes 7/7; exact Android packaged-rule cases pass 7/7 across Offline and Firebase PvP. Cases include zero/one/two-card availability, Mio Oshi-name matching and Bloom order, one-card maximum return, Support-only bonus counting, target choice, Blue modifier, cost decline, and Buzz KO. Before the fix, the website shortage test failed and both Android packages failed the zero/one-card cases. An isolated mutation lowering the Android bundle threshold to zero makes all four shortage cases fail; production bundle hashes remain unchanged by mutation. Evidence is in `evidence/effect-audit/20260925-batch-48/`.

**Fresh full suites:** Website `npm test` exits 0 with 11/11 sync checks, 2,561/2,561 regression checks, TypeScript no-emit and Firebase production build. Android `node scripts/run-host-package-tests.mjs` exits 0 with 62 files, 388/388 assertions, and zero failures/skips. Android assets rebuilt for this fix hash to `engine.js` SHA-256 `104943cd7d02c17736d520ac34026c0c45b3503f15033152b5ef28417406259b` and `firebase-rules.js` SHA-256 `f92412a70c0567bb790432106d8dfb6f59f407d87ad554d6a70b1d329fec4cf7`.

**Runtime and release boundary:** Chromium used the current website source `applyAction` harness, not complete SimulatorClient gameplay. Android tests executed the exact APK-packaged Offline and Firebase PvP JavaScript bundles in Node VM adapters, not Android QuickJS/JNI/WebView or an installed physical device. Android SDK/adb/device and original signing-key access remain unavailable per Batch 47’s fresh access check; no candidate APK, deployment, publication, merge, signing or release occurred. The task therefore remains incomplete.

**Current matrix after Batch 48:** 1,392 card records, 2,906 printings, 2,468 ability rows and 3,130 clauses; 85 abilities PARTIAL / 2,383 UNVERIFIED; 83 clauses PARTIAL / 3,047 UNVERIFIED; eight shared rules PARTIAL; all 1,392 identity/basic-action/printing checks UNVERIFIED; `complete:false`.

**Next:** continue hBP09-036, then every remaining hBP09 and older card effect, starter, promo, Oshi and Support; finish shared-rule, identity and printing gates plus cross-card, persistence/replay and seeded-stress checks. Keep the audit incomplete while any required row or actual Android runtime gate is open.

## Batch 49 — hBP09-036 Iroha Collab and Arts (2026-09-25)

**Official sources:** Live official Japanese R id2753 and SR id2881 pages agree on 風真いろは's identity and text. Current hBP09-036 Q&A search returned zero. Current errata pages 1–3 have no hBP09-036 entry. Comprehensive Rules v1.9.0 §§2.4.4, 4.4.2.1–4.4.2.2, 5.6.1–5.6.1.1, 9.2.1, 12.3.3.1–12.3.3.1.1, 12.3.4.1–12.3.4.5 and 13.2.1.1–13.2.2 apply. Official Q751 requires the written subsequent shuffle even when another effect part cannot be processed. Full source notes and direct URLs are in `evidence/effect-audit/20260925-batch-49/official-sources.md`.

**Finding:** no production rules defect was reproduced. The live implementation in the website and Android-owned rule source already selects only an own-stage top-card AZKi, filters the Cheer Deck by any shared color, attaches to the selected AZKi, and queues a shuffle. The Arts implementation counts only Cheer on the current top own Center AZKi, adds 20 per Cheer, and leaves Arts cost Cheer attached. No production source or packaged bundle was changed in this batch; targeted tests now cover the previously unverified behavior.

**Evidence:** website focused Node cases pass 7/7; manually operated Chromium current-source `applyAction` harness passes 9/9; exact packaged Android Offline and Firebase PvP rule tests pass 7/7. Coverage includes R/SR identity and text, own versus opponent/back targets, green/purple matching, searching past unrelated Cheer, no-match shuffle (deterministic ordering in website/Chromium), Arts damage at 0/1/3 Center AZKi Cheer, cost Cheer retention, and excluding off-Center, opponent, and covered AZKi. Full website `npm test` exited 0, including sync, regression, TypeScript and Firebase production build. Full Android host/package suite exited 0: 63 files, 395 assertions passed, 0 failed, 0 skipped. Batch evidence and hashes are in `evidence/effect-audit/20260925-batch-49/`.

**Runtime boundary:** browser testing uses current website `applyAction`, not the full production SimulatorClient UI. Android host tests run the exact packaged `engine.js` and Firebase `firebase-rules.js` through Node VM adapters, not Android QuickJS/JNI/WebView or a physical device. Android SDK/adb/device and original signing-key access remain unavailable per the fresh runtime snapshot in this evidence folder; no candidate APK, signing, deployment, publication or merge occurred.

**Matrix after Batch 49:** 1,392 card records, 2,906 printings, 2,468 ability rows and 3,130 clauses; 87 ability rows PARTIAL / 2,381 UNVERIFIED; 87 clauses PARTIAL / 3,043 UNVERIFIED; eight shared-rule rows PARTIAL; all 1,392 identity/basic-action/printing checks UNVERIFIED; `complete:false`. Both hBP09-036 abilities are PARTIAL pending production Android application/browser UI gates and global identity/printing reconciliation.

**Next:** complete hBP09-037 Victory Feast Arts coverage; its Fantastic Driver Gift already has a Q719 state-settlement case, but both rows remain partial. Continue all remaining card abilities, starters, promos, Oshi/Support effects, shared rules, identity and printing reconciliation, and interaction/persistence/replay gates. Keep the global audit incomplete while any matrix row or production runtime gate remains open.

## Batch 50 — hBP09-037 Victory Feast Arts (2026-09-25)

**Official sources:** The live official Japanese hBP09-037 R page gives Victory Feast 80+, Yellow +50, and +30 for each own-stage non-Debut Holomem while the Oshi is Chihaya Rindo; the page also includes Q719 for the separate Gift. Comprehensive Rules v1.9.0 §§2.4.4, 4.4.2.1–4.4.2.2, 12.3.3.1–12.3.3.1.1 and 12.3.4.1–12.3.4.5 govern stage identity/counting, retained Arts Cheer, and damage modifiers. Current errata pages 1–3 have no hBP09-037 entry. Detailed URLs and rule notes are in `evidence/effect-audit/20260925-batch-50/official-sources.md`.

**Finding:** no gameplay defect was reproduced. The website and packaged Android rules already count the attacker and all own stage zones, exclude Debut, count a Bloom stack as one unit, gate the +30 on the Chihaya Oshi name, apply the Yellow +50 independently, rest the attacker, and leave its required Cheer attached. The card detail carried a stale note saying its official Japanese text was unverified; that note now accurately says production browser/Android runtime validation is outstanding. No gameplay rules code or packaged Android bundle changed.

**Evidence:** website focused tests pass 6/6; manually operated Chromium current-source harness passes 5/5; exact packaged Android Offline and Firebase PvP rules pass 8/8 plus the packaged catalog text/identity assertion. Fresh full website `npm test` exits 0: sync 11/11, regression 2,574/2,574, TypeScript no-emit and Firebase production build. Android host/package suite exits 0: 64 files, 404/404 assertions, zero failures or skips. Logs, current access snapshot and source hashes are in `evidence/effect-audit/20260925-batch-50/`.

**Runtime boundary:** Chromium exercises current website `applyAction`, not complete SimulatorClient gameplay. Android host tests use the APK-packaged `engine.js` and `firebase-rules.js` through Node VM NativeRules adapters, not Android QuickJS/JNI/WebView or an installed device. A fresh access check finds no Android SDK environment/candidate paths, adb, project `local.properties`, or project release keystore; a user debug keystore exists but does not establish the original signing identity. No APK build/sign, deployment, publication or merge occurred.

**Matrix after Batch 50:** 1,392 card records, 2,906 printings, 2,468 ability rows and 3,130 clauses; 88 abilities PARTIAL / 2,380 UNVERIFIED; 88 clauses PARTIAL / 3,042 UNVERIFIED; eight shared rules PARTIAL; all 1,392 identity/basic-action/printing checks UNVERIFIED; `complete:false`. Both hBP09-037 Gift and Arts rows remain PARTIAL pending full production browser/device and global reconciliation gates.

**Next:** hBP09-038 and the remaining hBP09 effects, then all older booster, starter, promo, Oshi and Support effects; keep closing shared-rule, printing, interaction, persistence/replay, mutation and stress gates. Do not mark this audit complete while any required matrix row or production runtime gate remains open.

## Batch 51 — hBP09-038 Kaela Collab Effect and Arts (2026-09-25)

**Official sources:** Official Japanese hBP09-038 C page id2755 gives Kaela Kovalskia, red Debut, 110 HP, the Blacksmith Collab Effect, and red 30 Arts. The effect draws one card only if a Tool is attached to this Holomem; the tag is not limited to Kaela's Arms. Comprehensive Rules v1.9.0 §§4.4.3, 5.16.1, 10.1.1.2, 10.2.1.1, 10.7.2.5.2 and 10.8.1–10.8.3 apply. A current card-number Q&A search found no entry; current errata page 3 has no entry, while pages 1–2 were not freshly reachable during this batch. Detailed notes are in `evidence/effect-audit/20260925-batch-51/official-sources.md`.

**Finding:** no production rules defect was reproduced. A Tool attached to Kaela triggers one draw after ordinary Collab moves the Main Deck's top card to Holo Power. A Tool on another Holomem does not qualify; the Tool need not have Kaela's Arms identity. If ordinary Collab consumes the last deck card, the effect cannot draw an additional card. The red 30 Arts rests Kaela and keeps its required Cheer attached. Website, current-source manually operated Chromium, and both exact Android packaged NativeRules paths agreed. No game-rule source or Android bundle changed.

**Evidence:** focused website cases pass 6/6, Chromium 6/6, and exact packaged Android Offline/Firebase PvP tests 11/11. Full website suite passes 2,580/2,580 regression assertions plus 11/11 sync tests, TypeScript no-emit and Firebase production build. Android host/package suite passes 415 assertions across 65 files with no failures or skips. Results and sources are in `evidence/effect-audit/20260925-batch-51/`.

**Matrix after Batch 51:** 1,392 card records, 2,906 printings, 2,468 ability rows and 3,130 clauses; 90 ability rows PARTIAL / 2,378 UNVERIFIED; 89 clauses PARTIAL / 3,041 UNVERIFIED; eight shared-rule rows PARTIAL; all 1,392 card identity/basic-action/printing checks UNVERIFIED; `complete:false`.

**Runtime boundary:** browser coverage exercises current-source `applyAction`, not the complete SimulatorClient UI. Android executes exact packaged Offline and Firebase PvP JavaScript rules through Node VM adapters, not QuickJS/JNI/WebView or installed-device runtime. No APK build/signing, deployment, publication, merge or release occurred. Preserve the current SDK/device/signing access blockers from the latest runtime snapshot.

## Batch 52 — hBP09-039 Workaholic and Arts (2026-09-25)

**Official sources:** Official Japanese hBP09-039 U page id2756 gives second-player-first-turn Tool search text. Official Q&A Q651 on hBP08-021 establishes that “two” may resolve by taking one; Q177/Q178 establish a mandatory effect cannot be declined when a matching card exists unless the text says `できる`. Comprehensive Rules v1.9.0 §§5.11.2, 5.6.1–5.6.1.1, 5.15.1 and 13.2.1–13.2.2 apply. The current errata index did not list this card. Source notes and direct links are in `evidence/effect-audit/20260925-batch-52/official-sources.md`.

**Reproduced defect and repair:** both the card program and shared continuation prompt allowed zero selected Tools while a match existed. The pre-fix website test failed with `pendingChoice.min=0`; exact pre-rebuild Android Offline and Firebase PvP bundles reproduced this for multiple matching Tools and for one match. The card now requests one to two selections. Shared prompt logic honors an explicit positive minimum instead of forcing every search to zero; explicitly optional or zero-minimum calls remain optional. Android-owned source was rebuilt into both packaged NativeRules bundles.

**Evidence:** website focused cases pass 7/7; manually operated Chromium 8/8; exact packaged Android Offline/Firebase PvP tests 15/15. Full website `npm test` passed 2,587/2,587 regression assertions, sync checks, TypeScript no-emit and Firebase production build. Android host/package suite passed 430 assertions across 66 files, zero failures/skips. Source, before-fix failure, full results, runtime boundary and hashes are in `evidence/effect-audit/20260925-batch-52/`; packaged Offline `engine.js` SHA-256 is `3954F0F4174AC1708C9A08945153BD8599AE7E0143CC8E71EA236B998903AA4B`, Firebase PvP `firebase-rules.js` is `4CFDA763777EE7F597E6C62B7C73AC058745E218ED2FE03262CBCC04CC74578A`.

**Matrix after Batch 52:** 1,392 card records, 2,906 printings, 2,468 ability rows and 3,130 clauses; 92 ability rows PARTIAL / 2,376 UNVERIFIED; 90 clauses PARTIAL / 3,040 UNVERIFIED; eight shared-rule rows PARTIAL; all 1,392 card identity/basic-action/printing checks UNVERIFIED; `complete:false`.

**Runtime boundary:** Chromium exercised current-source `applyAction`, not full SimulatorClient gameplay. Android tests executed the exact packaged JS in Node adapters, not QuickJS/JNI/WebView or an installed device. No APK build/signing, deployment, publication, merge or release occurred.

**Next:** audit the remaining nine hBP09 program search steps using the shared helper. Verify each printed mandatory/optional selection range from official Japanese text, Q&A and errata; add a pre-fix regression against both current website and packaged Android rules before adjusting the helper default. Continue every remaining card, shared rule and completion gate; keep the matrix incomplete.

## Checkpoint backfill — Batches 53–56 (2026-09-25)

These batches were completed after the prior checkpoint but their concise summaries had not yet been appended here. Their raw evidence remains under `evidence/effect-audit/20260925-batch-53/`, `20260925-batch-54-hbp09-040-042/`, `20260925-batch-55-hbp09-043/`, and `20260925-batch-56-hbp09-044/`.

- **B53:** repaired mandatory minimum handling for the hBP09-013 and hBP09-016 search effects. Preserve the red tests and focused/full website plus Android logs in the B53 evidence folder.
- **B54:** audited hBP09-040/041/042 and fixed hBP04-098 conditional +10 parsing. Evidence includes matrix generation and website focused/full-suite logs.
- **B55:** audited hBP09-043; no gameplay defect was reproduced. Official sources, browser result, matrix output and website focused/full logs are retained.
- **B56:** audited hBP09-044; no gameplay defect was reproduced. Fixed an integration-test-first defect in the matrix generator, and retained official sources, browser result, matrix regression, and website logs.

## Batch 57 — hBP09-045 Haato Bloom and Arts (2026-09-25)

Official Japanese R/S pages, current errata index and Comprehensive Rules v1.9.0 §§1.3.2 and 1.3.5.1 were checked. The red/green tests cover the mutually exclusive die branches and the fixed-one Debut Haato Archive deployment for Arts. Root repair makes only that fixed-one deployment mandatory; the shared helper keeps other search calls optional. Matrix updates and tests are reproducible with `scripts/record-effect-audit-batch57.mjs`; raw red/focused/pre-fix suite logs are in `evidence/effect-audit/20260925-batch-57-hbp09-045/`.

## Batch 58 — hBP09-046 Ayame and official Q724 (2026-09-25)

Official U/S Japanese card pages and embedded Q724 plus Comprehensive Rules v1.9.0 §§1.3.2 and 12.3.3–12.3.4 were checked. The rules asked for an impossible Debut Ayame selection when six Holomem already occupied the Stage. Website and Android-owned hBP09 prompt logic now skips that impossible deployment while preserving the top-Cheer archive and Main Deck shuffle, and caps deployment selections to the remaining legal Stage room. Added regressions for Q724 full Stage, open slot, declined cost, paid fail-to-find, and the simple 20 Arts action.

Evidence is in `evidence/effect-audit/20260925-batch-58-hbp09-046-q724/` and `android-current/evidence/effect-audit/20260925-batch-58-hbp09-046-q724/`. The controlled pre-fix mutation made both website and packaged Android Q724 tests fail; after restoration, website focused 11/11, current-source Chromium 6/6, exact packaged Android Offline/Firebase 15/15. Fresh website full suite passes 11 sync tests and 2,644 regression assertions, `tsc --noEmit`, and Firebase production build. Fresh Android host/package suite passes 74 files / 492 assertions. Current matrix: 1,392 cards, 2,906 printings, 2,468 ability rows, 3,130 clauses; 106 abilities PARTIAL / 2,362 UNVERIFIED; 104 clauses PARTIAL / 3,026 UNVERIFIED; eight shared rules PARTIAL; identities 6 PARTIAL / 1,386 UNVERIFIED; basic actions 1 PARTIAL / 1,391 UNVERIFIED; printing checks 3 PARTIAL / 1,389 UNVERIFIED; `complete:false`.

**Current blocker and runtime boundary:** no Android SDK, `adb`, project `local.properties`, release keystore, APK candidate, or installed device was available in the fresh 2026-09-25 access check. Browser verification is current-source `applyAction`, and Android verification is exact packaged JavaScript under Node VM adapters; production SimulatorClient and Android QuickJS/JNI/WebView/device/signing remain unverified. No publish, deployment, merge, or release occurred.

## Batch 59 — hBP09-047 Hakos Baelz (2026-09-25)

No gameplay rules defect was reproduced. Official Japanese C/S pages id2764/id2926 agree on the FUNNY RAT own-Center Subaru condition, red Debut stats and Balloon Arts. Official card-number Q&A search returned no result. Website state tests cover Center versus Back/opponent/underlying Subaru, last-card draw, base Arts, Stage Subaru bonus and retained Cheer. Website focused 6/6, current-source Chromium 7/7, exact Android packaged Offline/Firebase 6/6; full website 11 sync and 2,650 regression checks plus TypeScript/Firebase build; Android host/package suite 75 files / 498 passed. Evidence is in `evidence/effect-audit/20260925-batch-59-hbp09-047/` and `android-current/evidence/effect-audit/20260925-batch-59-hbp09-047/`.

**Matrix after B59:** 1,392 cards, 2,906 printings, 2,468 ability rows, 3,130 clauses; 108 abilities PARTIAL / 2,360 UNVERIFIED; 106 clauses PARTIAL / 3,024 UNVERIFIED; eight shared rules PARTIAL; identities 7 PARTIAL / 1,385 UNVERIFIED; basic actions 2 PARTIAL / 1,390 UNVERIFIED; printings 4 PARTIAL / 1,388 UNVERIFIED; `complete:false`.

## Batch 60 — hBP09-048 CHAOTIC INVITATION and Arts (2026-09-25)

Official Japanese U/S pages id2765/id2927 and Comprehensive Rules v1.9.0 §§1.3.2, 4.1.2.3, 5.24, 12.3.3–12.3.4 and 13.3 were checked; the exact-number Q&A and errata searches found no hBP09-048 entry. No rules defect was reproduced. Website and exact Android Offline/Firebase packaged assets correctly gate the two 1st-card searches on own Subaru Oshi, permit fail-to-find one hidden target while resolving the second, and add 20 Special damage only on odd die results to opposing Collab. Website focused 7/7, Chromium 7/7, Android packaged 14/14; full website sync 11/11 and regression 2,657/2,657 plus TypeScript/Firebase build; Android host/package 76 files / 512 passed. Evidence and reproducible matrix update are in `website/evidence/effect-audit/20260925-batch-60-hbp09-048/` and `android-current/evidence/effect-audit/20260925-batch-60-hbp09-048/`. No rules bundle changed.

**Matrix after B60:** 1,392 cards, 2,906 printings, 2,468 ability rows, 3,130 clauses; 110 abilities PARTIAL / 2,358 UNVERIFIED; 108 clauses PARTIAL / 3,022 UNVERIFIED; eight shared rules PARTIAL; identities 8 PARTIAL / 1,384 UNVERIFIED; basic actions 3 PARTIAL / 1,389 UNVERIFIED; printings 5 PARTIAL / 1,387 UNVERIFIED; `complete:false`.

**Runtime boundary:** B59/B60 browser harnesses exercise current-source `applyAction`, not the full production SimulatorClient. Android host tests run exact packaged `engine.js` and `firebase-rules.js` through Node VM adapters, not QuickJS/JNI/WebView on a device. The fresh B60 access check again found no Android SDK, `adb`, project `local.properties`, or project keystore; candidate APK, original signing identity, camera/scanner and device runtime remain unavailable. No build, signing, deployment, publication, merge or release occurred.

**Next:** B61 hBP09-049 Hakos Baelz. Its 2nd-stage Gift reduces three Colorless Arts requirements when the own Oshi is Subaru; the Arts uses a Green special-attack icon (+50 against Green) and, under Subaru Oshi, recovers one Subaru or Baelz from Archive. Verify the exact R/SR text and Q&A/errata, test payment with and without the Gift condition, Green versus non-Green targets, required recovery and empty Archive, then run website/browser/exact Android package paths. Continue the full 1,392-card audit, scanner/image and production runtime gates; keep `complete:false`.

## Batch 61 — hBP09-049 Hakos Baelz Gift and Arts (2026-09-25)

Official Japanese R/SR pages id2766/id2886, the exact hBP09-049 Q&A search, all three current errata pages, and Comprehensive Rules v1.9.0 §§1.3.2, 2.1.2, 2.4.2, 10.3.3–10.3.4.1, 10.5.1–10.5.2, 12.3.3 and 12.3.4.3–12.3.4.5 were checked. No Q&A/erratum entry or game-rules defect was found. The source already reduces all three Colorless costs under any supported Subaru Oshi printing, applies Green +50 only against a Green target, and requires exactly one eligible Archive recovery if one exists. Focused website 6/6, current-source Chromium 6/6, exact packaged Android Offline/Firebase 12/12; full website sync 11/11, regression 2,663/2,663, TypeScript and Firebase build; Android host/package 77 files / 524 passed. Logs, URLs, hashes, browser result and matrix update script are under `website/evidence/effect-audit/20260925-batch-61-hbp09-049/` and `android-current/evidence/effect-audit/20260925-batch-61-hbp09-049/`. No rules source or Android bundle changed.

**Matrix after B61:** 1,392 cards, 2,906 printings, 2,468 ability rows, 3,130 clauses; 112 abilities PARTIAL / 2,356 UNVERIFIED; 110 clauses PARTIAL / 3,020 UNVERIFIED; eight shared rules PARTIAL; identities 9 PARTIAL / 1,383 UNVERIFIED; basic actions 4 PARTIAL / 1,388 UNVERIFIED; printings 6 PARTIAL / 1,386 UNVERIFIED; `complete:false`.

**Runtime boundary:** browser checks use current-source `applyAction`, not the full production SimulatorClient UI. Android tests execute the exact packaged JavaScript via Node VM adapters, not Android QuickJS/JNI/WebView on a device. The fresh B61 access check again found no SDK, `adb`, project `local.properties`, or project keystore. Candidate APK build, signing continuity, production browser/device, scanner/camera, image-byte, interaction, save/replay, mutation and stress gates remain open. No release or publishing action occurred.

**Next:** B62 hBP09-050. Verify its exact U/S text and any card-specific Q&A/errata, especially the opponent Collab swap target constraints and source-zone/position changes, on website and both Android package paths. Keep the global audit incomplete and continue all remaining booster, starter, promo, Oshi, Support, identity, scanner and shared-rule rows.

## Batch 62 — hBP09-050 Baelz Subaru Collab and Arts (2026-09-25)

Official Japanese RR/SR/UR card records, Q725, current errata pages 1–3, and Comprehensive Rules v1.9.0 were checked. No rules defect was reproduced. The Collab only runs under a Subaru-named Oshi, swaps an opposing Back Holomem with opposing Collab (or moves it into empty Collab), preserves both units, and does not count as a Collab action or trigger the moved card's Collab Effect. The Arts correctly counts each own top-card Subaru, excludes opponent/covered cards, adds 20 each and the printed Purple +50. Source notes are in `website/evidence/effect-audit/20260925-batch-62-hbp09-050/official-sources.md`.

Website focused tests passed 11/11, Chromium current-source harness 10/10, exact packaged Android Offline/Firebase rules 22/22. Full website suite passed 11 sync and 2,668 regression checks plus TypeScript and Firebase build. Full Android host/package suite passed 77 files / 534 checks. The B62 website full-suite retry log records the result. Android source bundle hashes at that batch are recorded in `android-current/evidence/effect-audit/20260925-batch-62-hbp09-050/sha256.txt`.

**Matrix after B62:** 1,392 card records, 2,906 printings, 2,468 ability rows and 3,130 clauses; 112 abilities PARTIAL / 2,356 UNVERIFIED; 110 clauses PARTIAL / 3,020 UNVERIFIED; eight shared-rule rows PARTIAL; identities 10 PARTIAL / 1,382 UNVERIFIED; basic actions 5 PARTIAL / 1,387 UNVERIFIED; printings 7 PARTIAL / 1,385 UNVERIFIED; `complete:false`.

## Batch 63 — hBP09-051 Towa Arts transfer (2026-09-25)

Official Japanese C/S card records, Q710 on hBP09-051 and Towa Oshi hBP09-005, the three current errata index pages and Comprehensive Rules v1.9.0 §§1.3.2, 5.17.1–5.17.4.2, 10.5.1–10.5.2, 10.7.2.3.4 and 12.3.3.1–12.3.3.1.1 were checked. Q710 confirms the second, different Art still needs its printed Blue plus any-color Cheer.

**Reproduced and repaired:** before the fix, the optional Arts effect opened a Cheer `cardSelection` even if no own Back Holomem had `#歌`; the subsequent destination step had no legal target. This no-op prompt reproduced in website source and both exact Android rule packages. The website and Android-owned hBP09 program now gate the optional transfer on at least one legal own Back `#歌` target. With no target, the ordinary 30 damage resolves without prompting or moving Cheer. With a target, the player can decline, or select one Cheer on Towa and move that same card only to an own Back `#歌` Holomem. Other zones, non-singing Back, and opponent Back are excluded.

**Evidence:** website focused tests 4/4, current-source Chromium harness PASS, Android packaged Offline/PvP cases 4/4 and packaged Q710/Q711/same-Arts regressions 3/3. Full website suite passed 11 sync checks and 2,672 regression checks, TypeScript no-emit and Firebase production build. Full Android host/package suite passed 78 files / 538 checks, with zero failures or skips. Website logs, red reproduction, browser report, official-source notes and matrix recorder are under `website/evidence/effect-audit/20260925-batch-63-hbp09-051/`; Android logs, fresh runtime access and rebuilt rule bundle hashes are under `android-current/evidence/effect-audit/20260925-batch-63-hbp09-051/`.

**Matrix after B63:** 1,392 cards, 2,906 printings, 2,468 ability rows and 3,130 clauses; 113 abilities PARTIAL / 2,355 UNVERIFIED; 111 clauses PARTIAL / 3,019 UNVERIFIED; eight shared rules PARTIAL; identities 11 PARTIAL / 1,381 UNVERIFIED; basic actions 6 PARTIAL / 1,386 UNVERIFIED; printings 8 PARTIAL / 1,384 UNVERIFIED; `complete:false`.

**Runtime boundary:** fresh access check again found no Android SDK, `adb`, project `local.properties`, or project signing key. The full Android suite executes exact packaged JavaScript through Node VM adapters, not the Android app's QuickJS/JNI/WebView or a connected device. Chromium executes the current-source `applyAction` harness, not full production SimulatorClient gameplay. No APK was built or signed; no deployment, publication, merge or release occurred.

**Next:** audit hBP09-052 and its first-player/second-player Collab trigger, exact Cheer recipient and turn window, plus all applicable Q&A/errata. Then continue every remaining hBP09/older printing, starter, promo, Oshi and Support; shared-rule, identity/printing, interaction, save/replay, mutation and seeded-stress gates remain open.
