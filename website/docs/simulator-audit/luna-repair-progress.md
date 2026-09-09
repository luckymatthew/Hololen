# Luna audit engine repair progress

Updated: 2026-09-06
Goal: reconcile all Luna card-text audit findings, repair PvP engine behavior, verify fixes, and update the existing website.
Status: in progress. Not deployed. The 1276-card / 1746-field count is audit coverage, not repaired or fully validated cards.

## Batch 1: two confirmed Arts condition defects repaired

- hBP04-013 arts[0]: generic keyword fallback already performs the deck search. The report's claim that this effect has no implementation is contradicted by execution. Actual reproduced defect: search occurs without an attached #こよラボ support. Added a dedicated guard and reused the existing search/shuffle resolver. Search optionality remains unresolved against authoritative hidden-zone rules; this finding is not fully closed.
- hBP04-014 arts[0]: only grant +50 when at least one on-stage #ゲーマーズ Holomen is not 白上フブキ. Alone, another Fubuki, and an unrelated companion now yield 100; an eligible Gamer yields 150.

## Verification

tests/simulator-luna-repairs.test.mjs: before patch 3 passed / 5 failed; after patch 8 passed / 0 failed.
All tests/simulator-*.test.mjs and tests/oshi-skill-regression.test.mjs: 586 passed, 0 failed.
Raw regression output: luna-repairs-regression.log.
Tests use actual attack and choose actions, including negative attachment conditions, ineligible search targets, no matching card, and continuation to printed damage.

## Accounting and next work

- New behavior defects fixed this batch: 2 across 2 cards; not a claim of complete card verification.
- hBP04-014 reported Arts defect closed; hBP04-013 activation defect fixed, search optionality still requires rule verification.
- Full audit reports have overlapping ranges and unverified findings; total remaining distinct confirmed defects is not yet established.
- Source inventory: luna-report-inventory.json contains all report file names and fingerprints. Read every remaining report and track each finding's disposition; do not count repeated reports or passing test fixture IDs as completed cards.
- Next: verify hidden-zone search rules before changing mandatory/optional choices across the audit reports; continue hBP04-001–014, then all other report ranges. Preserve existing valid fixes.
- Full site build and deployment remain pending completion of repairs.

## Batch 2: archive selections and hidden search rule reconciliation

Source: https://hololive-official-cardgame.com/wp-content/themes/tcg/assets/img/rule/whole_rule_ver190.pdf
Rule 10.7.2.3.1 requires the specified number where possible. Rule 10.7.2.3.5 permits selecting no matching card from an unrevealed hidden zone when selection depends on card information. These are distinct from optional public-zone choices.

- Fixed hBP03-002 normal Oshi and hBP04-002 normal Oshi: mandatory archived Cheer selection after paying the Oshi cost. Correct recipient restrictions preserved.
- New regressions check skipping, zero selections, invalid recipients, successful attachment, paid cost, once-per-turn use, and an empty Cheer archive.
- Added hBP04-013 regression for legally declining a conditional hidden deck search while completing Arts damage.
- Fixture correction: Holo Power uses main-deck cards rather than Cheer, so paying it does not artificially create archived Cheer.
- New tests before repair: 11 pass / 2 fail (after fixture correction). After: 13 pass / 0 fail.
- Full simulator and Oshi regression: 591 pass / 0 fail.

### hBP04-001-014-text-audit.md: seven reported findings reconciled

1. hBP04-002 normal Oshi: confirmed, repaired in batch 2.
2. hBP04-003 SP: reported optional named-card deck searches are allowed by 10.7.2.3.5; do not force selection solely because the printed text specifies one.
3. hBP04-007 normal Oshi: reported optional named-card deck selection is allowed by the same rule. This disposition addresses the reported deck selection, not every downstream attachment behavior.
4. hBP04-009 Arts: private top-three look with characteristic-based selection remains a hidden-zone selection; optional selection is permitted. The report did not establish a public reveal of all three.
5. hBP04-012 Bloom: optional tagged support deck search is permitted.
6. hBP04-013 Arts: activation guard repaired in batch 1; optional tagged support search now confirmed legal and covered by the new decline test.
7. hBP04-014 Arts: confirmed and repaired in batch 1.

Cumulative new behavior repairs: 4 across 4 cards. Report-finding reconciliation: 1 of 93 source reports reconciled, 92 remaining; overlapping reports are still counted as documents, not unique defects or cards. This is not complete card verification.
Full site build and publication remain pending; goal remains active.

## Batch 3: Risuners (hBP03-113)

Reviewed hBP03-101-113-text-audit.md. Its three reported findings are not all closed: hBP03-106 SSRB replacement cost and hBP03-108 Haato豚 die reroll remain pending.

Confirmed actual hBP03-113 failure: generic attachmentArtsBonus treated the printed triggered Arts+10 as an unconditional continuous bonus. The original 8-case probe passed 7 positive cases but failed playing a fan after Cheer; this exposed why a passing positive test alone is insufficient. Also corrected the moved-Cheer test choice name and added checks that the Cheer actually moved.

Repair:
- Exclude Risuners from continuous attachment damage parsing.
- Route every actual Cheer push to a recipient through attachCheerCards (regular step, life, deck/archive effects, and stage transfer). Three source.cheer.push operations are temporary restores/cancelled transfers, intentionally not new attachment events.
- Track once-per-turn use separately on each attached fan instance. Preserve use while moving on stage; clear when newly attached from hand/archive.
- Queue Arts+10 for the recipient, anchored by its bottom stack instance so a new top card or stage movement does not redirect the effect.
- During Arts, queued trigger resolves after the printed damage/completion boundary.
- Earned Arts bonus remains on the Holomen for the turn even if the fan leaves.

Validation:
- tests/simulator-risuners-audit.test.mjs: 14 pass, 0 fail.
- Covers regular/event/life Cheer, archived Cheer, transfer destination/source, multiple fans, repeat Cheer, saved state, next-turn reset/expiry, attaching after existing Cheer, adding a new fan, hand re-entry, stage transfer usage, and Arts timing.
- Some tests seed pending-choice state to isolate an existing public choose resolver; do not treat them as full native card-combination or UI tests.
- Complete simulator/Oshi suite: 605 pass, 0 fail; log refreshed.

Cumulative new card behaviors repaired: 5 across 5 cards. Report status: 1 reconciled, 1 partially reconciled, 91 not yet reconciled (93 total; overlaps retained). There are still 92 documents with pending work. No claim of whole-card/all-card completion. Build and deployment remain pending.
Next: hBP03-106, hBP03-108, then reconcile the other 91 reports; hidden-zone search choices must respect the rule established in batch 2.

## Batch 4: SSRB substitution across native Botan abilities

Official reference: https://hololive-official-cardgame.com/cardlist/?faq=&id=670
Q355/Q356 confirm replacement may pay for the source Botan's back-row Cheer archive even with no back-row Cheer. Q357 excludes payments made by other support cards. Implementation is deliberately scoped to the source Holomen's native abilities, not arbitrary Cheer discards, Oshi costs, or baton costs.

- hBP03-106: added choice between archiving a source-attached SSRB and an eligible actual Cheer; one SSRB replaces one Cheer. Choosing no payment remains legal.
- Integrated current Botan Cheer-archive abilities: hBP03-017 Collab (Cheer deck top -> heal 10 with Botan Oshi); hBP03-019 Bloom (back-row Cheer -> 30 special, named turn limit); hBP03-021 Arts (back-row Cheer -> 40 special with Botan Oshi); hBP05-028 Arts (Botan stage Cheer -> center 30 special).
- Paid consequences use mandatory legal-target selection. Printed Arts damage still resolves if payment is declined.
- Resolve choices against current source/card state; only SSRB attached to the source is eligible, and stale/other-holder choices are rejected.
- Actual Cheer archive triggers and event counters apply only when a real Cheer is archived, not when SSRB is substituted.
- Existing generic fallbacks did not correctly expose all four native cost/remainder paths. Dedicated handlers now also preserve and test ordinary Cheer payment without SSRB.
- hBP03-108 die reroll remains pending; do not mark the entire hBP03-101-113 report complete.

Verification:
tests/simulator-ssrb-audit.test.mjs uses native play/Bloom, Collab, attack, and choose actions for all four abilities.
Initial 14 tests before implementation: 2 pass / 12 fail (includes assertions for the new payment flow).
Final 21 tests: 21 pass / 0 fail, including real payment without fans, decline, empty eligible-Cheer state, source ownership, named Bloom turn limit, stale choice rejection, and JSON save/resume.
Full simulator/Oshi regression: 626 pass / 0 fail; log refreshed.
No deployment/build completion claimed.

Accounting: 6 principal audit-card behaviors now repaired (the prior 5 plus SSRB), with this batch integrating 4 additional Botan card ability paths. This is not a count of fully verified cards. Reports: 1 reconciled, 1 partial, 91 pending. Next required work: hBP03-108 reroll; remaining source reports, full site validation and publication.

## Batch 5: Haato fan rerolls (hBP03-108)

Integrated the two current native Haato dice abilities: hBP03-034 Arts and hBP07-038 Bloom. Current card catalogue inspection found no other native Haato dice abilities.
- Dice results are held until accepted, or the player chooses a specific source-attached Haato fan to archive and roll again.
- Only the final accepted result produces odd/even damage, draw or Arts bonus; fan payments and preceding Bloom/Arts actions are not replayed.
- Multiple fans support sequential rerolls. Decisions and dice metadata survive JSON room serialization.
- Reapply existing die overrides for every new roll. Mark cancelled dice-history entries rather than applying their outcome.
- Restore the printed optional first roll for hBP03-034; skipping deals only the printed 40 Arts.
- Source ownership, stale fan removal and forced results tested.

Validation: original 8 new tests failed before implementation; final 13 pass. Full simulator/Oshi regression: 639 pass / 0 fail.
Tests use native attacks and play/Bloom actions followed by public choose actions. Tests cover odd-to-even, even-to-odd, both native abilities, accepting, optional roll skip, two fan payments, no fan, another holder's fan, stale choice and a forced die value.

Report reconciliation:
- hBP03-101-113-text-audit.md: its three reported issues now repaired (SSRB, Haato fan, Risuners).
- hBP03-113-text-audit.md: duplicate Risuners finding resolved by batch 3.
- hBP03-097-112-text-audit.md: read overlapping report. SSRB and Haato findings resolved; FOUR additional findings remain: hBP03-097 missing 1st+ knockout-draw gate; hBP03-107 optional/per-copy 35P knockout draws; hBP03-109 per-copy Ruffians; hBP03-112 per-copy Watame fan Cheer transfers. These findings contradict some earlier reports' "correct" labels, so they require independent checking.

Cumulative principal audit-card repairs: 7. Report status: 3 reported-issue lists reconciled, 1 partial, 89 pending (93 total). This does not mean all cards in those reports are fully verified.
Next: the four remaining hBP03-097-112 findings, then the remaining report corpus. Full site build and deployment still pending completion of repairs.

## Batch 6: Recorder and individual DOWN fan choices

Reconciled the four remaining reported findings in hBP03-097-112-text-audit.md:
- hBP03-097: knockout draw requires an opposing victim and a 1st/2nd Kanade source.
- hBP03-107: each attached 35P creates its own optional draw for the defeated player's opponent.
- hBP03-109: each Ruffians creates a separate optional blue Cheer selection and mandatory recipient choice.
- hBP03-112: each fan can transfer up to two original yellow Cheer to a single other Watame. Refresh candidates after each completed transfer; do not reuse moved cards.
- Transfer selection/recipient resolution survives JSON serialization; choosing a recipient cannot be skipped after selecting Cheer.

Validation: tests/simulator-fan-knockout-audit.test.mjs 14 pass; complete simulator/Oshi regression 653 pass, 0 fail.
Corrected three new tests whose initial assumption incorrectly suppressed DOWN effects on final-life defeat. Official comprehensive rule 11.3.1.1 resolves DOWN abilities before archiving the defeated Holomen and life damage (11.3.1.2). The final tests verify fan choices finish before defeat.
Reference: https://hololive-official-cardgame.com/wp-content/themes/tcg/assets/img/rule/whole_rule_ver190.pdf

IMPORTANT unresolved shared lifecycle issue: knockOutUnit currently removes the defeated unit and deducts life internally before queued DOWN choices resolve. Current fan-choice sequencing tests do NOT establish correct intermediate stage/archive/life state for all DOWN abilities. Full rule-compliant DOWN lifecycle and controller-selected trigger ordering remain required work, including attached Cheer transfer timing. This batch closes the reported per-copy/gate findings only; it does not establish complete correctness of these cards under every interaction.

Cumulative principal audit-card behavior repairs: 11. Report-finding lists reconciled: 4 of 93; 89 remain. Report reconciliation is not whole-card verification. Full build and website publication remain pending.

## Batch 7: resumed authorized writes; Shion hBP02-047
User explicitly approved modifying the extracted website working copy after the automatic review rejection. Writes now succeed; synced sources remain untouched.

- Bloom now offers the optional die roll. Results 1/2/3 fail; 4/5/6 succeed. On success, eligible opponent Cheer selection and a different recipient are mandatory.
- Arts now snapshots opponent CENTER attached Cheer count x20 and queues the same special damage to both center and collab through queueFixedSpecialDamage. Printed 80 Arts remains separate.
- Tests use native play/Bloom, choose and attack. Six die faces, decline without randomness, mandatory source/recipient, same-recipient rejection, JSON resume, center Cheer counts 0/1/3 with independently populated collab.
- Bloom tests passed after repair; before Arts repair two positive scaling tests failed (80 instead of 100/140). Final 10 pass; full simulator/Oshi suite 663 pass, 0 fail.

New durable card ledger: luna-card-repair-ledger.json. Source issue sections contain 476 unique reported cards. Six cards have all reported findings reconciled: SSRB, Haato fan, Risuners, hSD11-008 and 009 (report function attribution contradicted by native Collab/Bloom probes), and this Shion. Remaining 470 cards pending repair or reconciliation. Other partially repaired cards stay in pending count. This replaces report-document counts as the user-facing progress metric.
hSD13-014/015 Spot observations were not deducted: preserve pending state until relevant exceptional Bloom paths/other findings are reconciled.
Shared DOWN lifecycle issues from batch 6 remain open. Website build/publication pending; objective incomplete.

## Batch 8: hBP02-046 Shion paid recovery and optional Arts
Both overlapping report findings (hBP02-033-048 and hBP02-041-060) reconciled.
- Optional one-hand-card Bloom payment preserved. Once paid, recover exactly one available #魔法 card, with no second decline.
- Dedicated tag-only selection includes both Magic Holomen and Magic supports. The previous generic group inference excluded supports; native test also exposed inability to recover a Magic support just paid to archive.
- No available recovery ends normally; declining payment does not recover.
- Arts now offers a die choice. 5/6 require eligible opponent Cheer transfer; 1/2/3/4 do nothing; declining still deals printed 30 Arts. Reuses the Shion move choice handler with a distinct threshold/source card, preserving 2nd Shion's >=4 Bloom.
- tests/simulator-shion-recovery-audit.test.mjs:12 pass; before recovery fix three of first five failed. Six Arts faces plus decline tested. Recovery verifies both groups, invalid/non-Magic/over-limit rejection and JSON resume.
Full simulator/Oshi regression:675 pass,0 fail. Remaining reported cards:469 of476 (7 resolved reported-card findings). Shared DOWN lifecycle and full website build/publication remain open.

## Batch 9: hBP01-088 Moona optional Arts roll
The sole reported finding for this card is resolved: native attack now offers an optional roll. Even outcomes queue mandatory opponent back-row 20 special damage with loseLife:false; declining or odd outcomes leave printed 10 Arts intact.
tests/simulator-moona-audit.test.mjs:9 pass, covering all six die faces, decline without invoking RNG, mandatory/invalid targets, JSON resume, no back-row candidate and actual special-damage knockout without life loss.
Complete simulator/Oshi suite:684 pass,0 fail.
Reported-card ledger:476 total,8 resolved,468 pending.
Additional inspection candidate (not counted as resolved or confirmed defect): hBP01-023 optional repeat-Arts text appears to use an automatic roll and a generic repeatArts modifier. Needs independent review of target locking/repetition/choice; the Luna finding ledger contains no issue entry for this card. Do not ignore because it was labelled clean by prior audit.
Shared DOWN lifecycle remains unresolved. Full build and deployment pending.

## Batch 10: hBP01-099 optional Collab roll and required swap
Native Collab now offers an optional die roll. Odd result queues mandatory opponent back-row selection and center swap when legal candidates exist; even results/decline do not swap.
tests/simulator-edinburgh-audit.test.mjs:8 pass; all six faces, decline without RNG, illegal center selection, mandatory choice, JSON resume and absent back row. Full simulator/Oshi suite:692 pass,0 fail.
Both source report entries for hBP01-099 describe these same two defects and are reconciled. Remaining reported cards:467 of476 (9 resolved).
hBP01-096 was inspected only: optional roll and hidden-zone Buzz search need separate reconciliation; no modification or completion claimed.
Full engine reconciliation, shared DOWN lifecycle, site build and publication remain open.

## Batch 11: hBP01-096 Adventure optional roll
Replaced generic automatic Collab die evaluation with an explicit optional roll. Even outcomes search only Buzz Holomen using the existing deckToHandShuffle resolver.
Reported optional search finding is rejected under comprehensive rule 10.7.2.3.5: a conditional search of unrevealed hidden-zone cards can choose none even if eligible cards exist. Reference: https://hololive-official-cardgame.com/wp-content/themes/tcg/assets/img/rule/whole_rule_ver190.pdf
tests/simulator-adventure-audit.test.mjs:9 pass. Native Collab covers all die faces, decline without RNG, non-Buzz rejection, chosen Buzz entering hand, JSON resume, and actual changed deck order after selecting, declining, or finding no Buzz.
Full simulator/Oshi suite:701 pass,0 fail.
Remaining reported cards:466 of476 (10 resolved reported cards). This is reported-finding reconciliation, not certification of all cross-card interactions. Shared DOWN lifecycle and full site build/publication remain pending.

