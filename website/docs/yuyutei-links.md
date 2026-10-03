# Yuyutei card links

Card details in the deck studio and persistent simulator inspector offer **搜尋遊遊亭**, a native retailer search using the exact card number. The selected rarity remains visible in the label/note, which asks users to choose the matching printing and check rarity/artwork. Search returns multiple printings; no unobserved rarity filter is invented. Missing/invalid card numbers show unavailable; unknown printing IDs never borrow another printing's rarity or product link.

**No direct product mapping is currently enabled.** All eight previously inferred mappings were downgraded after the local source audit. Fresh primary detail-page confirmations and a complete retailer evidence packet have since arrived from the parent's user-opened Dot browser. Exact artwork comparisons remain pending because retailer image requests are blocked in this executor; the coding environment does not share that browser. Historical observations remain in `rejectedCandidates`; `products` stays empty until fresh artwork-confirmed records pass the [evidence contract](yuyutei-evidence-contract.md). Both platform resolvers require consistent primary evidence, exact artwork, source URL and booster edition; errata labels also require a printed-text/version confirmation. No prices are fetched, stored, displayed or estimated.

## Historical local evidence audit: 2026-10-03

The following are observed indexed titles, not verified live retailer pages. Candidate card numbers/IDs come from the unchanged official catalog. The “indexed number” column records only a number actually visible in the returned snippet; it does not certify the primary page or artwork. All rows are search-only.

