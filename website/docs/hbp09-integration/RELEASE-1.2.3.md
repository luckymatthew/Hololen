# Hololens 1.2.3 — native AI and export reliability

Fixes an independently reproduced Android AI halt that displayed `null` during a normal game. The hBP09 support lookup retained completed simulation states through a map that referenced its own WeakMap key. Android's QuickJS collector did not release these associations. The lookup is now scoped to each synchronous action and removed on success, rejected actions and dice pauses; read-only evaluations no longer register a lookup. The existing rules, search budgets, scores and trained AI policy are retained.

All six export types now offer **儲存至手機下載**, publishing to **Downloads/Hololens** only after writing, closing and SHA-256 readback. The result dialog shows the filename and size and offers sharing. Interrupted app-owned Downloads entries retain a durable URI for retry after process restart. A failed write removes only the new pending entry and retains the validated private payload. The existing Android document picker is available under **選擇其他位置**. A successful picker result without a destination no longer silently discards the prepared content; cancellation also retains it until explicit cancellation or successful delivery. Errors remain visible in a dialog.

Literal `null`, including trailing newlines, is replaced by an actionable error. Native operations record the failure independently of the rules engine. Performance reports now use the installed app version rather than a stale preview label. AI Review continues to stream the last committed save outside QuickJS, without fabricating measurements or claiming unperformed replay verification.

Install the original-signed ARM64 APK over Hololens without uninstalling. Android 15+ is required. The package, signing identity, current native UI, opponent hand-count badge, scanner, login, deck sync and prior hBP09/AI Review work are retained. Private Android source and signing material are not published.

## Verification

- Published 1.2.2 reproduced `IllegalStateException: null` at turn 3, revision 34. Its failed state and command were retained. The fixed bundle completed a normal native game in 236 actions / 22 turns; the final signed 1.2.3 APK completed a separate game in 207 actions / 17 turns. These are Android QuickJS runs, not only Node simulations.
- The actual failing position passed 60 prepare/rollback probes. Post-rollback QuickJS memory stayed between 9,855,959 and 9,859,668 bytes. These are retained-memory readings, not peak process memory. Candidates, scores, selected action, nodes and samples matched the published policy for that position.
- Website: 2,304 regressions, 11 sync/release checks, TypeScript and production build passed. Native host: 58 tests passed. Six additional predeclared self-play games covered twelve deck families, including dark versus white Koyori, with 1,390 committed steps and retained-state/entropy replay checks.
- Android: 77 debug and 77 release tests, zero failures. Both lint variants passed with zero errors and 40 warnings. Original certificate, v3 signatures, 16 KiB alignment and all 5,774 packaged assets were checked.
- Signed 1.2.2 → 1.2.3 emulator update preserved the profile byte-for-byte. Eighteen signed-APK instrumentation checks passed. One additional scanner-photo check was skipped because its private photo fixtures were unavailable; it is not counted as a pass.
- All six export types produced non-empty, validated files in Android Downloads after a real rules rejection. The committed save was unchanged. Real document-picker cancel/retry, Activity recreation, a missing destination and process-stop/resume of a staged Downloads write passed.
- Actual AI Review ZIPs passed JSON schema, CRC, SHA-256, legacy integrity and retained command replay checks. The 34,571-byte Downloads ZIP contained 18 AI decisions and 33 retained actions. Actual deck JSON imported through the website UI as 1/1 oshi, 50/50 main and 20/20 cheer; an empty import retained the 71 cards.
- A synthetic 20,020,252-byte review history exported without creating QuickJS. This is a bounded exporter stress check, not proof that every long game fits memory.

## Limits

The user confirmed empty files in phone Downloads with no completion message. The exact phone save and OEM storage-provider callback were unavailable; that device-specific empty-file path was not reproduced. The new direct Downloads path and persistent result dialogs were verified on Android 15 x86_64. Physical ARM64 phone operation, camera, fresh Google login, real-account sync and actual disk-full behavior remain unverified. A real process was stopped between partial-write staging and recovery; arbitrary interruption at every possible instruction was not tested. The independently reproduced AI halt is fixed, but this is not a claim that every original 38-item acceptance gate or every card interaction is complete.

Use the release's `SHA256SUMS.txt` to verify the APK and install ZIP. The ZIP contains the identical APK.