## Batch 12: hBP02-053 tagged 2nd stage count
Confirmed native attack incorrectly dealt140 with source2nd plus tagged Debut/1st instead of100. Added a stage-qualified tagged minimum-count guard in artConditionApplies; counts actual top Holomen on stage with both required tag and printed level. Existing unqualified tag checks remain.
tests/simulator-id2-stage-audit.test.mjs: before3 pass/2 fail; after5 pass. Tests tagged Debut/1st rejection, tagged2nd success, stacked-card non-counting and unrelated2nd rejection.
Full simulator/Oshi suite:706 pass,0 fail.
Both report references for hBP02-053 cover this single issue and are reconciled. Report ledger:476 total,11 resolved,465 remaining. Shared DOWN lifecycle, other report cards, build and publishing remain open.

## Batch 13: hBP02-059 cumulative Myth thresholds
Confirmed missing second bonus: native attack with8/9 archived Myth Holomen dealt120 instead of160. Dedicated Arts computation independently adds40 at4 and another40 at8, filtering both Holomen group and Myth tag.
tests/simulator-myth-threshold-audit.test.mjs: before5 pass/2 fail; after7 pass. Boundaries0/3/4/7/8/9 plus irrelevant non-Myth Holomen/tagged support exclusion. Archive is not consumed.
Full simulator/Oshi suite:713 pass,0 fail. Both report findings reconciled. Report ledger:476 total,12 resolved,464 pending. Shared DOWN lifecycle and full website validation/publication still required.

## Batch 14: hBP02-063 Ina mandatory Myth heal
Dedicated Bloom queues mandatory one-own-Myth healing target for20. No damaged-only restriction is printed; full-HP Myth remains selectable and resolves zero healing, with damage clamped to0 per comprehensive rule5.23.1.1. Reference: https://hololive-official-cardgame.com/wp-content/themes/tcg/assets/img/rule/whole_rule_ver190.pdf
tests/simulator-ina-heal-audit.test.mjs:5 pass; native play/Bloom, source damage0/10/20/30, other Myth target, non-Myth and skip rejection, JSON resume and no overheal.
Full simulator/Oshi suite:718 pass,0 fail. Both report references reconciled. Report ledger476 total,13 resolved,463 pending. Remaining engine issues and website build/publication are not complete.

## Batch 15: hBP02-064 separate archive thresholds and transfer target
Dedicated Arts path counts archived Myth Holomen. At5+ offers optional one-source-Cheer transfer to any OTHER own Holomen; no Myth requirement on recipient. At10+ independently adds50 even when the player declines transfer or has no other recipient.
tests/simulator-ina-transfer-audit.test.mjs:8 pass; native Arts thresholds0/4/5/9/10/11, optional decline, wrong-source Cheer rejection, self-recipient rejection, mandatory recipient after choosing Cheer, non-Myth recipient, JSON resume and bonus without a transfer target.
Full simulator/Oshi suite:726 pass,0 fail. Both report entries reconciled. Ledger476 total,14 resolved,462 pending. Shared DOWN lifecycle and website build/publication remain required.

## Batch 16: hBP02-033 Gothic Queen lower-stack counts
Arts parser now recognizes "每有1張重疊在這位Holomen上的Holomen" and adds20 per actual lower Holomen card. Shared perStack count filters Holomen and excludes current top.
Bloom requires3 LOWER Holomen rather than total stack length3; optional archive recovery still resolves before independent mandatory50 special damage.
tests/simulator-gothic-stack-audit.test.mjs:10 pass; native Arts lower counts0/1/2/3 and native Bloom lower counts1/2/3 with both recovery acceptance and decline, mandatory damage and JSON resume.
Complete simulator/Oshi suite:736 pass,0 fail. Both report findings reconciled. Ledger476 total,15 resolved,461 pending. Shared DOWN lifecycle and full website validation/publication remain open.

## Batch 17: hBP02-034 Organic Shot attachment OR condition
Dedicated second-Arts branch accepts a tool OR mascot on the source and requires selecting opponent center/collab for30 special damage. Both attachments together trigger only once. No attachment/fan/another holder's tool do not trigger; printed80 Arts remains.
tests/simulator-organic-shot-audit.test.mjs:7 pass. Native attack and choose use isolated type-only support fixtures so unrelated attachment damage bonuses do not affect the assertion. Both front targets, mandatory/invalid back target and JSON resume covered.
During implementation tests exposed an undefined opponentIndex in the new branch; corrected before final regression.
Full simulator/Oshi suite:743 pass,0 fail. Both report references reconciled. Ledger476 total,16 resolved,460 pending. Remaining engine scope and website validation/publication are incomplete.

## Batch 18: hBP02-036 canonical holoX effect-tag extraction
Shared effectTags now matches known tags case-insensitively and returns the canonical KNOWN_EFFECT_TAGS spelling. Lowercase #秘密結社holox no longer drops the search tag and exposes unrelated2nd cards.
tests/simulator-holox-tag-audit.test.mjs:2 pass. Native Collab top3 includes eligible canonical-tag2nd, tagged1st and wrong-tag2nd; only eligible2nd selectable. Invalid picks rejected; chosen/declined private selection and exact bottom order verified, including JSON resume.
Optional conditional private-look selection retained under rule10.7.2.3.5 established in batches2/11, not treated as a defect.
Full simulator/Oshi suite:745 pass,0 fail. Both report entries reconciled. Ledger476 total,17 resolved,459 remaining. Full engine scope and website build/publication remain unfinished.

## Batch 19: hBP02-038 required unrestricted Cheer selection and order
queueCheerDeckSearch accepts an explicit optional flag (default preserved). This card's native Bloom uses topCount3, optional:false because selection has no extra card-information condition within a Cheer-only deck.
Shared genericCheerTopPick resolution now queues selected Cheer attachment before bottom ordering, matching the printed instruction order. Previously it queued bottom ordering first.
tests/simulator-cheer-top-order-audit.test.mjs:5 pass; native Bloom with0/1/2/3/5 Cheer, mandatory pick/attachment, attachment observable before remainder choice, exact remaining bottom order, no card loss and JSON resume.
Full simulator/Oshi regression:750 pass,0 fail. Both report entries reconciled. Ledger476 total,18 resolved,458 pending. Full engine repair and website build/publication remain open.

## Batch 20: hBP02-045 report reconciliation
No production change required. Report only objects to optional characteristic-based selection from a private top3 look. Under rule10.7.2.3.5 already verified in batches2/11, choosing none is legal.
tests/simulator-shion-top-look-audit.test.mjs:3 pass using native play/Bloom and choose. Both blue and purple Holomen eligible, incorrect-color Holomen rejected, selected/declined paths preserve exact requested bottom ordering and hand contents; JSON resume covered.
Production engine unchanged this batch; latest complete regression remains750 pass from batch19, and the3 added focused tests pass separately.
Both report references reconciled. Ledger476 total,19 resolved,457 pending. Full engine repair and site build/publication remain incomplete.

## Batch 21: hBP02-069/070/071 color-pair Cheer Collabs
All three native Collab abilities now offer optional die choice. Odd results search correct red/blue, white/green, purple/yellow pair and explicitly target own BACK_SLOTS, independent of recipient color. Generic back-row text recognizes 後援.
Characteristic-based unrevealed Cheer-deck selection remains optional under established10.7.2.3.5; after selecting Cheer attachment is mandatory. No-back-recipient resolution preserves all Cheer and shuffles.
Shared genericCheerDeckPick no longer shuffles before attachment and then again after it. Selected path shuffles after attachment; declined path still shuffles.
tests/simulator-magic-pair-cheer-audit.test.mjs:27 pass. All6 faces plus decline for each card, both colors eligible, center/collab rejected, uncolored back recipient allowed, mandatory attachment, exact pre-attachment deck order preservation and post-attachment shuffle, conditional-search decline and no-recipient conservation; JSON resume included.
Full simulator/Oshi suite780 pass,0 fail. All overlapping report findings reconciled. Ledger476 total,22 resolved,454 pending. Shared DOWN lifecycle/other engine repairs and site build/publication remain open.

## Batch 22: hBP02-072/073/074 optional support-search dice
All3 native Collabs offer optional roll. Even outcomes search Event (including Limited Event), Fan or Tool respectively. Conditional hidden-zone search may decline under established10.7.2.3.5; selection/decline both use deck shuffle.
tests/simulator-magic-support-audit.test.mjs:24 pass; every die face and decline for each card, exact allowed type IDs incl Limited Event, mascot rejection, selected and declined searches, actual shuffle order change and JSON resume.
Full simulator/Oshi suite804 pass,0 fail. All report findings reconciled. Ledger476 total,25 resolved,451 pending. Remaining engine issues, shared DOWN lifecycle, full website build/publication remain open.

## Batch 23: hBP02-088 scythe hand-entry condition
Restored printed Calliope and 1st/2nd restrictions to queueAttachmentEntryEffects. Hand-only restriction and unconditional Arts+10 retained. Native attachment tests cover Debut Calliope, 1st Calliope, 2nd Calliope and wrong-name 2nd, with serialization and actual Arts damage. Before repair 2 failed; after repair full simulator/Oshi suite808 pass,0 fail.
Ledger476 reported cards,26 resolved,450 pending. Additional hBP02-093 HP parser finding remains open in checking-resume-2026-09-06.md at workspace root; not included in original476. hBP02-092 passive +50 finding also supplements the existing pending report. Global DOWN lifecycle and website build/publication remain incomplete.

## Batch 24: supplemental hBP02-093 Miteiru HP
attachmentHpBonus recognizes HP增加20 as well as HP+20. Current card inventory has only hBP02-093 using this additional support wording. Native damage tests cover Fubuki and other names surviving110 at baseHP100 and going DOWN at120; prior engine failed both survival cases. Native Moona special Arts checks back-row Fubuki immune and other named holder takes20. Six new tests pass; full simulator/Oshi suite814 pass,0 fail.
Original report ledger unchanged:476 total,26 resolved,450 pending. Supplemental hBP02-093 identified HP finding resolved separately without inflating original report completion count. Global DOWN lifecycle, remaining report repairs and website build/publication still open.

## Batch 25: hBP02-092 Fubura paid main-phase skill
Removed the erroneous continuous Arts+50 parsed from the active ability text. The PvP attachment control now exposes Fubura only on a Fubuki holder with at least two Cheer and when that attachment instance has not used its once-per-turn ability.
The native action archives exactly two actual Cheer from the same holder, permits cancellation before payment, then grants that holder Arts+50 for the current turn. It rejects non-Fubuki holders, insufficient same-holder Cheer and repeat use; unconditional HP+20 remains active.
tests/simulator-fubura-audit.test.mjs:5 pass. Full simulator/Oshi suite819 pass,0 fail. Vinext production build passes with the updated PvP control.
All hBP02-092 report references and the supplemental passive-bonus finding are reconciled. Ledger476 reported cards,27 resolved,449 pending. Shared DOWN lifecycle, other engine repairs and final website publication remain open.

## Batch 26: hBP02-090 Wind-up Fox mandatory knockout transfer
When a Fubuki with Wind-up Fox is knocked out and has both an attached Cheer and another own Holomen, the player must now choose exactly one Cheer. Skip and empty selections are rejected. Non-Fubuki holders, no-Cheer cases and no-recipient cases do not create the transfer.
The selected knockout transfer target is placed ahead of Life attachment in the existing effect queue, so the attachment ability completes before the following Life-card target choice. The unconditional HP+20 remains active.
tests/simulator-windup-fox-audit.test.mjs:3 pass. Full simulator/Oshi suite822 pass,0 fail. All hBP02-090 report references are reconciled.
Ledger476 reported cards,28 resolved,448 pending. The broader DOWN lifecycle still archives the defeated unit and removes Life before its pending abilities; that shared issue remains open for a dedicated refactor. Other engine repairs and final website publication remain open.

## Batch 27: hBP02-084 Mikkorone 24 hidden-deck search reconciliation
No production-engine change. The Luna finding that a successful die result must force a Debut selection is a false positive under current Japanese Comprehensive Rules ver1.9.0 section4.1.2.3: a player may treat a qualifying card in a non-public zone as absent even when one exists.
The existing optional search is therefore correct. Focused native support-play tests cover all six die faces, the initial two-card draw, the extra draw on2/4, optional Debut reveal on3/5/6, selected and declined searches, and shuffle behavior with and without an eligible Debut.
tests/simulator-mikkorone24-audit.test.mjs:9 pass. Full simulator/Oshi suite831 pass,0 fail. All hBP02-084 report references are reconciled.
Ledger476 reported cards,29 resolved,447 pending. Other engine repairs, shared DOWN lifecycle and final website publication remain open.

## Batch 28: hBP02-005 / hBP02-043 / hBP02-087 Shion reroll chain
Added the missing optional Collab roll for hBP02-043. Results1-3 finish without searching; results4-6 offer one eligible #Magic card from the hidden deck, reject unrelated cards and may reveal none under comprehensive rule4.1.2.3. Declining the initial roll does not invoke randomness.
hBP02-005 now opens a reactive window after each implemented Shion ability die from hBP02-043, hBP02-046 or hBP02-047. Paying1 Holo Power cancels the original recorded die and replaces it with exactly one reroll; declining keeps the original result, and a rerolled die cannot recursively reroll itself.
hBP02-087 raises that reactive skill's per-turn limit from one to two only while the tool is attached to a central1st/2nd Shion. Debut and wrong-name holders do not raise the limit. Its printed unconditional Arts+10 remains active.
tests/simulator-shion-reroll-audit.test.mjs:16 pass. Existing Shion suites:22 pass. Full simulator/Oshi suite865 pass,0 fail.
All report references for hBP02-005, hBP02-043 and hBP02-087 are reconciled. Ledger476 reported cards,32 resolved,444 pending. Other engine repairs, shared DOWN lifecycle and final website publication remain open.

## Batch 29: hBP01-008 Kobo reaction, hBP01-012 Kanata Bloom, hBP01-018 Mumei Arts
hBP01-008 now opens the legal optional Rain Shaman Oshi window whenever blue hBP03-045 archives its #ID Cheer through its Bloom ability. After selecting an opponent, the 20-point special damage resolves before hBP03-045's three original 10-point back-row hits. It correctly rejects the window with no Holo Power, after the once-per-turn use, or with another Oshi.
hBP01-012 now gives Kanata's player an optional Bloom die. Results 1-3 offer only Mascot cards from the deck and then attach the chosen card to an own Holomen; results 4-6 finish cleanly. The hidden-deck reveal remains optional under current comprehensive rule 4.1.2.3, even after a successful die result.
hBP01-018 now gives Mumei's player the printed optional top-card reveal. Declining preserves the deck and printed 20 Arts; revealing moves the card to hand and adds 20 only when it has #Promise.
tests/simulator-kobo-kanata-mumei-audit.test.mjs:18 pass. Complete simulator/Oshi regression:865 pass,0 fail. All three report entries are reconciled.
Ledger476 reported cards,35 resolved,441 pending. Other engine repairs, shared DOWN lifecycle and final website publication remain open.

## Batch 30: hBP01-033 / 035 / 036 / 039
Local card text and existing audit only. Added optional dice for 033 and 039, mandatory green healing on odd results for 033, mandatory top Cheer attachment on even results for 039 with Pekora Oshi gate. 036 requires a healing target including full-HP Holomen. 035 Arts now attaches the actual top Cheer with a mandatory recipient when its tool condition holds, avoiding generic search misclassification.
Focused batch: 18 tests pass. Combined simulator/Oshi regression passes (883 tests). Ledger: 476 total, 39 resolved, 437 pending. Full repair and publication remain incomplete.

## Batch 31: mandatory recipients and back damage
hBP01-041 requires center/collab top Cheer attachment. hBP01-050 and 054 require tagged recipients excluding Iroha and Iofi respectively; no recipient preserves the Cheer deck. hBP01-076 and 079 require an opponent back-row target for 10/20 special damage with no Life loss. Local card text drives explicit recipient rules, avoiding generic parser ambiguity.
Focused tests: 7 pass. Combined regression: 890 pass. Ledger: 476 total, 44 resolved, 432 pending. Remaining repairs, shared DOWN lifecycle and publication remain open.

## Batch 32: reconcile eight already implemented Buzz Extra findings
hBP01-027/051/071, hBP05-017/072, hBP06-026, hBP07-045 and hSD12-006 all have the printed Extra loss of 2 and buzzCharacter metadata. Existing printedLifeLoss implementation correctly loses 2 in total. Reports asking for another 2 would contradict the local card text. No production edit needed.
Existing simulator-buzz-life-audit.test.mjs rerun: 193 pass; each named card is included in Arts, special damage and no-Life-loss assertions. Shared Gift reduction and final-Life cases also pass. This closes only reported life amount findings, not the separately tracked DOWN lifecycle ordering issue.
Ledger: 476 total, 52 resolved, 424 pending. Latest complete suite remains 890 pass; no production changes this batch. Full repair and publication remain open.

## Batch 33: optional Arts dice
hBP01-042 second Arts offers an optional die and adds face times 10. hBP01-043 offers three dice and adds 10 for each result of 1, replacing the incorrect sum-of-faces bonus. hBP01-072 offers its optional die only with red Cheer and odd results deal 20 special damage to opposing Collab. Decline never invokes randomness and preserves printed Arts damage.
20 focused tests pass; combined regression 910 pass. Ledger 476 total, 55 resolved, 421 pending. Remaining repairs, shared DOWN lifecycle and publication remain open.