| Inferred catalog candidate / stable ID | Indexed title evidence | Indexed number | Observed URL / primary access |
| --- | --- | --- | --- |
| hBP03-001 / 565 | OSR 姫森ルーナ; [hBP03]エリートスパーク | Not shown | [hbp03/10001](https://yuyu-tei.jp/sell/hocg/card/hbp03/10001), HTTP 403 |
| hBP03-001 / 678 | OUR 姫森ルーナ(パラレル); [hBP03]エリートスパーク | hBP03-001 | [hbp03/10002](https://yuyu-tei.jp/sell/hocg/card/hbp03/10002), HTTP 403 |
| hBP03-002 / 679 | OUR 獅白ぼたん(パラレル); [hBP03]エリートスパーク | hBP03-002 | [hbp03/10004](https://yuyu-tei.jp/sell/hocg/card/hbp03/10004), HTTP 403 |
| hBP08-001 / 2204 | OSR IRyS; [hBP08]バウンサーバウンド | Not shown | [hbp08/10001](https://yuyu-tei.jp/sell/hocg/card/hbp08/10001), HTTP 403 |
| hBP07-002 / 1788 | OSR ベスティア・ゼータ; [hBP07]ディーヴァフィーバー | Not shown | [hbp07/10003](https://yuyu-tei.jp/sell/hocg/card/hbp07/10003), HTTP 403 |
| hBP09-003 / hbp09-hBP09-003_OUR | OUR 白銀ノエル(パラレル); [hBP09]ボリュームヴォルテックス | hBP09-003 in auxiliary search snippet | [hbp09/10007](https://yuyu-tei.jp/sell/hocg/card/hbp09/10007), inaccessible through web tool |
| hBP08-018 / 2339 | UR ときのそら(パラレル); [hBP08]バウンサーバウンド | Not shown | [hbp08/10042](https://yuyu-tei.jp/sell/hocg/card/hbp08/10042), HTTP 403 |
| hBP07-043 / 1954 | SR さくらみこ(パラレル); [hBP07]ディーヴァフィーバー | Not shown | [hbp07/10090](https://yuyu-tei.jp/sell/hocg/card/hbp07/10090), HTTP 403 |

The JSON retains each full observed title, snippet-number status, inferred catalog rarity/image and rejection decision. All eight lacked primary-page artwork verification. The [official Hololive card list](https://hololive-official-cardgame.com/cardlist/) is the provenance of catalog identities and image URLs, not evidence of a Yuyutei listing match.

Ordinary cloud Chromium navigation to the Luna OUR product and the actual Google fallback URL failed with `ERR_TUNNEL_CONNECTION_FAILED`. No navigation interception, authentication, access-control bypass, alternate domain or proxy was used for these source checks. Source-access attempts stopped after these permitted methods remained blocked. Prices, stock, current page content and retailer artwork remain unverified.

## Primary-browser handoff and native search

The parent independently opened actual retailer pages and confirmed all eight historical candidates' displayed card numbers, names and rarities, plus hBP08-003 FUWAMOCO OSR at `hbp08/10005`. Its researcher captured 965 deduplicated product tiles from hBP03/07/08/09 (234/239/245/247) between 2026-10-03 06:39–06:47 UTC. The evidence JSON was downloaded in this executor and verified at 443,623 bytes / SHA-256 `7bbeae4cd0d4c81e70c6e1012dfc7d43650a88a515ca73861509025df380f9eb`. The raw research packet stays outside the repositories and contains no prices/stock.

The packet explicitly makes no artwork-equivalence assertion. A candidate join by number/rarity/booster finds one candidate for 963 rows and none for two rows. Four hBP03-027 C/S before/after-errata products collide on two catalog IDs, so these cannot be collapsed. Exact image and printed-text checks must resolve them. Direct JPEG retrieval returned tunnel HTTP 403, and the normal web tool also could not access the retailer image URL; source-image attempts stopped. No source URL or artwork match is invented.

The parent's actual primary browser verified [native card-number search](https://yuyu-tei.jp/sell/hocg/s/search?search_word=hBP08-003), which visibly returned FUWAMOCO SEC/OUR/OSR printings. Both platforms now use that observed HTTPS `/sell/hocg/s/search` endpoint with only `search_word=<percent-encoded card number>`. They display the selected rarity and explicitly ask users to choose the matching version. This replaces the older Google fallback. It proves the representative native-search behavior in the parent's browser; it does not promise stock, prices or results for every PR/other number. Local UI/navigation tests still use fixtures and are not primary-source checks.

## Baseline and preservation

The feature begins at safe recovery `e5274c52068f0d63e59cc655f4d471179d96689c`, based on true production `238915a9f71fe4158d45f8f18fad6d2af7d10aaf`, and includes deployed `release/download-1.2.7` commit `a789bcbac3f8ca5216f3188f30bb6177e97a40c9`. The draft PR targets that latest release branch. Stale main/reverted PR3 are not bases.

Catalog remains 1,394 card numbers / 2,981 printings. Engines, compatibility aliases, saved formats, workflow/security configuration and tags are unchanged. Published 1.2.7 metadata and release tests remain byte-identical to `a789bcb`. The preservation test pins all 366 reviewed production files, including the release branch's approved metadata hash, and recognizes exactly four added retailer runtime modules.

## Validation

- Full `npm test` after the native-search/evidence-gate changes: 11 synchronization/release tests and 4,035 regressions passed, plus TypeScript and Firebase production build. Resolver tests cover all 2,981 printings and explicitly prevent all eight rejected candidates from becoming direct links.
- Synthetic evidence tests cover exact stable artwork, repeated-rarity reprints, primary provenance, errata text/version, unsafe URLs, duplicate mappings and timestamps with explicit timezone. Synthetic assertions are never imported into the product manifest.
- React UI and Chromium navigation checks cover rarity-specific searches, PR/SEC/unknown IDs, safe external links, unchanged saved draft data, mobile action size and compact hover previews. Chromium external responses are fixtures.
- The authorized private Android app uses a byte-identical public manifest: 152 unit/UI tests and both unsigned release APK builds passed; lint reported zero errors and 40 warnings. No private source or fixture is copied here.

Physical-device browser handling remains unrun. Local retailer artwork access remains blocked, while primary product-label/native-search checks succeeded separately in the parent's browser and their packet is hash-verified here. Actual image comparisons against the candidate catalog artworks are still required before direct links are enabled. No production merge, deployment, signing, paid CI, publishing, purchasing or scraping occurred. Do not infer retailer IDs or reuse another printing's page.
