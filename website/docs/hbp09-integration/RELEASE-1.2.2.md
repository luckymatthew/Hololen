# Hololens 1.2.2 — export repair and opponent hand count

This update fixes the opponent hand count being covered by the hand-toggle button and repairs Android exports that could lose their payload while the system save picker was open. Install the original-signed ARM64 APK over the existing app without uninstalling. Android 15 or newer is required. The package, signing certificate, current native source, scanner, login, deck sync, NativeRules and existing AI features are retained.

Deck JSON, native backup, raw-save ZIP, performance JSON and AI Review JSON/ZIP are now prepared and validated in private staging files before opening the document picker. The pending export survives Activity recreation. Writing requires a non-null stream; the completed destination is reopened and SHA-256 checked before success is reported. Cancel removes the pending export only; delivery failures retain a retryable copy and preserve committed saves.

AI Review reads the last committed match incrementally outside QuickJS, including one decision record at a time. Its ZIP retains the four existing files, adds SHA-256 alongside legacy integrity values, and includes a bounded native operation journal in the manifest. Performance reports also include that journal. Failed actions remain separate from committed decision records. Unknown measurements remain null, and export does not claim replay verification. Offline review files include both hands and decks and are not uploaded automatically.

Native AI search now retains full simulated states only for its search beam while preserving all root evaluations. Diagnostic recording shares immutable history instead of cloning the entire retained history at every action. Rejected simulated actions retain bounded reasons for diagnosing stalled choices. Empty/null notices are replaced by a useful error message. Website file importers explain empty, incomplete and inappropriate JSON without replacing the existing deck.

## Current validation

- Website: 11 sync/release tests and 2,304 regressions; TypeScript and production build passed.
- Native host: 58 tests passed, including complete offline matches, recording reconstruction, hidden-information checks and hand-count snapshots. The old and new native policies chose identical actions and scores on the tested main-phase and pending-cheer fixtures; this is a focused equivalence check, not a strength claim.
- Android: 75 debug and 75 release unit tests passed. Both lint variants completed with zero errors (49 warnings each). Original certificate, v3 signature, 16 KiB alignment and all 5,774 packaged assets verified.
- Original-signed 1.2.1 → 1.2.2 emulator upgrade preserved the stored profile and deck. Packaged JNI rules, native UI, save/restart and scanner regressions passed.
- On Android 15 x86_64, all six export types survived Activity recreation while the real system picker was open, then produced readable files with verified readback. Cancel/retry and restore also passed. A null check in the test's accessibility lookup was corrected; the affected three-test group then passed against the same signed release APK.
- Actual device screenshot and accessibility checks confirm the opponent hand badge and hand-toggle do not overlap. Narrow/wide layouts and both hand modes passed UI tests; the count changes with snapshots while card identities remain hidden.
- A synthetic 20,020,252-byte committed-history stress fixture exported without creating a rules runtime in 2,038 ms in the final run. Process PSS was sampled before/after (133,234 / 51,766 KiB); these are not peak-memory measurements. This fixture is explicitly synthetic and does not prove every long game fits memory.
- Actual Android review JSON/ZIP files passed the handoff schema and ZIP/integrity checks. The actual exported deck imported through the browser UI as 1/1 oshi, 50/50 main and 20/20 cheer; a subsequent empty import preserved all 71 cards.

## Limits

The exact phone save that stalled at turn 4 was not available, so that specific freeze is not claimed reproduced or resolved. Rejected-action diagnostics are now available to investigate it. Physical ARM64 phone, camera, fresh Google login, live account sync and actual disk-full/cloud-document-provider behavior remain unverified. Unit tests cover missing streams, write/close failures, truncated readback, malformed data, cancellation and persisted recovery. Activity recreation was exercised in DocumentsUI; a real OS process kill during document delivery was not. The historical missing AI Review reader/source remains unavailable. Earlier partial acceptance items remain partial; this repair is not a claim that all 38 original gates are complete.

Use `SHA256SUMS.txt` to verify downloads. The install ZIP contains the same APK. Private Android source, raw test diagnostics and signing keys are not published.