## Batch 34: hBP01-019 / 020 / 026 search reconciliation
No production change. Existing search matches the local printed tag, stage and Buzz restrictions. Native Bloom and Collab verification confirms correct candidates, invalid-pick rejection, one public card entering hand, actual shuffle, empty search and Debut-only Bloom gates. Hidden-deck optionality follows the previously established project interpretation; no external lookup performed.
simulator-first-set-search-batch.test.mjs: 11 pass. Latest full production regression remains 910 pass, with 11 additional focused tests passing. Ledger: 476 total, 58 resolved, 418 pending. Remaining repairs and publication remain open.

## Batch 35: AZKi and Iofi
hBP01-047 heals 40 before offering the optional die, then preserves its optional up-to-three green archived Cheer attachment to the source on odd results. hBP01-055 requires an on-stage ID Holomen whose name is not Iofi for its Arts +50.
11 focused tests pass; combined simulator/Oshi suite 932 pass. Ledger: 476 total, 60 resolved, 416 pending. Remaining repairs, shared DOWN lifecycle and publication remain open.

## Batch 36: hBP01-061 paid special damage
After optional hand payment, the central/collab special-damage target is mandatory. Verified all payment amounts 1-5 against both targets, exact archive/hand changes, 20 damage per payment and preserved printed Arts; declining payment retains hand and deals only printed Arts.
11 focused tests pass; combined regression 943 pass. Ledger: 476 total, 61 resolved, 415 pending. Remaining repairs, shared DOWN lifecycle and publication remain open.

## Batch 37: hBP01-067 archive return
Second Arts snapshots archived Holomen count for +10 each, then requires returning six Holomen (all available if fewer) to the deck and shuffling. Does not count or return Cheer/support cards. Bonus remains based on pre-return count.
Six focused cases cover 0/1/5/6/7/10 archived Holomen, skip/invalid selection rejection, card conservation and shuffle. Full regression 949 pass. Ledger: 476 total, 62 resolved, 414 pending. Remaining repairs and publication remain open.

## Batch 38: hBP01-080 / 081 / 083
080 offers an optional die and requires a back-row knockout target with at least 40 damage after an odd result, without Life loss. 081 requires a blue Holomen for top Cheer attachment. 083 requires an ID center before offering the optional die, and results 3-6 require top Cheer attachment.
16 focused tests pass; combined regression 965 pass. Ledger: 476 total, 65 resolved, 411 pending. Remaining repairs, shared DOWN lifecycle and publication remain open.

## Batch 39: hBP01-092 / 110 Cheer choices
Kronii optionally selects its own Cheer and must transfer it to another Promise Holomen. Source and unrelated recipients are excluded. Mumei's replacement effect preserves mandatory selection for the second central Cheer, removing all available if fewer than two.
Six focused tests pass. Full regression 971 pass. Ledger 476 total, 67 resolved, 409 pending. Remaining repairs, shared DOWN lifecycle and publication remain open.

## Batch 40: hBP01-090 / 094 Cheer searches
090 no longer mistakes searched green/blue Cheer colors for recipient restrictions; any own Holomen can receive the selected Cheer. Shared same-color search no longer treats an empty qualifying color set as unrestricted, fixing 094's reported fallback. Promise-only recipient and exact searched colors verified. Established hidden-deck optionality retained without external lookup.
Five focused tests pass; full regression 976 pass. Ledger 476 total, 69 resolved, 407 pending. Remaining repairs and publication remain open.

## Batch 41: hBP01-091 paid back damage
Existing source-only green/blue Cheer payment is valid; corrected its resulting back-row 30 special damage to require a target. Three focused tests verify both eligible colors, wrong color/holder rejection, mandatory target and optional cost decline. Existing card-specific Buzz life tests cover reported Extra loss of two.
Full regression 979 pass. Ledger 476 total, 70 resolved, 406 pending. Remaining repairs, shared DOWN lifecycle and publication remain open.

## Batch 42: hBP01-115 microphone
Requires a 1st/2nd Suisei holder defeating an opposing Holomen and makes top Cheer attachment mandatory. Local text contains no Arts-only restriction, so legal special-damage knockouts remain supported; report's proposed Arts-only gate rejected on local text.
Six focused tests cover Debut/1st/2nd/wrong-name holders, mandatory attachment, special damage and own-victim rejection. Full regression 985 pass. Ledger 476 total, 71 resolved, 405 pending. Remaining repairs and publication remain open.

## Batch 43: hBP01-103 / 104 / 105 support search reconciliation
Existing Power costs, non-Buzz stage/oshi-color search, Debut placement, stage-color Cheer search and required selected-Cheer attachment pass native action checks. Previously established hidden-zone optionality retained; no production change or external lookup.
Eight focused tests pass. Latest full regression remains 985 pass with eight added tests passing separately. Ledger 476 total, 74 resolved, 402 pending. Remaining repairs and publication remain open.

## Batch 44: hBP01-059 / 063 paid search reconciliation
Existing optional hand cost, non-Buzz 1st search, Mascot search and Bird-center requirement all pass native action checks. Paid hidden search can reveal none under the previously established interpretation, without refunding payment. No production changes or external lookup.
Seven focused tests pass. Latest full regression remains 985 pass, with 15 additional tests passing across batches 43-44. Ledger 476 total, 76 resolved, 400 pending. Remaining repairs and publication remain open.

## Batch 45: hBP01-070 local-text correction
Current local Arts text explicitly says the holder must have no Za-in. Reversed the legacy presence gate and its contradictory test to match the user's local-text authority. Fan search validates exact candidate type and selected/declined paths; established hidden-zone interpretation retained.
Full regression 1002 pass. Ledger 476 total, 77 resolved, 399 pending. hBP01-065 remains pending. Remaining repairs and publication remain open.

## Batch 46: hBP01-065 top-three reconciliation
Six native Bloom tests pass: exact Holomen eligibility, selected-card transfer, all remaining looked-at cards archived, hidden selection decline, no candidates and decks of size 0-2. Established hidden-zone optionality retained; no production change or external lookup.
Latest full regression remains 1002 pass, with six additional focused tests passing separately. Ledger 476 total, 78 resolved, 398 pending. Remaining repairs and publication remain open.

## Batch 47: hBP01-119 / 122 / 124 mandatory attachment effects
Removed optional skipping from Jobs healing, Rose Knights top-Cheer attachment and Pioneers defeated-holder Cheer transfer. Three native action tests verify skip rejection and resulting healing/attachment. Shared DOWN lifecycle remains tracked separately.
Full regression 1011 pass, zero failures. Ledger 476 total, 81 resolved, 395 pending. Remaining repairs and publication remain open.

## Batch 48: hBP02-007 Sampling payment and recovery
Removed pre-payment archive requirement. Recovery candidates now include paid hand cards, returning exactly two EN Holomen is optional, and fewer than two candidates completes without throwing or undoing payment. Four native tests cover recovery, decline, exact count and zero/one candidate.
Full regression 1015 pass, zero failures. Ledger 476 total, 82 resolved, 394 pending. Remaining repairs and publication remain open.

## Batch 49: hBP02-001 opponent-only knockout trigger
Fubukingdom now requires an opposing victim. Seven native tests cover own/opposing knockout with one/two/four Mascots, correct dice count and normal skill Mascot-only search. Established hidden-deck search optionality retained; no external lookup. Shared DOWN lifecycle remains separately open.
Full regression 1022 pass, zero failures. Ledger 476 total, 83 resolved, 393 pending. Remaining repairs and publication remain open.

## Batch 50: hBP02-011 / 016 Bloom searches
Normalized the translated Fubuki character tag and prevented its name from imposing a white-color restriction. Native tests initially exposed the unintended color filter, then passed after repair. Noel third-generation stage search reconciled. Established hidden-deck optionality retained.
Four focused tests pass; full regression 1026 pass, zero failures. Ledger 476 total, 85 resolved, 391 pending. Remaining repairs and publication remain open.

## Batch 51: hBP02-017 other-third-generation Arts bonus
Second Arts now counts other third-generation stage members only from collab, +20 each capped at four. Eight native tests cover center/collab and zero/one/four/five other members. Existing all-Buzz knockout regression covers printed Life loss of two; no additional two is owed. Shared DOWN lifecycle remains separate.
Full regression 1034 pass, zero failures. Ledger 476 total, 86 resolved, 390 pending. Remaining repairs and publication remain open.

## Batch 52: hBP02-012 legal Mascot transfer
Generic transfer now filters recipients through attachmentTargets after removing the moving card, and revalidates on receipt. This applies printed attachment restrictions and capacity rules. Four native tests cover occupied ordinary recipients and hBP02-013's two-distinct-Mascot exception.
Full regression 1038 pass, zero failures. Ledger 476 total, 87 resolved, 389 pending. Remaining repairs and publication remain open.

## Batch 53: hBP02-023 / 026 Cheer searches
Mio now sends searched Cheer to any own Holomen while preserving Gamers-derived search colors. Prior shared same-color empty-set fix applies. Reine search reconciled. Four native tests validate candidates, mandatory selected-Cheer recipient and declined search shuffle; established hidden-zone optionality retained.
Full regression 1042 pass, zero failures. Ledger 476 total, 89 resolved, 387 pending. Remaining repairs and publication remain open.

## Batch 54: hBP02-027 optional Tarot archive
Dedicated optional choice replaces automatic top-deck archive and excludes duplicate generic cost processing. Holomen grants +20, support +50, other cards zero; declining retains top card. Six native tests pass. Existing all-Buzz Life tests reconcile Extra; shared DOWN lifecycle remains open.
Full regression 1048 pass, zero failures. Ledger 476 total, 90 resolved, 386 pending. Remaining repairs and publication remain open.

## Batch 55: hBP02-022 / 032 named search reconciliation
Five native tests verify exact Tatang/Marine selection, declined-search shuffle and Marine's shared once-per-turn limit after declining. Established hidden-deck optionality retained; no production changes.
Latest full regression remains 1048 pass, with five additional focused tests passing separately. Ledger 476 total, 92 resolved, 384 pending. Remaining repairs and publication remain open.

## Batch 56: hBP02-039 optional holoX Slot reveal
Added the printed optional top-three reveal before changing the deck. Accepted reveal grants +20 per Holomen and retains the existing optional support Gift and remainder archiving. Three native tests verify declined reveal and both Gift choices.
Full regression 1056 pass, zero failures. Ledger 476 total, 93 resolved, 383 pending. Remaining repairs and publication remain open.

## Batch 57: hBP02-040 optional reveal and Gift usage
Second holoX Slot now uses the optional reveal continuation. Gift usage is marked at reveal, including failed stage matches, while declined reveal preserves the use. Its cards all archive and cannot use the other card's support recovery.
Two focused tests pass; full regression 1058 pass, zero failures. Ledger 476 total, 94 resolved, 382 pending. Remaining repairs and publication remain open.

## Batch 58: hBP02-067 top-three reconciliation
Two native tests confirm song Holomen eligibility, rejection of unrelated cards and chosen bottom ordering after selecting or declining. Established hidden-zone optionality retained; no production changes.
Latest full regression remains 1058 pass, with two additional focused tests passing separately. Ledger 476 total, 95 resolved, 381 pending. Remaining repairs and publication remain open.

## Batch 59: hBP02-076 custom computer
Added the printed public reveal of the paid Debut before its bottom-deck movement. Two native tests verify mandatory payment, exact same-name non-Buzz 1st search and retained payment on decline. Established hidden-deck optionality retained.
Full regression 1062 pass, zero failures. Ledger 476 total, 96 resolved, 380 pending. Remaining repairs and publication remain open.

## Batch 60: hBP02-102 partial zero-damage repair
Raw zero Arts/special damage no longer archives the fan; four focused tests cover zero/positive amounts. Reduction-to-zero, immunity and reaction ordering remain unresolved, so this card remains pending and the completed count is unchanged.
Full regression 1066 pass, zero failures. Ledger 476 total, 96 resolved, 380 pending. Remaining repairs and publication remain open.

## Batch 61: hBP02-102 final damage ordering
Moved mandatory fan archiving out of the preliminary reaction stage to immediately before applying positive final damage, after all prevention. Zero damage and immunity retain fans; partial reduction archives all copies. Ten focused Arts/special tests pass.
Full regression 1072 pass, zero failures. Ledger 476 total, 97 resolved, 379 pending. Remaining repairs and publication remain open.

## Batch 62: hBP03-008 Risu own-turn trigger
Removed unprinted opponent-turn restriction from ID1-generation knockout response. Two native tests verify both turn directions, two-Power payment, one-card draw and turn usage marker. Shared DOWN lifecycle remains separately open.
Full regression 1074 pass, zero failures. Ledger 476 total, 98 resolved, 378 pending. Remaining repairs and publication remain open.

## Batch 63: hBP03-002 poi reconciliation
Current code already requires both archive Cheer selection and recipient. Native action verifies Cheer-only candidates, back-row Botan restriction, skip rejection, payment and transfer. No production change.
Latest full regression remains 1074 pass, with one added focused test passing separately. Ledger 476 total, 99 resolved, 377 pending. Remaining repairs and publication remain open.

## Batch 64: hBP03-003 optional dice and required recovery
Added printed optional roll, then mandatory exact-name 35P recovery: two on 3/5 and one otherwise. Seven tests verify six faces and declining the roll without refunding skill cost.
Full regression 1082 pass, zero failures. Ledger 476 total, 100 resolved, 376 pending. Remaining repairs and publication remain open.

## Batch 65: hBP03-001 / 007 search reconciliation
Four native tests verify computer-item and fan-only candidates, power payment, selected transfer and declined-search shuffle. Established hidden-deck optionality retained; no production change.
Latest full regression remains 1082 pass, with four additional focused tests passing separately. Ledger 476 total, 102 resolved, 374 pending. Remaining repairs and publication remain open.

## Batch 66: hBP03-013 mandatory Lunaite attachment
Dedicated Arts path requires one archived Lunaite and targets only own Luna. Native action verifies exact candidate, skip rejection, wrong-name rejection and attachment conservation.
Full regression 1087 pass, zero failures. Ledger 476 total, 103 resolved, 373 pending. Remaining repairs and publication remain open.

## Batch 67: hBP03-009 printed optional search
Local text explicitly says the search is optional, contrary to the report. Three native tests verify stage-wide absence of Lunaite, declined search and successful named search/attachment. No production change.
Latest full regression remains 1087 pass, with three additional focused tests passing separately. Ledger 476 total, 104 resolved, 372 pending. Remaining repairs and publication remain open.

## Batch 68: hBP03-020 required back-row Cheer
Botan Bloom uses the required top-Cheer target path, restricted to back-row Botan. Two native tests verify skip/front rejection, successful attachment and untouched Cheer deck when no recipient exists.
Full regression 1092 pass, zero failures. Ledger 476 total, 105 resolved, 371 pending. Remaining repairs and publication remain open.

## Batch 69: hBP03-017 paid healing
Healing is required after optional top-Cheer archive payment. Native tests verify payment followed by 10 healing and skip rejection, plus declined payment retaining the Cheer and damage.
Full regression 1094 pass, zero failures. Ledger 476 total, 106 resolved, 370 pending. Remaining repairs and publication remain open.

## Batch 70: hBP03-022 all tool holders heal
Dedicated Arts handling requires Aki Oshi and heals every own tool holder 10, without requiring a tool on the attacker. Two native tests verify multiple recipients, heal cap, non-tool/opponent exclusion and Oshi gate.
Full regression 1096 pass, zero failures. Ledger 476 total, 107 resolved, 369 pending. Remaining repairs and publication remain open.

## Batch 71: hBP03-023 optional fan-search roll
Added optional Collab dice before generic automatic rolling; even results search only fans. Seven native tests cover all faces and declined roll, accounting for normal Collab Power. Established hidden-search optionality retained.
Full regression 1103 pass, zero failures. Ledger 476 total, 108 resolved, 368 pending. Remaining repairs and publication remain open.

## Batch 72: hBP03-024 partial Arts repair
Dedicated Arts calculation counts non-green effective Cheer and grants +50 only at two or more. Four native tests verify zero/one/two/three qualifying Cheer. Bloom's two named recipients remain pending, so the card is not closed.
Full regression 1107 pass, zero failures. Ledger unchanged: 476 total, 108 resolved, 368 pending. Remaining repairs and publication remain open.

## Batch 73: hBP03-024 two named recipients
Bloom resolves optional one-Cheer attachment for Iroha and Suisei separately, refreshing archive candidates after each attachment. Native test confirms both receive one distinct Cheer. Together with batch 72 Arts threshold repair, reported findings are resolved.
Full regression 1108 pass, zero failures. Ledger 476 total, 109 resolved, 367 pending. Remaining repairs and publication remain open.

## Batch 74: hBP03-021 partial Bloom repair
Bloom now selects up to two green archived Cheer and attaches one per distinct back-row Shooter, without requiring green recipients. Native test proves two non-green Shooters receive separate green Cheer and duplicate recipient is rejected. Arts cost/special-damage finding remains pending.
Full regression 1109 pass, zero failures. Ledger unchanged: 476 total, 109 resolved, 367 pending. Remaining repairs and publication remain open.

## Batch 75: hBP03-021 Arts reconciliation
Existing SSRB-compatible payment handler already covers the printed Arts. Two additional native tests verify Oshi gate, real back Cheer payment and 40 special damage to collab. Retained that handler after regression exposed incompatibility in a replacement. Together with batch 74 Bloom repair, findings resolved.
Full regression 1111 pass. Ledger 476 total, 110 resolved, 366 pending. Remaining repairs and publication remain open.

## Batch 76: hBP03-030 attached 35P scaling
Arts now gains +20 per 35P attached to the attacker. Three native tests cover zero/one/three fans, excluding other fan names and other holders.
Full regression 1114 pass. Ledger 476 total, 111 resolved, 365 pending. Remaining repairs and publication remain open.

## Batch 77: hBP03-026 optional meeting roll
Collab offers optional dice before resolving draw and center special damage. Seven tests verify six faces and decline.
Full regression 1121 pass. Ledger 476 total, 112 resolved, 364 pending. Remaining repairs and publication remain open.

