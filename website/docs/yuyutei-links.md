# Yuyutei card links

Card details in the deck studio and persistent simulator inspector offer **搜尋遊遊亭**, an external Google search restricted to Yuyutei Hololive sales pages. The exact card number and selected rarity are percent-encoded into the query. The text says the printing link is unverified and asks users to check number, rarity and artwork. Missing/invalid card numbers show unavailable; unknown printing IDs never borrow another printing's rarity or product link.

**No direct product mapping is currently enabled.** All eight previously inferred mappings were downgraded after the source audit. Their observed URLs remain only in `rejectedCandidates` as research evidence; the runtime uses the empty `products` list. A unique set/name/rarity match in the official catalog and an indexed search snippet do not prove the retailer's exact printing/artwork. No prices are fetched, stored, displayed or estimated.

## Evidence audit: 2026-10-03

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

## Search semantics and limits

Google's primary [search-operator documentation](https://support.google.com/websearch/answer/2466433) was accessible and confirms site restriction and quoted exact-match terms. For example, the OUR selection builds `site:yuyu-tei.jp/sell/hocg/card/ "hBP03-001" "OUR"` in the sole `q` parameter of `https://www.google.com/search`. OSR and P selections use their own rarity; malformed numbers have no URL.

The public search tool returned the Luna OUR indexed candidate for that representative query. The PR query did not establish a corresponding product and also returned unrelated results. That tool is not the Google browser endpoint, so this is only partial search-semantic corroboration. The actual Google URL could not load in the browser; its live results, indexing coverage and exact endpoint behavior are not verified. UI/navigation tests use explicit local fixtures and cannot close this source-access gap.

## Baseline and preservation

The feature begins at safe recovery `e5274c52068f0d63e59cc655f4d471179d96689c`, based on true production `238915a9f71fe4158d45f8f18fad6d2af7d10aaf`, and includes deployed `release/download-1.2.7` commit `a789bcbac3f8ca5216f3188f30bb6177e97a40c9`. The draft PR targets that latest release branch. Stale main/reverted PR3 are not bases.

Catalog remains 1,394 card numbers / 2,981 printings. Engines, compatibility aliases, saved formats, workflow/security configuration and tags are unchanged. Published 1.2.7 metadata and release tests remain byte-identical to `a789bcb`. The preservation test pins all 366 reviewed production files, including the release branch's approved metadata hash, and recognizes exactly four added retailer runtime modules.

## Validation

- Full `npm test` on `4fedb102817de2f716109791b4f71912d2846578`: 11 synchronization/release tests and 4,030 regressions passed, plus TypeScript and Firebase production build.
- After the search-only correction, the complete suite passed again: 11 synchronization/release tests, 4,030 regressions, TypeScript and Firebase production build. Resolver tests cover all 2,981 printings and explicitly prevent all eight rejected candidates from becoming direct links.
- React UI and Chromium navigation checks cover rarity-specific searches, PR/SEC/unknown IDs, safe external links, unchanged saved draft data, mobile action size and compact hover previews. Chromium external responses are fixtures.
- The authorized private Android app uses a byte-identical public manifest; no private source or fixture is copied here.

Physical-device browser handling and actual retailer/Google result content remain unrun or blocked. No production merge, deployment, signing, paid CI, publishing, purchasing or scraping occurred. Enable a product only after primary public evidence verifies the exact card number, rarity and artwork; do not infer retailer IDs or reuse another printing's page.
