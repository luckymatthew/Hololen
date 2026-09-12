# Card scanner

As of 2026-09-12, card scanning is available in the Android app only. The website
catalogue no longer imports or opens the scanner, so visiting the website does
not load its OCR engine. Scanner sources and datasets remain in this repository
for the mobile app and their existing unit tests. The web-scanner implementation
notes below describe the retired website feature.

The library header opens a native modal dialog. A separate preparation button
downloads/loads Japanese and English OCR data without camera access or an image.
Stage progress, cancellation, retry and a ready state are shown; camera and OCR
buttons unlock only after the engine is configured. Scan never starts downloads.
Switching between camera and photo while idle retains the prepared worker.
Versioned language files use the browser's normal HTTP cache; no persistent ready
flag is assumed. Worker IndexedDB caching is disabled to avoid blocking on
storage access in embedded iOS browsers. Engine initialization has a 60-second
timeout and preparation a 90-second outer timeout including script loading;
interrupted OCR requires preparing a new engine.
Camera access is requested only
by the camera button. Rear camera is preferred. Auto-scanning is opt-out and runs
one OCR job at a time; candidate results pause it. Manual capture, photo selection,
90-degree rotation and editable OCR text provide fallbacks.

OCR runs on the client with pinned Tesseract.js 6.0.1 / core 6.0.0 and Japanese +
English LSTM language data. Script and worker/core are loaded from the pinned CDN;
both language files are bundled under `/ocr-data/v1/` (about 5 MB total). Sources,
sizes and SHA-256 checksums are recorded beside the assets. No photo, OCR text or
scan history is sent to the app server or stored in localStorage.

2026-09-05 loading incident: the old explicitly configured URL
`https://tessdata.projectnaptha.com/4.0.0_best_int/jpn.traineddata.gz` returned HTTP
404 in a direct check. Tesseract 6.0.1 rejects the loadLanguage job but not its
createWorker promise; our no-op errorHandler hid that error until timeout.
`initializeOcr` now forwards callback failures immediately and handles abort and
timeout, including terminating a worker that resolves after cancellation.
Language assets have been downloaded successfully from the current versioned
package source, decompressed and checked. Regression tests reproduce the exact
never-settling initialization promise plus error callback.

Camera tracks stop on close, card selection, photo selection, cancellation of a
pending camera request, or a background tab. Late camera requests and OCR results
are invalidated. Scan timeout is 90 seconds; script download timeout is 30 seconds.

Matching uses number, member name, native skill titles, optional Japanese effect
fragments, HP and Bloom stage. Rare effect n-grams carry more weight than generic
phrases. Scores rank candidates, not calibrated probabilities. Auto-open requires
one recognized existing number, or an exact distinctive title plus member name
with sufficient separation. Rarity/artwork is never inferred. Shared names,
generic effects and multiple recognized card numbers require manual selection.

`public/scanner-ja.json` is a modified extraction from the Apache-2.0 dataset at
https://github.com/lichingchester/hololive-ocg-wiki. Source blob IDs are recorded in
its metadata. Only Japanese names of skills and effects for existing card numbers
were retained. Cards/images remain property of COVER Corp. The source license is
distributed as `/scanner-data-license.txt`. Rebuild with
`node scripts/build-scanner-index.mjs SOURCE_CARDS SOURCE_I18N`.

The supplemental snapshot covers 1,228 card numbers, 1,138 with effect text.
New hEB01 cards and simulator-only records lacking Japanese effects still match
card numbers and native titles already in the main card library. No card rules or
Chinese translations were changed by the extraction.

Validation: scanner matching/crop unit tests plus existing application regression
tests and a production build. Real-camera accuracy, CDN loading on actual mobile
devices, glare/sleeves and browser end-to-end operation still require device QA.
No claimed accuracy percentage. This change does not migrate hosting to GitHub.

Full-project `tsc --noEmit` also reports pre-existing typing issues in account,
simulator, deck filter inference and Cloudflare ambient types; no scanner typing
errors were reported. Production build and runtime regression tests are the
existing project's validation gates.