## Batch 78: hBP03-028 optional Arts dice
Arts dice is optional. Six faces and decline tested: even center 20 special, 3/5 both front zones 20, 1/decline no special damage.
Full regression 1128 pass. Ledger 476 total, 113 resolved, 363 pending. Remaining repairs and publication remain open.

## Batch 79: hBP03-029 named-search reconciliation
Two native tests verify exact 35P candidates, unrelated fan rejection and selected/declined outcomes. Established hidden-deck optionality retained; no production change.
Latest full regression remains 1128 pass, with two added focused tests passing separately. Ledger 476 total, 114 resolved, 362 pending. Remaining repairs and publication remain open.

## Batch 80: tool damage and Debut Bloom search
Repaired hBP03-033 tool-only enhanced special damage and hBP03-038 missing Debut-to-Bloom first-stage Fuwawa search. Local audit and card text only; no external sources. Five added regressions pass; full simulator regression 1135 pass. Ledger: 476 reported, 116 resolved, 360 pending. Remaining repairs and publication remain open.

## Batch 81: Towa two-part Arts
Repaired hBP03-052 unconditional center special damage and optional opposing center/collab tool archive with Towa Oshi gate. Archived tools return to their owner's archive. Four added tests; full regression 1139 pass. Ledger: 476 reported, 117 resolved, 359 pending. Remaining repairs and publication remain open.

## Batch 82: Towa damage conditions
Repaired hBP03-055 back-row song requirement and hBP03-056 mandatory first-Arts special damage. Five added tests; full regression 1144 pass. Ledger: 476 reported, 119 resolved, 357 pending. hBP03-054 remains pending including its separate cost finding. Remaining repairs and publication remain open.

## Batch 83: Towa mandatory damage and cost
Repaired both reported hBP03-054 findings: mandatory front target and mandatory initial four-purple-Cheer payment. Other cards retain existing cost optionality. Three native tests; full regression 1147 pass. Ledger: 476 reported, 120 resolved, 356 pending. Remaining repairs and publication remain open.

## Batch 84: existing Haato fix reconciliation
Verified hBP03-034 optional Arts dice was already repaired through shared Haato flow. Existing 13-test native suite passes, including decline with no roll and correct odd/even results. No production changes. Latest full regression remains 1147 pass. Ledger: 476 reported, 121 resolved, 355 pending. Remaining repairs and publication remain open.

## Batch 85: FUWAMOCO Arts condition
Added explicit FUWAMOCO Oshi requirement to hBP03-043 second-Arts cost branch. Two native tests verify transfer and extra damage only with correct Oshi. Full regression 1149 pass. Ledger: 476 reported, 122 resolved, 354 pending. hBP03-035 remains pending. Remaining repairs and publication remain open.

## Batch 86: Challenger payment and draw
Repaired hBP03-035 with exact two-card optional payment, Lui Oshi gate and single draw-three completion. Four native tests cover payment, decline, wrong Oshi and insufficient hand. Full regression 1153 pass. Ledger: 476 reported, 123 resolved, 353 pending. Remaining repairs and publication remain open.

## Batch 87: ReGLOSS Cheer recipient
Repaired hBP03-048 second-Arts recipient parsing to own back-row ReGLOSS. Two native tests; full regression 1155 pass. Ledger: 476 reported, 124 resolved, 352 pending. Remaining repairs and publication remain open.

## Batch 88: Watame attached-fan condition
Repaired hBP03-068 combined yellow-member and attached-Watamate gate. Three native tests; full regression 1158 pass. Ledger: 476 reported, 125 resolved, 351 pending. Remaining repairs and publication remain open.

## Batch 89: Korone DOWN Cheer
Repaired hBP03-066 mandatory top-Cheer attachment and removed unprinted opponent-turn gate. Two native tests pass; full regression 1160 pass. Ledger: 476 reported, 126 resolved, 350 pending. Shared DOWN lifecycle ordering remains open; this closes the card-specific reported optionality finding. Remaining repairs and publication remain open.

## Batch 90: independent companion bonuses
Repaired hBP03-074 so Moona-only stage receives its printed +10 independently of Iofi. Four native combinations pass; full regression 1164 pass. Ledger: 476 reported, 127 resolved, 349 pending. Remaining repairs and publication remain open.

## Batch 91: Watame required top Cheer
Repaired hBP03-070 mandatory own back-row Watame top-Cheer attachment. Three native tests; full regression 1167 pass. Ledger: 476 reported, 128 resolved, 348 pending. Remaining repairs and publication remain open.

## Batch 92: Night Fever paired Arts buffs
Repaired hBP03-072 source and collab turn-long +100 with center/six-Cheer gate. Three native threshold tests; full regression 1170 pass. Ledger: 476 reported, 129 resolved, 347 pending. Remaining repairs and publication remain open.

## Batch 93: Risu Cheer recipient
Repaired hBP03-076 recipient rule to any own member; native green/yellow tests confirm red excluded and colorless recipient accepted. Hidden-search optionality retained under established project interpretation. Full regression 1172 pass. Ledger: 476 reported, 130 resolved, 346 pending. Remaining repairs and publication remain open.

## Batch 94: Risu transfer and independent colors
Repaired both hBP03-078 findings: Bloom ID1-source Cheer transfer to another member and independent green/blue +50 Arts bonuses. Five native tests; full regression 1177 pass. Ledger: 476 reported, 131 resolved, 345 pending. Remaining repairs and publication remain open.

## Batch 95: printed optional stage transfer
Reconciled hBP03-082 audit against current local text explicitly allowing optional transfer. Three added native tests pass for 0/1/2 transferred Cheer; no production edit. Latest full regression 1177 pass plus these three focused tests. Ledger: 476 reported, 132 resolved, 344 pending. Remaining repairs and publication remain open.

## Batch 96: Buzz extra reconciliation
Verified hBP03-083 Buzz classification activates existing two-life DOWN handling. Two native tests pass, including no-life-loss effect exemption. No production edit. Latest full regression remains 1177 pass plus five focused tests added in batches 95 and 96. Ledger: 476 reported, 133 resolved, 343 pending. Shared DOWN lifecycle ordering and publication remain open.

## Batch 97: stage-restricted tool HP
Repaired hBP03-095 HP +30 stage restriction. Four native stage-boundary tests; full regression 1186 pass. Ledger: 476 reported, 134 resolved, 342 pending. Remaining repairs and publication remain open.

## Batch 98: recorder stage reconciliation
Verified hBP03-097 existing repair restricts knockout draw to 1st/2nd Kanade. Existing stage tests cover Debut rejection and evolved acceptance; all 14 fan-knockout tests pass. No production edit. Latest full regression remains 1186 pass. Ledger: 476 reported, 135 resolved, 341 pending. Remaining repairs and publication remain open.

## Batch 99: per-copy fan reconciliation
Verified existing fixes for hBP03-107/109/112: optional opponent 35P draw per copy and independently queued fan transfers using fresh remaining candidates. Existing 14-test suite passes. No production changes. Latest full regression remains 1186 pass. Ledger: 476 reported, 138 resolved, 338 pending. Shared DOWN lifecycle ordering, remaining repairs and publication remain open.

## Batch 100: Raden mandatory Cheer reconciliation
Verified existing hBP04-002 mandatory archive-Cheer fix with native Oshi payment and ReGLOSS target test. No production edit. Latest full regression 1186 pass plus one focused test. Ledger: 476 reported, 139 resolved, 337 pending. Remaining repairs and publication remain open.

## Batch 101: Justice stage-count gate
Repaired hBP04-016 at-most-five stage member condition. Two native boundary tests; full regression 1189 pass. Ledger: 476 reported, 140 resolved, 336 pending. Remaining repairs and publication remain open.

## Batch 102: Raden conditional heal
Repaired hBP04-021 mushroom-event condition and mandatory ReGLOSS recipient. Two native tests; full regression 1191 pass. Ledger: 476 reported, 141 resolved, 335 pending. Remaining repairs and publication remain open.

## Batch 103: HOLORO mandatory Cheer
Repaired hBP04-027 mandatory named top-Cheer recipient. Three native tests; full regression 1194 pass. Ledger: 476 reported, 142 resolved, 334 pending. Remaining repairs and publication remain open.

## Batch 104: current-turn meal condition
Repaired hBP04-033 second-Arts current-turn meal requirement. Three native timing tests; full regression 1197 pass. Ledger: 476 reported, 143 resolved, 333 pending. Remaining repairs and publication remain open.

## Batch 105: Lamy attached-fan recipient
Repaired hBP04-048 mandatory top-Cheer recipient with combined Lamy name and Yukimin attachment. Two native tests; full regression 1199 pass. Ledger: 476 reported, 144 resolved, 332 pending. Remaining repairs and publication remain open.

## Batch 106: Buzz knockout reconciliation
Verified hBP04-042 existing Buzz two-life knockout handling. Two native tests pass including no-life-loss exemption. No production edit. Latest full regression remains 1199 pass plus two focused tests. Ledger: 476 reported, 145 resolved, 331 pending. Shared DOWN lifecycle ordering, remaining repairs and publication remain open.

## Batch 107: Jailbreak mandatory damage
Repaired hBP04-052 mandatory back target and printed no-life-loss exception; native knockout test exposed incorrect generic life parsing. Full regression 1202 pass. Ledger: 476 reported, 146 resolved, 330 pending. Remaining repairs and publication remain open.

## Batch 108: Laplus optional triple roll
Repaired hBP04-058 optionality and duplicate generic dice/damage. Three native tests; full regression 1205 pass. Ledger: 476 reported, 147 resolved, 329 pending. Remaining repairs and publication remain open.

## Batch 109: Laplus single roll and rest
Repaired hBP04-055 optional roll, mandatory rest target and duplicate generic resolution. Seven native cases; full regression 1212 pass. Ledger: 476 reported, 148 resolved, 328 pending. Remaining repairs and publication remain open.

## Batch 110: holoX gathering dice
Repaired hBP04-057 optional single roll and mandatory parity-based archive return. Three native cases; full regression 1215 pass. Ledger: 476 reported, 149 resolved, 327 pending. Remaining repairs and publication remain open.

## Batch 111: Dark Bloom dice accounting
Repaired hBP04-059 duplicate Bloom tail and verified subsequent Arts uses actual paid dice count. Two native tests; full regression 1217 pass. Ledger: 476 reported, 150 resolved, 326 pending. Remaining repairs and publication remain open.

## Batch 112: HOLORO soul count
Repaired hBP04-061 count of other own ID2 second-stage members. Three native cases; full regression 1220 pass. Ledger: 476 reported, 151 resolved, 325 pending. Remaining repairs and publication remain open.

## Batch 113: streaming special damage
Repaired hBP04-060 center-Cheer-scaled special damage to both front positions; reconciled Buzz life extra with native tests. Five added tests; full regression 1225 pass. Ledger: 476 reported, 152 resolved, 324 pending. Remaining repairs and publication remain open.

## Batch 114: Last Cup archive destination
Repaired hBP04-062 selected-card archive destination and top remainder; verified existing Buzz life rule. Four native tests; full regression 1229 pass. Ledger: 476 reported, 153 resolved, 323 pending. Remaining repairs and publication remain open.

## Batch 115: whole-hand Bloom draw
Repaired hBP04-066 extra generic draw before whole-hand decision. Two native cases; full regression 1231 pass. Ledger: 476 reported, 154 resolved, 322 pending. Remaining repairs and publication remain open.

## Batch 116: Subaru self Cheer
Repaired hBP04-071 mandatory source-only top-Cheer attachment. Two native tests; full regression 1233 pass. Ledger: 476 reported, 155 resolved, 321 pending. Remaining repairs and publication remain open.

## Batch 117: garden stack recovery
Repaired hBP04-077 mandatory stack recovery. Two native tests; full regression 1235 pass. Ledger: 476 reported, 156 resolved, 320 pending. Shared DOWN lifecycle, remaining repairs and publication remain open.

## Batch 118: paid draw and archive-red gate
Repaired hBP04-065 duplicate Bloom draw and archive-red Arts condition. Two native integrated cases; full regression 1237 pass. Ledger: 476 reported, 157 resolved, 319 pending. Remaining repairs and publication remain open.

## Batch 119: capped archive Cheer bonus
Repaired hBP04-086 capped own-archive Cheer count. Four native tests; full regression 1241 pass. Ledger: 476 reported, 158 resolved, 318 pending. Remaining repairs and publication remain open.

## Batch 120: Matsuri duplicate resolution partial repair
Stopped hBP04-082 generic Bloom tail after dedicated unique-name dice and Cheer attachment. Two native tests verify same-name deduplication, exact dice count, no unintended main-deck draw and correct success attachment. Full regression 1243 pass. Card remains pending: current local text permits optional dice, which still needs implementation. Ledger unchanged: 476 reported, 158 resolved, 318 pending. Remaining repairs and publication remain open.

## Batch 121: complete Matsuri optional dice
Completed hBP04-082 optional dice count selection after batch120 duplicate-tail fix. Three native skip/fail/success cases; full regression 1244 pass. Ledger: 476 reported, 159 resolved, 317 pending. Remaining repairs and publication remain open.

## Batch 122: Noel collab condition
Repaired hBP05-012 third-generation collab requirement. Four native cases; full regression 1248 pass. Ledger: 476 reported, 160 resolved, 316 pending. Remaining repairs and publication remain open.

## Batch 123: Pekora optional draw roll
Repaired hBP05-014 optional dice choice and even-result draw. Seven native cases; full regression 1255 pass. Ledger: 476 reported, 161 resolved, 315 pending. Remaining repairs and publication remain open.

## Batch 124: Pekora carrot Cheer
Repaired hBP05-015 mandatory self-Cheer and verified third-generation count threshold. Three native cases; full regression 1258 pass. Ledger: 476 reported, 162 resolved, 314 pending. Remaining repairs and publication remain open.

## Batch125 — hBP05-023
Fixed stage cheer groups-of-three Arts bonus, requiring center and Iofi Oshi. 11 focused tests passed; full regression 1269 passed. Reported findings resolved: 163/476; pending 313. Website publishing and shared DOWN lifecycle remain pending.


## Batch126 — hBP05-020 / hBP05-030
Fixed mandatory second-player first-turn ID1 cheer attachment and center-only fan Arts bonus. Eight focused tests and full 1277-test regression passed. Resolved 165/476; pending 311. Publishing and shared DOWN lifecycle remain pending.


## Batch127 — hBP05-019
Healing parser recognizes 恢復30點HP. After optional source cheer payment, ID1 healing target is mandatory. Paid and declined branches passed; full 1279-test suite passed. Resolved 166/476; pending 310. Next inspected hBP05-027 attachment cost rule incorrectly includes holomem group. Website publishing and shared DOWN lifecycle remain pending.


## Batch128 — hBP05-027
Fixed own tool attachment payment and mandatory paid Holomen/tool search. Native bloom paid/declined tests passed; full regression 1281 passed. Resolved 167/476; remaining 309. Publishing and shared DOWN lifecycle remain pending.


## Batch129 — hBP05-017 / hBP05-029
Raden Arts stage gate and mandatory mushroom Event search fixed; both reported Buzz Extra findings reconciled with native life-enabled/disabled KO tests. Nine focused tests, full 1290 passed. Resolved 168/476; pending 308. hBP05-017 was already resolved in Batch32 and is not counted again. Shared DOWN lifecycle and publishing remain pending.



## Batch130 — hBP05-024 / hBP05-032
Fixed mandatory AZKi top cheer and mandatory Polka special damage after hand payment. Buzz life finding reconciled. Six focused tests; full regression 1296 passed. Resolved 170/476; pending 306. Publishing and shared DOWN lifecycle remain pending.


## Batch131 — hBP05-039 / hBP05-047
Fixed meal timing and simultaneous front special damage; required opponent back damage selection. Seven focused tests; full regression 1303 passed. Resolved 172/476; pending 304. Shared DOWN lifecycle and publishing remain pending.


## Batch132 — hBP05-038
Added Fuwawa center conditional colorless Arts reduction. Three native attack tests and full 1306-test suite passed. Resolved 173/476; pending 303. Publishing and shared DOWN lifecycle remain pending.


## Batch133 — hBP05-042 / hBP05-046
Fixed mandatory keyword searches with timing and target filters. Four focused tests, full regression 1310 passed. Resolved 175/476; pending 301. Publishing and shared DOWN lifecycle remain pending.


## Batch134 — hBP05-059 / hBP05-060
Fixed Oshi draw gate, required named support search and paid front damage. Five focused tests; full 1315-test regression passed. Resolved 177/476; pending 299. Publishing and shared DOWN lifecycle remain pending.


## Batch135 — hBP05-049
Fixed summed opponent back damage gate and explicit blue archive cheer/Kobo recipient filters. Three focused tests and full regression 1318 passed. Resolved 178/476; pending 298. Publishing and shared DOWN lifecycle remain pending.


## Batch136 — hBP05-062 / hBP05-071
Required tagged nonBuzz 1st searches fixed: Towa two and Korone one. Two focused tests; full regression 1320 passed. Resolved 180/476; pending 296. Publishing and shared DOWN lifecycle remain pending.


## Batch137 — hBP05-069
Fixed opponent-only immunity. Own/opposing special damage at back and collab verified. Four focused tests; full regression 1324 passed. Resolved 181/476; pending 295. Publishing and shared DOWN lifecycle remain pending.


## Batch138 — hBP05-063
Paid cheer search now mandatory; name exclusions and decline verified. Two focused tests; full regression 1326 passed. Resolved 182/476; pending 294. Publishing and shared DOWN lifecycle remain pending.


## Batch139 — hBP05-064
Required different-name search fixed, including limited availability. Three focused tests; full regression 1329 passed. Resolved 183/476; pending 293. Publishing and shared DOWN lifecycle remain pending.


## Batch140 — hBP05-084
Fixed harp extra-ability stage/name gate and duplicated generic Arts bonus. Six focused tests; full regression 1335 passed. Resolved 184/476; pending 292. hBP05-076 local wording says 第2位 while audit says 2nd; not changed this batch. Publishing and shared DOWN lifecycle remain pending.


## Batch141 — hBP05-080
Required revealed 1st selection fixed; draw and ordered bottom return verified. Full regression 1336 passed. Resolved 185/476; pending 291. Publishing and shared DOWN lifecycle remain pending.


## Batch142 — hBP05-051
Required top-three tagged Holomen pick fixed with optional helper override; no-match bottom order preserved. Two focused tests; full 1338 passed. Resolved 186/476; pending 290. Publishing and shared DOWN lifecycle remain pending.


## Batch143 — hBP06-018 / hBP06-019
Added missing top-deck archive Arts and turn counter. Four focused tests; full regression 1342 passed. Resolved 188/476; pending 288. Publishing and shared DOWN lifecycle remain pending.


## Batch144 — hBP06-011 / hBP06-013
Fixed mandatory Justice and Chattino searches; Buzz life finding reconciled. Four focused tests; full 1346 passed. Resolved 190/476; pending 286. Publishing and shared DOWN lifecycle remain pending.


## Batch145 — hBP06-016
Fixed required first-turn FLOW GLOW collab-keyword search. Three focused tests; full regression 1349 passed. Resolved 191/476; pending 285. Publishing and shared DOWN lifecycle remain pending.


## Batch146 — hBP06-010
Required first-turn deck deployment fixed. Debut/Spot native flows passed; full regression 1351 passed. Resolved 192/476; pending 284. Publishing and shared DOWN lifecycle remain pending.


## Batch147 — hBP06-029 / hBP06-031
Fixed optional top cheer and Lunaite threshold +50. Five focused tests; full regression 1356 passed. Resolved 194/476; pending 282. Publishing and shared DOWN lifecycle remain pending.


## Batch148 — hBP06-032
Mandatory other-Justice top cheer fixed. Two focused tests; full regression 1358 passed. Resolved 195/476; pending 281. Publishing and shared DOWN lifecycle remain pending.


## Batch149 — hBP06-037
Fixed topmost cheer-deck cost parsing and required paid damage. Two focused tests; full regression 1360 passed. Resolved 196/476; pending 280. Publishing and shared DOWN lifecycle remain pending.


## Batch150 — hBP06-038
Fixed paid archive return and special damage. Four focused tests; full regression 1364 passed. Resolved 197/476; pending 279. Publishing and shared DOWN lifecycle remain pending.


## Batch151 — hBP06-036
Required three-name search fixed. Three native target tests; full regression 1367 passed. Resolved 198/476; pending 278. Publishing and shared DOWN lifecycle remain pending.


## Batch152 — hBP06-048 / hBP06-050
Fixed nonblue cheer gate and mandatory back damage, preserving no-life clause on 048. Four focused tests; full regression 1371 passed. Resolved 200/476; pending 276. Publishing and shared DOWN lifecycle remain pending.


## Batch153 — hBP06-043 / hBP06-046
Fixed required front damage after hand costs. Four focused tests; full regression 1375 passed. Resolved 202/476; pending 274. Publishing and shared DOWN lifecycle remain pending.


## Batch154 — hBP06-053
Fixed required 90 special damage with four-cheer gate. Three focused tests; full regression 1378 passed. Resolved 203/476; pending 273. Publishing and shared DOWN lifecycle remain pending.


## Batch155 — hBP06-056
Restricted discount to named Life Reset SP using local translated title. Four focused tests; full regression 1382 passed. Resolved 204/476; pending 272. Publishing and shared DOWN lifecycle remain pending.


## Batch156 — hBP06-061 / hBP06-066
Fixed Robosa attachment thresholds and mandatory damage. Eight focused tests; full regression 1390 passed. Resolved 206/476; pending 270. Publishing and shared DOWN lifecycle remain pending.


## Batch157 — hBP06-068
Required finger search fixed with once-per-turn guard verified. Full regression 1391 passed. Resolved 207/476; pending 269. Publishing and shared DOWN lifecycle remain pending.


## Batch158 — hBP06-073
Fixed LIMITED support filter and explicit activation conditions. Two focused tests; full regression 1393 passed. Resolved 208/476; pending 268. Publishing and shared DOWN lifecycle remain pending.


## Batch159 — hBP06-077
Added current-turn LIMITED-count Arts bonus. Five focused tests; full regression 1398 passed. Resolved 209/476; pending 267. Publishing and shared DOWN lifecycle remain pending.


## Batch160 — hBP06-076 / hBP06-080
Required named Bloom searches fixed; Buzz life finding reconciled. Six focused tests; full regression 1404 passed. Resolved 211/476; pending 265. Publishing and shared DOWN lifecycle remain pending.


## Batch161 — hBP06-083
Fixed paid archive return with local Watame spelling supported. Two focused tests; full regression 1406 passed. Resolved 212/476; pending 264. Publishing and shared DOWN lifecycle remain pending.


## Batch162 — hBP06-078
Fixed required Oshi-name Debut search after payment. Two focused tests; full regression 1408 passed. Resolved 213/476; pending 263. Publishing and shared DOWN lifecycle remain pending.


## Batch163 — hBP06-087
Required Raden return fixed and native event verified. Full regression 1409 passed. Resolved 214/476; pending 262. Publishing and shared DOWN lifecycle remain pending.


## Batch164 — hBP06-093
Fixed required holoX search count. Three focused tests; existing optional-cheer regression retained with corrected search expectation. Full 1412 passed. Resolved 215/476; pending 261. Publishing and shared DOWN lifecycle remain pending.


## Batch165 — hBP06-096
Both archive cheer choices required; native attachment sequence passed. Full regression 1413 passed. Resolved 216/476; pending 260. Publishing and shared DOWN lifecycle remain pending.


## Batch166 — hBP07-011 / hBP07-015
Fixed required first Watame and ID3 Buzz searches. Two focused tests; full regression 1415 passed. Resolved 218/476; pending 258. Publishing and shared DOWN lifecycle remain pending.


## Batch167 — hBP07-025
Required Gamers archive cheer fixed. Full regression 1416 passed. Resolved 219/476; pending 257. Publishing and shared DOWN lifecycle remain pending.


## Batch168 — hBP07-026
Required named Mio search fixed. Two focused tests; full regression 1418 passed. Resolved 220/476; pending 256. Publishing and shared DOWN lifecycle remain pending.


## Batch169 — hBP07-030
Required Buzz Bloom healing fixed. Two focused tests; full regression 1420 passed. Resolved 221/476; pending 255. Publishing and shared DOWN lifecycle remain pending.


## Batch170 — hBP07-034
Fixed previously unrecognized archive cost and mandatory paid search. Full regression 1421 passed. Resolved 222/476; pending 254. Publishing and shared DOWN lifecycle remain pending.


## Batch171 — hBP07-036
Required Haato deployment fixed. Two focused tests; full regression 1423 passed. Resolved 223/476; pending 253. Publishing and shared DOWN lifecycle remain pending.


## Batch172 — hBP07-040
Required search after Haato return fixed. Full regression 1424 passed. Resolved 224/476; pending 252. Publishing and shared DOWN lifecycle remain pending.


## Batch173 — hBP07-041
Fixed whole-stage red-cheer wording. Two focused tests; full regression 1426 passed. Resolved 225/476; pending 251. Publishing and shared DOWN lifecycle remain pending.


## Batch174 — hBP07-048
Required EN archive recovery fixed; Buzz two-life behavior verified. Full regression 1429 passed. Resolved 226/476; pending 250. Publishing and shared DOWN lifecycle remain pending.

## Batch175 — hBP07-052 / hBP07-063
Fixed excluded-name Promise condition and AZKi oshi gate. Five focused tests; full regression 1434 passed. Resolved 228/476; pending 248. Publishing and shared DOWN lifecycle remain pending.

## Batch176 — hBP07-059 / hBP07-070
Required support recovery and cooking top-three selection fixed. Five focused tests; full regression 1439 passed. Resolved 230/476; pending 246. Publishing and shared DOWN lifecycle remain pending.

## Batch177 — hBP07-053 / hBP07-054
Required Promise top-cheer attachment fixed with Buzz restriction for 054. Five focused tests; full regression 1444 passed. Resolved 232/476; pending 244. Publishing and shared DOWN lifecycle remain pending.

## Batch178 — hBP07-057
Fixed opponent back-row damage >100 and Okayu oshi conditions. Five focused tests; full regression 1449 passed. Resolved 233/476; pending 243. Publishing and shared DOWN lifecycle remain pending.

## Batch179 — hBP07-061
Fixed Shiori oshi top-four support selection and required back-row damage. Four focused tests; full regression 1453 passed. Resolved 234/476; pending 242. Publishing and shared DOWN lifecycle remain pending.

## Batch180 — hBP07-064
Required Pioneer attachment to AZKi fixed. Two focused tests; full regression 1455 passed. Resolved 235/476; pending 241. Publishing and shared DOWN lifecycle remain pending.

## Batch181 — hBP07-067
Fixed required top-four AZKi selection and paid mandatory front damage, including 置入 cost wording. Three focused tests; full regression 1458 passed. Resolved 236/476; pending 240. Publishing and shared DOWN lifecycle remain pending.

## Batch182 — hBP07-073
Required Laplus deck search fixed. Two focused tests; full regression 1460 passed. Resolved 237/476; pending 239. Publishing and shared DOWN lifecycle remain pending.

## Batch183 — hBP07-071 / hBP07-078
Required top-five selections fixed, including purple Debut filter. Four focused tests; full regression 1464 passed. Resolved 239/476; pending 237. Publishing and shared DOWN lifecycle remain pending.

## Batch184 — hBP07-077
Required first-turn generation-five 2nd search fixed. Three focused tests; full regression 1467 passed. Resolved 240/476; pending 236. Publishing and shared DOWN lifecycle remain pending.

## Batch185 — hBP07-079
Required mascot attachment fixed. Two focused tests; full regression 1469 passed. Resolved 241/476; pending 235. Publishing and shared DOWN lifecycle remain pending.

## Batch186 — hBP07-084 / hBP07-088
Required archive cheer and current-turn archive bonus fixed. Five focused tests; full regression 1474 passed. Resolved 243/476; pending 233. Publishing and shared DOWN lifecycle remain pending.

## Batch187 — hBP07-082
Required generation-five 2nd search fixed. Two focused tests; full regression 1476 passed. Resolved 244/476; pending 232. Publishing and shared DOWN lifecycle remain pending.

## Batch188 — hBP07-090
Two-cheer optional attachment to one FLOW GLOW recipient fixed. Two focused tests; full regression 1478 passed. Resolved 245/476; pending 231. Publishing and shared DOWN lifecycle remain pending.

## Batch189 — hBP07-091
Required recovery after fan attachment fixed. Full sequence test; full regression 1479 passed. Resolved 246/476; pending 230. Publishing and shared DOWN lifecycle remain pending.

## Batch190 — hBP07-100
Mandatory sequential Frontier cheer attachment fixed. Two focused tests; full regression 1481 passed. Resolved 247/476; pending 229. Publishing and shared DOWN lifecycle remain pending.

## Batch191 — hBP07-105 / hBP07-106
Required mascot recoveries fixed. Three focused tests; full regression 1484 passed. Resolved 249/476; pending 227. Publishing and shared DOWN lifecycle remain pending.

## Batch192 — hBP07-107
Boros named Kronii SP usage gate fixed. Four focused tests; full regression 1488 passed. Resolved 250/476; pending 226. Publishing and shared DOWN lifecycle remain pending.

## Batch193 — hBP08-020
Current-turn deck archive threshold fixed. Five focused tests; full regression 1493 passed. Resolved 251/476; pending 225. Publishing and shared DOWN lifecycle remain pending.

## Batch194 — hBP08-010
Required IRyS named search fixed. Two focused tests; full regression 1495 passed. Resolved 252/476; pending 224. Publishing and shared DOWN lifecycle remain pending.

## Batch195 — hBP08-014
Fixed center and conditional collab special damage. Four focused tests; full regression 1499 passed. Resolved 253/476; pending 223. Publishing and shared DOWN lifecycle remain pending.

## Batch196 — hBP08-017
Required Ankimo search and generation-zero 2nd condition fixed. Four focused tests; full regression 1503 passed. Resolved 254/476; pending 222. Publishing and shared DOWN lifecycle remain pending.

## Batch197 — hBP08-019
Missing Chattino condition and required source attachment fixed. Two focused tests; full regression 1505 passed. Resolved 255/476; pending 221. Publishing and shared DOWN lifecycle remain pending.

## Batch198 — hBP08-023 / hBP08-024
Required heal and Arts rest fixed. Three focused tests; full regression 1508 passed. Resolved 257/476; pending 219. Publishing and shared DOWN lifecycle remain pending.

## Batch199 — hBP08-025 / hBP08-026
Rested Justice buff scopes fixed. Four focused tests; full regression 1512 passed. Resolved 259/476; pending 217. Publishing and shared DOWN lifecycle remain pending.

## Batch200 — hBP08-021
Required two Otomo search fixed. Four focused tests; full regression 1516 passed. Resolved 260/476; pending 216. Publishing and shared DOWN lifecycle remain pending.

## Batch201 — hBP08-027
Rested Justice cheer count and draw-before-rest fixed. Four focused tests; full regression 1520 passed. Resolved 261/476; pending 215. Publishing and shared DOWN lifecycle remain pending.

## Batch202 — hBP08-030
Required back-row cheer after payment fixed. Two focused tests; full regression 1522 passed. Resolved 262/476; pending 214. Publishing and shared DOWN lifecycle remain pending.

## Batch203 — hBP08-040
Red-only archive scaling fixed; Buzz life verified. Four focused tests; full regression 1526 passed. Resolved 263/476; pending 213. Publishing and shared DOWN lifecycle remain pending.

## Batch204 — hBP08-036
Required three-name search fixed. Three focused tests; full regression 1529 passed. Resolved 264/476; pending 212. Publishing and shared DOWN lifecycle remain pending.

## Batch205 — hBP08-037
Required front damage with Fuwawa gate fixed. Two focused tests; full regression 1531 passed. Resolved 265/476; pending 211. Publishing and shared DOWN lifecycle remain pending.

## Batch206 — hBP08-032
Both named 2nd buff targets fixed. Two focused tests; full regression 1533 passed. Resolved 266/476; pending 210. Publishing and shared DOWN lifecycle remain pending.

## Batch207 — hBP08-033
Required ID cheer search and one Reine recipient fixed. Two focused tests; full regression 1535 passed. Resolved 267/476; pending 209. Publishing and shared DOWN lifecycle remain pending.

## Batch208 — hBP08-034
Required Fuwawa/Mococo deployment selections fixed. Full sequence test; full regression 1536 passed. Resolved 268/476; pending 208. Publishing and shared DOWN lifecycle remain pending.

## Batch209 — hBP08-050
Required archive cheer attachment fixed. Two focused tests; full regression 1538 passed. Resolved 269/476; pending 207. Publishing and shared DOWN lifecycle remain pending.

## Batch210 — hBP08-043
All-stage Myth gate fixed; Buzz life verified. Three focused tests; full regression 1541 passed. Resolved 270/476; pending 206. Publishing and shared DOWN lifecycle remain pending.

## Batch211 — hBP08-048
Required Kehai search after payment fixed. Two focused tests; full regression 1543 passed. Resolved 271/476; pending 205. Publishing and shared DOWN lifecycle remain pending.

## Batch212 — hBP08-045
Current Arts dice buff adjustment fixed. Two focused tests; full regression 1545 passed. Resolved 272/476; pending 204. Publishing and shared DOWN lifecycle remain pending.

## Batch213 — hBP08-044
Top-deck archive quantity choice fixed. Three focused tests; full regression 1548 passed. Resolved 273/476; pending 203. Publishing and shared DOWN lifecycle remain pending.

## Batch214 — hBP08-051 / hBP08-055
Required cheer attachments fixed with recipient restrictions. Two focused tests; full regression 1550 passed. Resolved 275/476; pending 201. Publishing and shared DOWN lifecycle remain pending.

## Batch215 — hBP08-056
Required 1st Mococo search fixed. Two focused tests; full regression 1552 passed. Resolved 276/476; pending 200. Publishing and shared DOWN lifecycle remain pending.

## Batch216 — hBP08-053
Baton threshold and non-Debut damage target fixed. Three focused tests; full regression 1555 passed. Resolved 277/476; pending 199. Publishing and shared DOWN lifecycle remain pending.

## Batch217 — hBP08-060
Blue FUWAMOCO gate fixed. Three focused tests; full regression 1558 passed. Resolved 278/476; pending 198. Publishing and shared DOWN lifecycle remain pending.

## Batch218 — hBP08-054
Recipient-based cheer selection cap fixed. Three focused tests; full regression 1561 passed. Resolved 279/476; pending 197. Publishing and shared DOWN lifecycle remain pending.

## Batch219 — hBP08-070
Required Takodachi search fixed. Two focused tests; full regression 1563 passed. Resolved 280/476; pending 196. Publishing and shared DOWN lifecycle remain pending.

## Batch220 — hBP08-063
Required holoX top-three selection fixed. Two focused tests; full regression 1565 passed. Resolved 281/476; pending 195. Publishing and shared DOWN lifecycle remain pending.

## Batch221 — hBP08-064
Required paid damage and fan attachment fixed. Three focused tests; full regression 1568 passed. Resolved 282/476; pending 194. Publishing and shared DOWN lifecycle remain pending.

## Batch222 — hBP08-068
Independent front color conditions fixed. Four focused tests; full regression 1572 passed. Resolved 283/476; pending 193. Publishing and shared DOWN lifecycle remain pending.

## Batch223 — hBP08-066
Optional support return to deck top implemented. Two focused tests; full regression 1574 passed. Resolved 284/476; pending 192. Publishing and shared DOWN lifecycle remain pending.

## Batches 224-226
Fixed hBP08-074 color-count draw, hBP08-075 required Robosa search, and required grouped searches for hBP07-032, hBP07-046, hBP08-077. Ten added tests; full regression 1584 pass. Resolved 289/476; remaining 187. Publishing and shared DOWN lifecycle remain pending.


## Batch 227
Fixed hBP08-076 required top-three groups and three-food-event archive condition for healing 100. Five tests; full regression 1589 pass. Resolved 290/476; remaining 186. Publishing and shared DOWN lifecycle remain pending.

## Batch 228
Fixed hBP08-009, hBP08-081, hBP08-088 mandatory effects and Arts condition. Eight tests; full regression 1597 pass. Resolved 293/476; remaining 183. Publishing and shared DOWN lifecycle remain pending.

## Batch 229
Fixed hBP08-085 and hBP08-089 required paid continuations and archive Cheer Arts. Four tests; full regression 1601 pass. Resolved 295/476; remaining 181. Publishing and shared DOWN lifecycle remain pending.

## Batch 230
Fixed hBP08-091 mandatory archive Debut placement. Two tests; full regression 1603 pass. Resolved 296/476; remaining 180. Publishing and shared DOWN lifecycle remain pending.

## Batch 231
Fixed hBP08-097 and hBP08-107 mandatory/optional choices. Three tests; full regression 1606 pass. Resolved 298/476; remaining 178. Publishing and shared DOWN lifecycle remain pending.

## Batch 232
Fixed hBP08-099 attachment mode recipient requirement. Three tests; full regression 1609 pass. Resolved 299/476; remaining 177. Publishing and shared DOWN lifecycle remain pending.

## Batch 233
Fixed hBP08-031 archive-and-color-heal Arts and verified Buzz loss two. Three tests; full regression 1612 pass. Resolved 300/476; remaining 176. Publishing and shared DOWN lifecycle remain pending.

## Batch 234
Fixed hBP08-046 required search and empty-result shuffle. Two tests; full regression 1614 pass. Resolved 301/476; remaining 175. Publishing and shared DOWN lifecycle remain pending.

## Batch 235
Fixed hBP08-106 mandatory Cheer transfer. Two tests; full regression 1616 pass. Resolved 302/476; remaining 174. Publishing and shared DOWN lifecycle remain pending.

## Batch 236
Fixed hBP08-003 conditional required Oshi effects. Three tests; full regression 1619 pass. Resolved 303/476; remaining 173. Publishing and shared DOWN lifecycle remain pending.

## Batch 237
Fixed hBP08-005 both-front special damage after payment. Two tests; full regression 1621 pass. Resolved 304/476; remaining 172. Publishing and shared DOWN lifecycle remain pending.

## Batch 238
Fixed hEB01-008 and hEB01-009 required searches. Four tests; full regression 1625 pass. Resolved 306/476; remaining 170. Publishing and shared DOWN lifecycle remain pending.

## Batch 239
Fixed hEB01-005 minimum-one deployment. Two tests; full regression 1627 pass. Resolved 307/476; remaining 169. Publishing and shared DOWN lifecycle remain pending.

## Batch 240
Fixed hEB01-011 and hEB01-012 required searches. Three tests; full regression 1630 pass. Resolved 309/476; remaining 167. Publishing and shared DOWN lifecycle remain pending.

## Batch 241
Fixed hEB01-013 and hEB01-014 required effects. Three tests; full regression 1633 pass. Resolved 311/476; remaining 165. Publishing and shared DOWN lifecycle remain pending.

## Batch 242
Fixed hEB01-015 and hEB01-017 required Cheer effects and stack-condition cost misparse. Two tests; full regression 1635 pass. Resolved 313/476; remaining 163. Publishing and shared DOWN lifecycle remain pending.

## Batch 243
Fixed hEB01-019 mandatory grouped searches. Two tests; full regression 1637 pass. Resolved 314/476; remaining 162. Publishing and shared DOWN lifecycle remain pending.

## Batch 244
Fixed hEB01-020 reveal count. Two tests; full regression 1639 pass. Resolved 315/476; remaining 161. Publishing and shared DOWN lifecycle remain pending.

## Batch 245
Fixed hEB01-024 reveal count and validated damage/healing. Two tests; full regression 1641 pass. Resolved 316/476; remaining 160. Publishing and shared DOWN lifecycle remain pending.

## Batch 246
Fixed hEB01-025 required life-dependent effects. Two tests; full regression 1643 pass. Resolved 317/476; remaining 159. Publishing and shared DOWN lifecycle remain pending.

## Batch 247
Fixed hEB01-027 and hEB01-033 support effects. Three tests; full regression 1646 pass. Resolved 319/476; remaining 157. Publishing and shared DOWN lifecycle remain pending.

## Batch 248
Fixed both hSD01-011 Arts findings. Five tests; full regression 1651 pass. Resolved 320/476; remaining 156. Publishing and shared DOWN lifecycle remain pending.

## Batch 249
Reconciled hSD01-006 audit mismatch against local text: AZKi stage bonus, not dice. No engine change. Two tests; full regression 1653 pass. Resolved 321/476; remaining 155. Publishing and shared DOWN lifecycle remain pending.

## Batch 250
Fixed hSD01-018 mandatory top-look selection. Two tests; full regression 1655 pass. Resolved 322/476; remaining 154. Publishing and shared DOWN lifecycle remain pending.

## Batch 251
Fixed hSD01-020 required successful-die attachment. Three tests; full regression 1658 pass. Resolved 323/476; remaining 153. Publishing and shared DOWN lifecycle remain pending.

## Batch 252
Fixed hSD01-019 required paid search. Two tests; full regression 1660 pass. Resolved 324/476; remaining 152. Publishing and shared DOWN lifecycle remain pending.

## Batch 253
Fixed hSD02-001 required SP recovery. Two tests; full regression 1662 pass. Resolved 325/476; remaining 151. Publishing and shared DOWN lifecycle remain pending.

## Batch 254
Fixed hSD02-004 Poyo attachment condition. Two tests; full regression 1664 pass. Resolved 326/476; remaining 150. Publishing and shared DOWN lifecycle remain pending.

## Batch 255
Fixed hSD02-006 required paid damage. Two tests; full regression 1666 pass. Resolved 327/476; remaining 149. Publishing and shared DOWN lifecycle remain pending.

## Batch 256
Fixed hSD02-008 required paid Arts damage. Two tests; full regression 1668 pass. Resolved 328/476; remaining 148. Publishing and shared DOWN lifecycle remain pending.

## Batch 257
Fixed hSD02-011 required paid Debut Cheer. Two tests; full regression 1670 pass. Resolved 329/476; remaining 147. Publishing and shared DOWN lifecycle remain pending.

## Batch 258
Fixed hSD03-001 special-damage trigger. Two tests; full regression 1672 pass. Resolved 330/476; remaining 146. Publishing and shared DOWN lifecycle remain pending.

## Batch 259
Fixed hSD03-004 optional reveal. Two tests; full regression 1674 pass. Resolved 331/476; remaining 145. Publishing and shared DOWN lifecycle remain pending.

## Batch 260
Fixed hSD03-009 mandatory blue Cheer payment. Full regression 1675 pass. Resolved 332/476; remaining 144. Publishing and shared DOWN lifecycle remain pending.

## Batch 261
Fixed hSD03-010 required search. Two tests; full regression 1677 pass. Resolved 333/476; remaining 143. Publishing and shared DOWN lifecycle remain pending.

## Batch 262
Fixed hSD04-003 purple Oshi draw condition. Two tests; full regression 1679 pass. Resolved 334/476; remaining 142. hSD03-013 substitution remains pending, as do publishing and shared DOWN lifecycle.

## Batch 263
Fixed hSD04-004 required paid food search. Two tests; full regression 1681 pass. Resolved 335/476; remaining 141. Publishing and shared DOWN lifecycle remain pending.

## Batch 264
Fixed both hSD04-007 findings. Two tests; full regression 1683 pass. Resolved 336/476; remaining 140. Publishing and shared DOWN lifecycle remain pending.

## Batch265
hSD04-009 Event count Arts fixed. Full suite 1686 passed. Resolved 337/476; remaining 139. Publishing and shared DOWN lifecycle remain pending.

## Batch266
Six mandatory searches/deployments/attachments repaired: hSD14-004, hSD16-004, hSD13-009, hSD14-001, hSD15-001, hSD13-002. Full regression 1692 passed. Resolved 343/476; remaining 133. Publishing and shared DOWN lifecycle remain pending. hSD19-004 excluded from this batch because current local translated text explicitly says optional, unlike audit reference wording.

## Batch267
Repaired hSD06-002/005/006/007, hSD07-006, hSD08-003: mandatory search and healing, holoX target restriction, top-only cheer attachment. Six focused checks; full regression 1698 passed. Resolved 349/476; remaining 127. Publishing and shared DOWN lifecycle remain pending.

## Batch268
hSD05-006 and hSD05-009 repaired: distinct ReGLOSS names, exclude Hajime for Arts bonus, required Debut/1st search. Full regression 1703 passed. Resolved 351/476; remaining 125. Publishing and shared DOWN lifecycle remain pending.

## Batch269
hSD08-002 and hSD09-002 mandatory top-five summer Debut selection fixed. Full regression 1705 passed. Resolved 353/476; remaining 123. Publishing and shared DOWN lifecycle remain pending.

## Batch270
hSD09-006 and hSD08-007 cheer timing, top-deck and target-stage restrictions fixed. Full regression 1709 passed. Resolved 355/476; remaining 121. Publishing and shared DOWN lifecycle remain pending.

## Batch271
hSD09-001 required red recovery fixed. Full regression 1711 passed. Resolved 356/476; remaining 120. hSD09-003 remains pending: current local translation specifies center only while audit describes center/collab. Publishing and shared DOWN lifecycle remain pending.

## Batch272
hSD07-008 Elfriend archive attachment fixed, preserving local optional wording and source-only target. Full regression 1713 passed. Resolved 357/476; remaining 119. Publishing and shared DOWN lifecycle remain pending.

## Batch273
hSD11-005 FLOW GLOW back-row cheer restriction fixed. Full regression 1715 passed. Resolved 358/476; remaining 118. Publishing and shared DOWN lifecycle remain pending.

## Batch274
Reconciled hSD13-014 no-Bloom report: existing Spot restrictions already enforce it. hSD13-015 Spot restriction also verified, but Arts interpretation remains pending so card not closed. Two focused tests; full regression 1717 passed. Resolved 359/476; remaining 117. Publishing and shared DOWN lifecycle remain pending.

## Batch275
hSD18-004 draw now follows the same second-player first-turn condition as discard, based on local text. Full regression 1720 passed. Resolved 360/476; remaining 116. Publishing and shared DOWN lifecycle remain pending.

## Batch276
hSD10-001 SP FLOW GLOW target gate repaired. Full regression 1722 passed. Resolved 361/476; remaining 115. Publishing and shared DOWN lifecycle remain pending.

## Batch277
hSD10-011 three-cheer allocation capacity gate repaired. Full regression 1724 passed. Resolved 362/476; remaining 114. Publishing and shared DOWN lifecycle remain pending.

## Batch278
hSD11-007 reconciled against local text: center-only selection belongs to baton-cost effect, not an attack restriction. Both attack targets verified; modifier applies only to center through next turn. Full regression 1726 passed. Resolved 363/476; remaining 113. Publishing and shared DOWN lifecycle remain pending.

## Batch279
hBP02-006 required archive Bloom and shared Oshi Bloom legal-stage checks repaired, including SP archive candidate filter. Full regression 1728 passed. Resolved 364/476; remaining 112. hBP02-003 still pending its own candidate/mandatory/SP findings. Publishing and shared DOWN lifecycle remain pending.

## Batch280
hBP02-003 mandatory legal extra Bloom, Marine center SP gate and underlying Holomen damage count repaired. Full regression 1733 passed. Resolved 365/476; remaining 111. Publishing and shared DOWN lifecycle remain pending.

## Batch281
hBP03-050 required red/blue Advent cheer search fixed. Full regression 1735 passed. Resolved 366/476; remaining 110. Publishing and shared DOWN lifecycle remain pending.

## Batch282
hBP03-049 mandatory ReGLOSS center-color cheer search fixed, including empty eligibility. Full regression 1737 passed. Resolved 367/476; remaining 109. Publishing and shared DOWN lifecycle remain pending.

## Batch283
hBP03-044 mandatory top-four search and back-Suisei cheer transfer repaired. Full regression 1739 passed. Resolved 368/476; remaining 108. Publishing and shared DOWN lifecycle remain pending.

## Batch284
hBP03-059 and hBP03-065 required search/top-cheer effects repaired. Full regression 1741 passed. Resolved 370/476; remaining 106. Publishing and shared DOWN lifecycle remain pending.

## Batch285
hBP03-062 mandatory cheer cost and Gamers Debut search fixed. Full regression 1743 passed. Resolved 371/476; remaining 105. Publishing and shared DOWN lifecycle remain pending.

## Batch286
hBP03-073 Korone cheer destination repaired. Full regression 1745 passed. Resolved 372/476; remaining 104. Publishing and shared DOWN lifecycle remain pending.

## Batch287
hBP03-084 and hBP03-085 required computer searches fixed. Full regression 1747 passed. Resolved 374/476; remaining 102. Publishing and shared DOWN lifecycle remain pending.

## Batch288
hBP03-089 required fan search fixed. Full regression 1749 passed. Resolved 375/476; remaining 101. Publishing and shared DOWN lifecycle remain pending.

## Batch289
hBP04-009 required top-three Arts reveal fixed, including choice prompt. Full regression 1751 passed. Resolved 376/476; remaining 100. Publishing and shared DOWN lifecycle remain pending.

## Batch290
hBP04-012 and hBP04-013 required KoyoLab searches repaired. Full regression 1754 passed. Resolved 378/476; remaining 98. Publishing and shared DOWN lifecycle remain pending.

## Batch291
hBP04-014 Fubuki exclusion in Gamers Arts condition repaired. Full regression 1756 passed. Resolved 379/476; remaining 97. Publishing and shared DOWN lifecycle remain pending.

## Batch292
hBP04-019 required art-tag top-three search repaired. Full regression 1757 passed. Resolved 380/476; remaining 96. Publishing and shared DOWN lifecycle remain pending.

## Batch293
hBP04-026 reported keyword repaired: required white cheer with Fubuki Oshi and recipient gates. Full regression 1759 passed. Resolved 381/476; remaining 95. Publishing and shared DOWN lifecycle remain pending.

## Batch294
hBP04-044 required Yukimin attachment search repaired. Full regression 1761 passed. Resolved 382/476; remaining 94. Publishing and shared DOWN lifecycle remain pending.

## Batch295
hBP04-081 required yellow cheer to source fixed. Full regression 1762 passed. Resolved 383/476; remaining 93. Publishing and shared DOWN lifecycle remain pending.

## Batch296
hBP05-003 required Polka/Staff reveal groups repaired. Full regression 1764 passed. Resolved 384/476; remaining 92. Publishing and shared DOWN lifecycle remain pending.

## Batch297
Polka SP follow-up: no eligible Polka or Staff now archives all revealed cards directly; empty deck resolves without choice. Two additional regressions; full suite 1766 passed. Counts unchanged: 384/476 resolved, 92 remaining. Publishing and shared DOWN lifecycle remain pending.

## Batch298
hBP05-005 and hBP05-009 mandatory searches repaired. Full regression 1769 passed. Resolved 386/476; remaining 90. Publishing and shared DOWN lifecycle remain pending.

## Batch299
hBP05-031 mandatory first-turn fan search repaired. Full regression 1771 passed. Resolved 387/476; remaining 89. Publishing and shared DOWN lifecycle remain pending.

## Batch300
hBP05-037 conditional red/blue archive-cheer Arts implemented. Full regression 1775 passed. Resolved 388/476; remaining 88. Publishing and shared DOWN lifecycle remain pending.

## Batch301
hBP05-056 food-count Arts and mandatory paid recovery fixed. Full regression 1779 passed. Resolved 389/476; remaining 87. Publishing and shared DOWN lifecycle remain pending.

## Batch302
hBP05-076 second buff 2nd Choco restriction repaired. Full regression 1781 passed. Resolved 390/476; remaining 86. Publishing and shared DOWN lifecycle remain pending.

## Batch303
hBP05-073 required top-three cheer selection fixed; attachment, bottom ordering and draw verified. Full regression 1782 passed. Resolved 391/476; remaining 85. Publishing and shared DOWN lifecycle remain pending.

## Batch304
hBP06-001 SP connected to Raora reset return-to-back: stays active per local no-rest wording. Full regression 1784 passed. Resolved 392/476; remaining 84. Publishing and shared DOWN lifecycle remain pending.

## Batch305–306
hBP06-008 mandatory search and Matsuri SP center gate; hBP06-007 mandatory Roboco knockout recovery fixed. Full regression 1788 passed. Resolved 394/476; remaining 82. Publishing and shared DOWN lifecycle remain pending.

## Batch307–308
hBP06-002 special-damage knockout SP eligibility and hBP04-003 mandatory paired searches repaired. Full regression 1793 passed. Resolved 396/476; remaining 80. Publishing and shared DOWN lifecycle remain pending.

## Batch309
hBP04-007 mandatory deck attachment and sequential mandatory SP cheer repaired. Full regression 1795 passed. Resolved 397/476; remaining 79. Publishing and shared DOWN lifecycle remain pending.

## Batch310–311
hBP06-009 reconciled against local all-source damage reduction text; hBP06-049 mandatory blue cheer search repaired. Full regression 1799 passed. Resolved 399/476; remaining 77. Publishing and shared DOWN lifecycle remain pending.

## Batch312
hBP06-035 required Ayame attachment repaired. Full regression 1801 passed. Resolved 400/476; remaining 76. Publishing and shared DOWN lifecycle remain pending.

## Batch313
hBP06-089 mandatory cheer step repaired. Full regression 1802 passed. Resolved 401/476; remaining 75. Publishing and shared DOWN lifecycle remain pending.

## Batch314
hBP06-095 special-damage knockout life bonus repaired. Full regression 1804 passed. Resolved 402/476; remaining 74. Publishing and shared DOWN lifecycle remain pending.

## Batch315
hBP06-100 extra HP Oshi condition repaired. Full regression 1806 passed. Resolved 403/476; remaining 73. Publishing and shared DOWN lifecycle remain pending.

## Batch316
hBP06-084 reconciled: existing Spot Bloom restrictions verified, no engine change needed. Full regression 1808 passed. Resolved 404/476; remaining 72. Publishing and shared DOWN lifecycle remain pending.

## Batch317
hBP06-039 reported position restriction reconciled against current correct behavior. Full regression 1811 passed. Resolved 405/476; remaining 71. Publishing and shared DOWN lifecycle remain pending.

## Batch318
hBP06-021 conditional selected-recipient buff repaired. Full regression 1813 passed. Resolved 406/476; remaining 70. Publishing and shared DOWN lifecycle remain pending.

## Batch319
hBP06-082 Gift target and Arts ritual conditions repaired. Full regression 1816 passed. Resolved 407/476; remaining 69. Publishing and shared DOWN lifecycle remain pending.

## Batch320
hBP06-045 named-SP condition and required special damage repaired. Full regression 1819 passed. Resolved 408/476; remaining 68. Publishing and shared DOWN lifecycle remain pending.

## Batch321
hBP06-020 top-deck archive and per-card Arts bonus repaired. Full regression 1821 passed. Resolved 409/476; remaining 67. Publishing and shared DOWN lifecycle remain pending.

## Batch322
hBP06-059 required blue/purple cheer Bloom effect repaired. Full regression 1823 passed. Resolved 410/476; remaining 66. Publishing and shared DOWN lifecycle remain pending.

## Batch323
hBP06-064 payment availability repaired. Full regression 1825 passed. Resolved 411/476; remaining 65. Publishing and shared DOWN lifecycle remain pending.

## Batch324
hBP06-062 optional paired search repaired. Full regression 1827 passed. Resolved 412/476; remaining 64. Publishing and shared DOWN lifecycle remain pending.

## Batch325
hBP06-069 named skill recipient Arts bonus repaired. Full regression 1830 passed. Resolved 413/476; remaining 63. Publishing and shared DOWN lifecycle remain pending.

## Batch326
hBP06-101 optional special-damage blue cheer trigger implemented. Full regression 1832 passed. Resolved 414/476; remaining 62. Publishing and shared DOWN lifecycle remain pending.

## Batch327
hBP06-052 optional Gift repaired and Buzz life loss reconciled. Full regression 1835 passed. Resolved 415/476; remaining 61. Publishing and shared DOWN lifecycle remain pending.

## Batch328
hBP06-065 reconciled against local mandatory Gift and existing Art-use timing/Buzz life loss. Full regression 1839 passed. Resolved 416/476; remaining 60. Publishing and shared DOWN lifecycle remain pending.

## Batch329
hBP06-060 optional Arts cost and draw repaired. Full regression 1843 passed. Resolved 417/476; remaining 59. Publishing and shared DOWN lifecycle remain pending.

## Batch330
hBP06-081 paid search and repeated Arts cheer repaired. Full regression 1846 passed. Resolved 418/476; remaining 58. Publishing and shared DOWN lifecycle remain pending.

## Batch331
hBP06-027 Arts +40 requires Iroha Oshi and own collab; Buzz predecessor bypasses Arts reduction. Three targeted tests and full regression 1849 passed. Card remains pending for Gift extra-Bloom reconciliation/repair. Resolved 418/476; remaining 58. Publishing and shared DOWN lifecycle remain pending.

## Batch332
hBP06-027 scoped Gift next-stage Bloom repaired; completes Batch331 Arts work. Full regression 1850 passed. Resolved 419/476; remaining 57. Publishing and shared DOWN lifecycle remain pending.

## Batch333
hBP06-097 shared opponent-main-phase Buzz jacket guard added to damage adjustment and direct remaining-HP setting. Direct Oshi HP-setting positive/negative tests passed; full regression 1852 passed. Card remains pending for remaining HP-change paths and targeted damage verification. Resolved 419/476; remaining 57. Publishing and shared DOWN lifecycle remain pending.

## Batch334
hBP06-097 protection extended to targeted healing and direct tool damage placement. Main/performance special-damage boundary tests passed; full regression 1854 passed. Entry remains pending for stage-changing effects that alter HP and final coverage review. Resolved 419/476; remaining 57. Publishing and shared DOWN lifecycle remain pending.

## Batch335
hBP06-097 direct HP protection completed and source/phase boundaries tested. Card movement retains its own rules; no blanket movement immunity inferred from HP text. Full regression 1857 passed. Resolved 420/476; remaining 56. Publishing and shared DOWN lifecycle remain pending.

## Batch336
hBP04-085 required cheer search fixed; color/recipient distinction reconciled against local wording. Full regression 1858 passed. Resolved 421/476; remaining 55. Publishing and shared DOWN lifecycle remain pending.

## Batch337
hBP04-031 target-first same-color cheer repaired. Full regression 1859 passed. Resolved 422/476; remaining 54. Publishing and shared DOWN lifecycle remain pending.

## Batch338
hBP04-015 Promise Arts bonus repaired and Buzz life loss verified. Full regression 1862 passed. Resolved 423/476; remaining 53. Publishing and shared DOWN lifecycle remain pending.

## Batch339
hBP04-037 single optional Bloom roll and ordered Arts damage repaired. Full regression 1865 passed. Resolved 424/476; remaining 52. Publishing and shared DOWN lifecycle remain pending.

## Batch340
hBP04-053 required cheer and optional reveal repaired; Buzz life loss verified. Full regression 1869 passed. Resolved 425/476; remaining 51. Publishing and shared DOWN lifecycle remain pending.

## Batch341
hBP03-079 required yellow self-cheer repaired; Buzz life loss verified. Full regression 1871 passed. Resolved 426/476; remaining 50. Publishing and shared DOWN lifecycle remain pending.

## Batch342
hSD09-003 reconciled to local center-only text; distinct-name count verified. Full regression 1872 passed. Resolved 427/476; remaining 49. Publishing and shared DOWN lifecycle remain pending.

## Batch343
hSD19-004 optional deployment reconciled to explicit local text; use/skip verified. Full regression 1874 passed. Resolved 428/476; remaining 48. Publishing and shared DOWN lifecycle remain pending.

## Batch344
hSD01-013 local aliases and optional dice repaired. Full regression 1877 passed. Resolved 429/476; remaining 47. Publishing and shared DOWN lifecycle remain pending.

## Batch345
hSD01-009 optional roll and separate optional return repaired. Full regression 1879 passed. Resolved 430/476; remaining 46. Publishing and shared DOWN lifecycle remain pending.

## Batch346
hSD13-015 resolved by documented local-text different-color pair interpretation; existing Spot restriction verified. No external ruling claimed. Full regression 1882 passed. Resolved 431/476; remaining 45. Publishing and shared DOWN lifecycle remain pending.

## Batch347
hBP05-066 audit dice mismatch reconciled to local distinct-name Arts text; existing behavior verified. Full regression 1883 passed. Resolved 432/476; remaining 44. Publishing and shared DOWN lifecycle remain pending.

## Batch348
hBP05-067 optional Arts die implemented and Gift post-payment recovery changed to required. Skip and equality-die Arts regressions passed; full regression 1885 passed. Card remains pending for direct Gift transfer/recovery verification. Resolved 432/476; remaining 44. Publishing and shared DOWN lifecycle remain pending.

## Batch 349
- Completed hBP05-067 Gift transfer/recovery validation and closed its reported findings.
- Fixed hBP05-033 optional dice archive and exact per-Zain Arts bonus. Verified decline/accept and zero/one/two attachments.
- Full regression: 1891 pass. Local effect text only; no external sources.
- Progress: 434/476 resolved, 42 remaining. Shared DOWN lifecycle and publishing remain pending.

## Batch 350
- hEB01-010: optional Bloom die; accepted odd result requires opponent back/center swap.
- Removed unprinted three-card stack prerequisite. Fixed late-selected repeat permission so the source can actually use its same Arts again.
- Four focused tests pass; full regression 1895 pass. Local card text only.
- 435/476 resolved; 41 remaining. Shared DOWN lifecycle and website publishing remain pending.

## Batch 351
- Fixed hBP08-067 paid Bloom: moves opponent Cheer between opponent Holomen, preserving ownership and requiring completion after cost.
- Payment and decline tests pass; full regression 1897 pass. Local text only.
- 436/476 resolved; 40 remaining. Shared DOWN lifecycle and website publishing remain pending.

## Batch 352 (partial card)
- hBP08-110 Arts +10 per copy now applies independently of the later center-only color clause; center/collab tests pass.
- Full regression 1899 pass. All-color opponent-front continuous effect remains pending; card remains unresolved.
- Counts unchanged: 436/476 resolved; 40 remaining. Shared DOWN lifecycle and publishing remain pending.

## Batch 353 (partial card)
- hBP08-110: Arts target color advantage now dynamically treats opponent center/collab as all colors while the attacking player's center holds Takodachi.
- Four added source-position/target-position tests pass; full regression 1903 pass.
- Card remains pending: other color-sensitive targeting/conditions still need the continuous color view. No completion count increase.
- 436/476 resolved; 40 remaining. Shared DOWN lifecycle and website publishing remain pending.

## Batch 354 (partial card)
- Added action-local state context to catalog lookup. unitCard now derives continuous Takodachi front colors and active allColors modifiers without mutating printed card data.
- Stage selection filters, color-gated Oshi skills, stage-color search and direct source/target reads now use effective stage colors.
- Eight Takodachi focused tests pass; full regression 1905 pass before final equivalent source/target lookup replacements.
- Remaining verification: DOWN snapshot colors and position/removal transitions. hBP08-110 stays pending, counts 436/476, 40 remaining.

## Batch 355
- Completed hBP08-110: pre-DOWN effective card colors saved before removal; live effect disappears when holder leaves center or attachment is removed.
- Eleven focused Takodachi tests pass; full regression 1908 pass.
- 437/476 reported cards resolved; 39 remaining. Shared DOWN ordering lifecycle and publishing remain pending.

## Batch 356
- hBP07-019 required BAZO/Zecretary deck attachment fixed; native Bloom payment/attachment test passes.
- Buzz DOWN exactly two life confirmed; audited additional-two interpretation reconciled with printed life replacement.
- Full regression 1910 pass. 438/476 resolved, 38 remaining. Shared DOWN ordering and publishing pending.

## Batch 357
- hBP07-021 required legal BAZO/Zecretary archive attachment and exact ID3 Buzz Arts gate fixed.
- Three focused tests; full regression 1913 pass.
- 439/476 resolved, 37 remaining. Shared DOWN ordering and publishing remain pending.

## Batch 358
- hBP07-022 required third-generation recipient; colorless Arts cost -1 or -2 for 2nd Noel this turn.
- Two native subsequent-attack cost tests pass; full regression 1915 pass.
- 440/476 resolved, 36 remaining. Shared DOWN ordering and publishing remain pending.

## Batch 359
- hBP07-035 Arts returns all attached Cheer to Cheer deck bottom in chosen order, then draws to that count.
- Two native tests pass; full regression 1917 pass.
- 441/476 resolved, 35 remaining. Shared DOWN ordering and publishing pending.

## Batch 360
- hBP07-044 archives the top two cards, then offers optional Staff recovery, including newly archived Staff.
- Two focused tests; full regression 1919 pass.
- 442/476 resolved, 34 remaining. Shared DOWN ordering and publishing remain pending.

## Batch 361
- hBP07-056 optional source Cheer transfer to another Promise Holomen; completed transfer applies +100 if Oshi is Kronii.
- Three branch tests pass; full regression 1922 pass.
- 443/476 resolved, 33 remaining. Shared DOWN ordering and publishing pending.

## Batch 362
- hBP07-076 Nerissa Oshi condition gates draw then mandatory hand-to-Power. Buzz life loss exactly two verified.
- Three focused tests; full regression 1925 pass.
- 444/476 resolved, 32 remaining. Shared DOWN ordering and publishing pending.

## Batch 363
- hBP07-062 mandatory archive Cheer to Advent; +100 checks recipient after attachment and Shiori Oshi.
- Two focused recipient threshold tests; full regression 1927 pass.
- 445/476 resolved, 31 remaining. Shared DOWN ordering and publishing pending.

## Batch 364 (partial card)
- hBP07-058 mandatory Cheer search uses union of own stage ID3 Holomen colors, recipient any own Holomen.
- Native Bloom test rejects skip and off-color Cheer; full regression 1928 pass.
- Arts reconciliation remains: local text says opponent HP reduced with at least three back Holomen, audit describes life reduction, implementation counts three damaged back Holomen. Do not use audit paraphrase as authoritative text.
- Counts unchanged: 445/476 resolved, 31 remaining. Shared DOWN ordering and publishing pending.

## Batch 365
- hBP07-058 local Arts text interpreted as an opposing damaged Holomen AND at least three opposing back Holomen. Audit life-loss paraphrase not used.
- Three conjunction tests plus prior mandatory search test pass; full regression 1931 pass.
- 446/476 resolved, 30 remaining. Shared DOWN ordering and publishing pending.

## Batch 366
- hBP07-031 local Extra two-life outcome verified through native DOWN; existing Buzz handling correct, no production change.
- Full regression 1932 pass. 447/476 resolved, 29 remaining.
- Shared DOWN ordering and website publishing remain pending.

## Batch 367
- hBP07-081 four-Power/empty-opponent-Collab forced movement implemented; opponent chooses, no normal Collab rewards or use.
- Three boundary tests; full regression 1935 pass.
- 448/476 resolved, 28 remaining. Shared DOWN ordering and publishing pending.

## Batch 368
- hBP07-083 center Bloom applies both stages +40 and own 2nd Nene +60 through opponent next turn.
- Four position/amount/expiry tests; full regression 1939 pass.
- 449/476 resolved, 27 remaining. Shared DOWN ordering and publishing pending.

## Batch 369 (partial card)
- hBP07-085 Arts Oshi gate and required named recipient, turn Arts bonus based on recipient Cheer implemented.
- Two focused tests; full regression 1941 pass.
- Still pending: movement-to-Collab Gift and self-target current Arts bonus validation. Counts unchanged 449/476 resolved, 27 remaining.
- Shared DOWN ordering and publishing pending.

## Batch 370 (partial card)
- hBP07-085 choosing itself now applies the recipient Cheer bonus to the currently queued Arts as well as the turn modifier.
- Three focused Arts tests pass; full regression 1942 pass.
- Movement-to-Collab Gift still pending. Counts unchanged 449/476, 27 remaining. Shared DOWN ordering and publishing pending.

## Batch 371
- hBP07-085 own-turn Collab movement Gift wired for normal, forced and swap paths; required Flare pick from top three, remainder archive.
- Three Gift tests plus three prior Arts tests; full regression 1945 pass.
- 450/476 resolved, 26 remaining. Shared DOWN ordering and publishing pending.

## Batch 372
- hPR-001 optional die; odd face requires red/blue Cheer to own back, followed by shuffle.
- Three branch tests; full regression 1948 pass.
- 451/476 resolved, 25 remaining. Shared DOWN ordering and publishing pending.

## Batch 373
- hBP07-042 records actual stage-to-deck returns through shared return trigger and gates Arts1 +50 on current-turn return.
- Two focused tests; full regression 1950 pass.
- 452/476 resolved, 24 remaining. Shared DOWN ordering and publishing pending.

## Batch 374
- hBP07-006 eligible Oshi search requires event selection after payment.
- Native test and full regression 1951 pass.
- 453/476 resolved, 23 remaining. Shared DOWN ordering and publishing pending.

## Batch 375 (partial card)
- hBP07-007 archive Cheer distribution now mandatory and sequential, refreshing choices after each card is used.
- Two sequential/shortage tests; full regression 1953 pass.
- Remaining: let player choose recipient order, particularly when Cheer is insufficient. Current fixed stage order is temporary, card remains pending.
- Counts 453/476 resolved, 23 remaining. Shared DOWN ordering and publishing pending.

## Batch 376
- hBP07-007 player chooses recipient order, including shortages; each recipient receives at most one Cheer, available archive cards refresh.
- Updated two native tests; full regression 1953 pass.
- 454/476 resolved, 22 remaining. Shared DOWN ordering and publishing pending.

## Batch 377 (partial card)
- hBP05-018 Arts0 requires both ID3 and Buzz for draw; Arts1 KO deck search switched to mandatory.
- Two Arts0 tests pass; full regression 1955 pass. Direct Arts1 KO search verification remains before closure.
- Counts unchanged 454/476 resolved, 22 remaining. Shared DOWN ordering and publishing pending.

## Batch 378
- hBP05-018 direct Arts1 KO search validated, required eligible ID3 first retrieval; closes card after prior Buzz draw fix.
- Three focused tests; full regression 1956 pass.
- 455/476 resolved, 21 remaining. Shared DOWN ordering and publishing pending.

## Batch 379 (partial card)
- hBP05-050 Arts checks current-turn Mococo Arts history (+40) and exact current-turn Moco Oshi skill (+30), independently.
- Four combinations tested. Buzz Extra verification remains before closure; counts unchanged 455/476, 21 remaining.
- Shared DOWN ordering and publishing pending.

## Batch 380
- hBP05-050 Buzz two-life loss and archive verified, closing prior Arts gates repair.
- Five focused tests; full regression 1961 pass.
- 456/476 resolved, 20 remaining. Shared DOWN ordering and publishing pending.

## Batch 381 (partial card)
- hBP03-071 wins now add a turn-long red specialAttack modifier, consumed by Arts color advantage rather than a one-shot fixed bonus.
- Full regression 1961 pass. Dedicated duration coverage, optional activation and real player RPS choices remain pending; current automatic random RPS is not final.
- Counts unchanged 456/476, 20 remaining. Shared DOWN ordering and publishing pending.

## Batch 382 (partial card)
- hBP03-071 optional activation now precedes RPS. Decline avoids random calls. Red-special modifier verified red-only and expires next turn.
- Four new focused tests; full regression 1965 pass.
- Accepted RPS still uses old automatic random resolution; real hidden player choices and tie-repeat remain pending. Counts unchanged 456/476, 20 remaining.
- Shared DOWN ordering and publishing pending.

## Batch 383
- hBP03-071 private RPS player selections replace random outcomes; ties repeat, optional activation retained, red special win modifier applies this turn/current Arts.
- Public state privacy/tie/win test plus four prior tests; full regression 1966 pass.
- 457/476 resolved, 19 remaining. Shared DOWN ordering and publishing pending.

## Batch 384 (partial card)
- hBP04-025 mandatory mushroom event search and Raden Oshi gate implemented.
- Two focused tests; full regression 1968 pass.
- Remaining: prevent partial two-Cheer cost after first transfer; card stays pending. Counts 457/476, 19 remaining.
- Shared DOWN ordering and publishing pending.

## Batch 385
- Accepted multi-Cheer transfer now requires minimum payment completion; Raden must transfer to two different back recipients before +30.
- Three focused tests with prior fixes; full regression 1969 pass.
- 458/476 resolved, 18 remaining. Shared DOWN ordering and publishing pending.

## Batch 386
- hBP03-036 separate required deck reveal and optional archive-all decision, then shuffle.
- Two focused branches and updated old flow test; full regression 1971 pass.
- 459/476 resolved, 17 remaining. Shared DOWN ordering and publishing pending.

## Batch 387
- hBP05-086 Cilus triggers for center Kobo holder when opposing back is DOWN, independent of damage source.
- Two focused position/source tests; full regression 1973 pass.
- 460/476 resolved, 16 remaining. Shared DOWN ordering and publishing pending.

## Batch 388 (partial attribution)
- Botan Oshi SP special damage now carries sourceCardNumber through target selection to queued Gift damage trigger; explicit source preferred over absent stage source.
- Full regression 1973 pass after narrowing metadata propagation to intended calls.
- Direct Botan SP/Gift test, Buzz verification, and Okayu bonus attribution remain pending. Counts unchanged 460/476, 16 remaining.
- Shared DOWN ordering and publishing pending.

## Batch 389
- hBP05-028 Botan Oshi SP source attribution and opponent-only Gift trigger; native SP/Gift and Buzz checks pass.
- Full regression 1975 pass. 461/476 resolved, 15 remaining.
- Shared DOWN ordering and publishing pending.

## Batch 390
- hBP05-045 Okayu Oshi damage carries explicit source into center special-damage bonus.
- Center +20 and back exclusion tests pass; full regression 1977 pass.
- 462/476 resolved, 14 remaining. Shared DOWN ordering and publishing pending.

## Batch 391
- hBP05-016 separate roll/decline choices for each underlying Holomem; actual rolled sum drives Arts bonus and Gift parity.
- Three focused cases pass; full regression 1980 pass.
- 463/476 resolved, 13 remaining. Shared DOWN ordering and publishing pending.

## Batch 392
- hBP08-058 explicit required blue archive Cheer selection; blue FUWAMOCO Oshi condition and complete two-Cheer payment before non-Debut special damage.
- Three focused tests; full regression 1983 pass.
- 464/476 resolved, 12 remaining. Shared DOWN ordering and publishing pending.

## Batch 393
- hBP01-095 Arts now offers hand 1st Bloom for same-turn back Debut, validates name/HP and executes Bloom triggers.
- Three focused tests; full regression 1986 pass.
- 465/476 resolved, 11 remaining. Shared DOWN ordering and publishing pending.

## Batch 394 (partial)
- hBP05-002 SP continuation explicitly requires second Cheer payment; skip rejection test passes.
- Full regression 1987 pass. Normal damage-trigger skill still pending; counts remain 465/476, 11 remaining.
- Shared DOWN ordering and publishing pending.

## Batch 395 (partial)
- Iofi post-damage normal skill now offers paid optional transfer from damaged ID1 member to another ID1; ordinary Arts damage test passes.
- Full regression 1988 pass. Lethal damage/DOWN ordering remains to verify; hBP05-002 remains pending.
- 465/476 resolved, 11 remaining. Shared DOWN ordering and publishing pending.

## Batch 396 (partial)
- hBP05-001 normal skill search is required once activated; native knockout/search test passes.
- Full regression 1989 pass. Noel SP and shared DOWN ordering remain pending.
- 465/476 resolved, 11 remaining; publishing pending.

## Batch 397 (partial)
- hBP05-001 opponent-turn #3期生 DOWN SP implemented: self life -1, Buzz/2nd draws two.
- Debut and 2nd focused checks pass; full regression 1991 pass.
- Shared DOWN lifecycle still archives/removes and reduces normal life before reactions; final-life/ordering verification and Buzz test remain pending. Counts remain 465/476, 11 remaining; publishing pending.

## Batch 398 (partial)
- Towa hBP03-005 opponent-turn DOWN SP implemented with exact center/collab two-Cheer quotas (shortage takes all), arbitrary combined bottom order.
- Native quota rejection and order test passes; full regression 1992 pass.
- Shared DOWN ordering/final-life verification remains pending, so counts remain 465/476, 11 remaining. Publishing pending.

## Batch 399 (partial)
- hBP03-006 Korone SP triggers on own yellow DOWN, transfers one defeated Cheer then recovers one defeated stack Holomem; shortage continuation implemented.
- Native ordered transfer/recovery test passes; full regression 1993 pass.
- Shared DOWN ordering and final-life checks remain pending. Counts 465/476, 11 remaining; publishing pending.

## Batch 400 (DOWN refactor preparation)
- Extracted finishKnockoutLife from knockOutUnit to isolate normal life loss, life Cheer and defeat completion.
- Behavior unchanged; full regression 1993 pass. Next: defer this phase and archiving until DOWN abilities finish, migrate archive-assuming reaction handlers.
- Local earlier audit note at line 129 identifies DOWN abilities before archive/life. Counts remain 465/476, 11 remaining; publishing pending.

## Batch 401 (DOWN life boundary)
- Normal knockout life loss now waits behind queued DOWN reactions; enqueueEffect places their follow-up choices before finishDownLife.
- Noel and FLOW GLOW tests now verify pre-normal-loss state and subsequent normal loss; full regression 1993 pass.
- Archiving/removal still occurs before reactions, and multi-DOWN/final-life sequencing needs validation. Counts 465/476, 11 remaining; publishing pending.

## Batch 402 (final-life boundary verification)
- Native final-life Towa tests prove DOWN choice and accepted follow-up complete before normal life loss and game defeat; skip branch also verified.
- Full regression 1995 pass. Archiving/removal still premature; multi-DOWN and other final-life interactions remain pending.
- Counts 465/476, 11 remaining; publishing pending.

## Batch 403 (partial)
- hSD01-002 SP now allows zero selected Cheer and activation with an empty archive when a green target exists.
- Empty/nonempty archive tests pass; full regression 1997 pass. Normal dice skill remains pending.
- Counts 465/476, 11 remaining; DOWN archiving and publishing pending.

## Batch 404 (partial)
- hBP05-083 tool now triggers once per turn in payHandArchive with matching source metadata and 2nd Nerissa center/collab; native Arts trigger test passes.
- Full regression 1998 pass. Other archive paths and ordering remain to review; hBP05-061 self Arts buff appears not applied to queued current attack (test totals 130 Arts +20 special), requires follow-up.
- Counts 465/476, 11 remaining; DOWN archiving and publishing pending.

## Batch 405
- Fixed hBP05-061 buffSong dispatch to artBuffTarget with sourceZone, so choosing the attacking Nerissa updates queued current Arts as well as the turn modifier.
- Native tool/Arts test now correctly expects 150 Arts plus 20 special = 170; full regression 1998 pass.
- Counts 465/476, 11 remaining. Tool other-path coverage, DOWN archiving and publishing remain pending.

## Batch 406
- hBP05-083 scoped checks: collab works, skipped hand archive does not trigger, used tool is suppressed. Current catalog 2nd Nerissa hand-archive Arts uses shared payHandArchive.
- Full regression 2001 pass. 466/476 resolved, 10 remaining.
- DOWN archiving, remaining dice/other effects and publishing pending.

## Batch 407 (partial)
- completeArtCheerCost now triggers hSD11-001 SP by source #FLOW GLOW tag rather than only hSD11-006 ID.
- Tagged-source shared payment test verifies two paid Cheer ->60 damage; full regression 2002 pass.
- Other Cheer archival paths remain to reconcile; counts 466/476, 10 remaining. DOWN archiving and publishing pending.

## Batch 408 (partial)
- Generic keyword Cheer payment completion now queues hSD11-001 SP for #FLOW GLOW source cards, excluding the two existing explicitly handled cards to avoid duplicate triggers.
- Full regression 2002 pass. Dedicated new-path coverage and other archive paths remain pending.
- Counts 466/476, 10 remaining; DOWN archiving and publishing pending.

## Batch 409
- Native hBP08-048 collab validates generalized hSD11-001 keyword Cheer trigger: one paid Cheer offers one 30-damage SP window; skipped cost offers none; search continues.
- Full regression 2004 pass. Other archival paths still pending; counts 466/476, 10 remaining. DOWN archiving and publishing pending.

## Batch 410
- Local FLOW GLOW archive-text inventory separates actual Cheer payment from ordinary main-deck archival. Native hBP06-018/019/020 Arts tests confirm non-Cheer archival does not trigger SP.
- Full regression 2007 pass. Remaining source-path reconciliation still pending; counts 466/476, 10 remaining. DOWN archiving and publishing pending.

## Batch 411 (partial)
- Added queueFlowGlowArchivedCards to count only actual Cheer cards from a tagged ability source; wired Riona 0618/0619 direct Arts, 0620 deck batch and 0820 collab batch with explicit metadata.
- Full regression 2007 pass; positive actual-Cheer batch tests and remaining keyword/DOWN sources still pending.
- Counts 466/476, 10 remaining; DOWN archiving and publishing pending.

## Batch 412
- Added Riona DOWN Gift actual-Cheer archive hook; generic main-deck keyword cost was already covered by batch 411.
- Mixed two-card archive counts one Cheer ->30 SP damage. Full regression 2008 pass.
- hSD11-001 reported source-path finding resolved. 467/476 resolved, 9 remaining. Shared DOWN timing and publishing pending.

## Batch 413
- hBP07-027 local-text interpretation: front-position restriction qualifies KO draw, not Arts permission. Front treated as center/collab; fixed center-only KO draw.
- Three native checks pass; full regression 2011 pass. No external verification; local wording interpretation recorded explicitly.
- 468/476 resolved, 8 remaining. Shared DOWN archive timing and publishing pending.

## Batch 414 (website build readiness)
- Production vinext build and packaged Worker/hosting artifact validation pass using C:/Program Files/Git/bin/bash.exe scripts/build-verified.sh.
- npm run build resolves Windows WSL bash and fails because /bin/bash is absent; use installed Git Bash for final build.
- Current artifact builds successfully but is not published because remaining engine work is incomplete. Counts 468/476, 8 remaining; regression total last verified 2011.

## Batch 415 (partial)
- hSD03-013 may substitute one blue Cheer in source-only generic keyword/Arts payment for Okayu; live option filtering accepts validated attached mascot; removal uses attachments and does not increment actual Cheer archive events.
- Native hSD03-009 Arts test passes; full regression 2012 pass.
- Other payment paths, both selection orders, UI selection support and replacement-count interactions remain to review. Counts 468/476, 8 remaining; DOWN archiving and publishing pending. Rebuild needed after engine edits since batch 414.

## Batch 416 (mascot UI)
- PvP client highlights mascot replacement attachment options during stageCheerSelection and sends choose/cheerId from attachment clicks; prompt mentions replacement mascots.
- Production build and packaged Worker validation pass using Git Bash. Last engine suite 2012 pass.
- Mascot other payment/order cases remain pending; counts 468/476, 8 remaining. DOWN archive timing and publishing pending.

## Batch 417
- hSD03-013 replacement verified for all four local Okayu Cheer-cost Arts: hBP02-041, hBP05-043, hSD03-006, hSD03-009; reversed payment order preserves mascot option.
- Full regression 2016 pass. UI integration/build passed batch 416.
- 469/476 resolved, 7 remaining. Shared DOWN archive timing, dice effects and publishing pending.

## Batch 418
- Native third-generation Buzz hBP02-017 validates Noel SP: two cards drawn and SP self life -1 before normal Buzz life -2.
- Full regression 2017 pass. Shared archive/removal-before-DOWN problem still pending; counts remain 469/476, 7 remaining. Dice effects and publishing pending.

## Batch 419
- Iofi normal special-damage trigger verified for opponent damage on opponent turn; self damage and own-turn damage excluded.
- Full regression 2020 pass. Lethal/source-removal timing not settled; hBP05-002 remains pending.
- Counts 469/476, 7 remaining. Shared DOWN archive timing, dice and publishing pending.

## Batch 420 (deferred archive preparation)
- Added explicit defeatedCardPool/takeDefeatedCard helpers supporting marked downPending units and archive fallback; migrated Korone/Pekora/Kiara explicit ID lookups and Korone transfer removal.
- No downPending marking enabled yet: generic selection validation/recovery handlers and target exclusion must migrate before moving archive timing.
- Full regression 2020 pass. Counts 469/476, 7 remaining; dice and publishing pending. Rebuild needed after these source changes.

## Batch 421 (deferred transfer source)
- koTransferCheer now retains fromDefeated through target choice; lookup/removal uses explicit defeated-card access, and marked DOWN units are excluded as recipients. Ordinary archive attachment effects retain archive-only access.
- Full regression 2020 pass. downPending marking/actual archive delay still disabled pending remaining recovery paths.
- Counts 469/476, 7 remaining; dice and publishing pending.

## Batch 422 (pre-archive recovery)
- Explicit Korone/Lamy/stack DOWN recovery uses fromDefeated access; giftReturnDefeated removes from marked source or archive fallback. Ordinary archive recovery remains archive-only.
- Existing full regression 2020 pass after edits; two new source-isolation tests pass (2022 combined tests). Actual downPending lifecycle remains to enable.
- Counts 469/476, 7 remaining; dice and publishing pending.

## Batch 423
- Marked pending-DOWN transfer test proves Cheer moves directly from stage source before archive; defeated unit excluded as recipient; archive remains empty.
- Full regression 2023 pass. Actual knockOutUnit still archives early; marker lifecycle activation and remaining source assumptions remain pending.
- Counts 469/476, 7 remaining; dice and publishing pending.

## Batch 424 (DOWN archive activation)
- knockOutUnit now marks downPending and queues abilities before archive; finishKnockoutLife archives remaining cards and removes stage unit before normal life loss. Duplicate DOWN guarded.
- Migrated Watame fan eligible source, hBP04-077 stack selection; stageOptionsMatching excludes marked DOWN recipients. Ruffians remains archive-only.
- Wind-up Fox test expects pending stage source; Roboco archive recovery fixture now supplies an actual preexisting archive target (defeated source is not yet archived).
- Full regression 2023 pass after fixing 11 integration failures. End-to-end ordering, simultaneous/nested DOWN and Iofi lethal timing still need targeted validation.
- Counts 469/476, 7 remaining; dice and publishing pending. Build stale after source edits.

## Batches 425-427
- Verified Korone stack recovery and direct Cheer transfer before archive; corrected the no-recipient fallback.
- Migrated LIMITED rescue, return-defeated Gift and attached-support recovery to the pending DOWN source. Three native regression cases pass.
- Iofi lethal Arts/special damage reactions now finish before the defeated source is archived; use and decline paths pass.
- Full suite: 2032 passed, 0 failed. Closed hBP03-005, hBP03-006, hBP05-001, hBP05-002 against reported findings.
- Progress: 473/476 resolved, 3 remaining (hBP01-123, hBP06-103, hSD01-002). Build and deployment pending.

## Batch 428: final reported dice repairs
- hBP01-123: optional source-attached fan archive cancels and rerolls the entire dice batch; repeated fans remain selectable. Stacked Pekora Arts groups its selected dice before computing the final bonus/draw.
- hBP06-103: optional fan archive changes one chosen die to 4 for Oshi or #1期生 abilities.
- hSD01-002: optional pre-roll declaration costs 3 Holo Power once per turn and changes only the next die; SP zero-Cheer choice was covered in batch 403.
- Current-action continuation retains a private baseline/random tape; public choices contain no baseline or hidden cards. Replay commits costs and final results once, and discarded dice are removed from turn events.
- Eight focused tests and full regression: 2040 passed, 0 failed.
- Reported findings: 476/476 resolved, 0 remaining. This closes the local-text audit repair ledger; it does not claim exhaustive gameplay scenario coverage. Final build/deployment pending.
- Final website build passed after batch 428; publication in progress.
- Saved ready-to-publish Sites version 61 from ce1a210d5d3d5a8512fd067b7889ae5be667ff52.
- Public deployment was rejected by automatic approval review: it requires explicit user authorization to update the existing public production website. No deployment was started. All 476 reported card repairs and the 2040-test suite are complete; publication awaits authorization.
- User explicitly approved public publication. Version 61 deployed successfully on 2026-09-07: https://hololive-ocg-zh-deck-studio.matthewmelia.chatgpt.site (deployment appgdep_6a9e45b143d48191ace67a7a767e2310). All reported repairs and requested website update are complete.
