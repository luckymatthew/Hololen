# Yuyutei card links

Card details in the deck studio and persistent simulator inspector offer **遊遊亭價格** for 15 verified printings, opening that exact retailer product page to check its current price. The other 2,966 printings offer **搜尋遊遊亭**, a verified native card-number search. Its note shows the selected rarity and asks users to choose the matching printing and check rarity/artwork. Search returns multiple printings; no rarity filter is invented. Missing/invalid numbers are unavailable. Unknown printing IDs never borrow another printing's rarity or product price. No prices or stock are fetched, stored, displayed or estimated in Hololens.

## Verified primary artwork evidence

An independent primary-browser researcher inspected the actual retailer detail pages and downloaded and compared each retailer front image with the exact official printing image. The cumulative 15-record version 1 packet was downloaded in this executor, verified at 30,069 bytes / SHA-256 `8476287b1c8f43ce2f76832e81d44e1a735d713092f135d7f754577c364260c3`, and passed the [evidence contract](yuyutei-evidence-contract.md) and batch importer. Its filename retains `nine` for Library identity continuity, but version 1 contains all 15 confirmed records.

The public manifest retains the observed primary URL, title, number, rarity, exact catalog image/ID, timestamp, detailed visual comparison, both image SHA-256 hashes and scan-difference notes. Artwork, framing, printed labels and skill layouts match; retailer watermarks/foil reflections differ. The raw research packet and paired-image files stay outside both repositories. No private artwork, source, fixtures or credentials are published.

| Card number | Rarity | Stable printing ID | Verified retailer product |
| --- | --- | --- | --- |
| hBP01-028 | C | `2314` | [hbp08/10229](https://yuyu-tei.jp/sell/hocg/card/hbp08/10229) |
| hBP01-028 | HR | `2444` | [hbp08/10240](https://yuyu-tei.jp/sell/hocg/card/hbp08/10240) |
| hBP03-001 | OSR | `565` | [hbp03/10001](https://yuyu-tei.jp/sell/hocg/card/hbp03/10001) |
| hBP03-001 | OUR | `678` | [hbp03/10002](https://yuyu-tei.jp/sell/hocg/card/hbp03/10002) |
| hBP03-002 | OUR | `679` | [hbp03/10004](https://yuyu-tei.jp/sell/hocg/card/hbp03/10004) |
| hBP03-037 | C | `2319` | [hbp08/10234](https://yuyu-tei.jp/sell/hocg/card/hbp08/10234) |
| hBP03-040 | C | `2320` | [hbp08/10235](https://yuyu-tei.jp/sell/hocg/card/hbp08/10235) |
| hBP07-002 | OSR | `1788` | [hbp07/10003](https://yuyu-tei.jp/sell/hocg/card/hbp07/10003) |
| hBP07-043 | SR | `1954` | [hbp07/10090](https://yuyu-tei.jp/sell/hocg/card/hbp07/10090) |
| hBP08-001 | OSR | `2204` | [hbp08/10001](https://yuyu-tei.jp/sell/hocg/card/hbp08/10001) |
| hBP08-003 | OSR | `2206` | [hbp08/10005](https://yuyu-tei.jp/sell/hocg/card/hbp08/10005) |
| hBP08-003 | SEC | `2326` | [hbp08/10007](https://yuyu-tei.jp/sell/hocg/card/hbp08/10007) |
| hBP08-003 | OUR | `2333` | [hbp08/10006](https://yuyu-tei.jp/sell/hocg/card/hbp08/10006) |
| hBP08-018 | UR | `2339` | [hbp08/10042](https://yuyu-tei.jp/sell/hocg/card/hbp08/10042) |
| hBP09-003 | OUR | `hbp09-hBP09-003_OUR` | [hbp09/10007](https://yuyu-tei.jp/sell/hocg/card/hbp09/10007) |

FUWAMOCO OSR, OUR and SEC have distinct product URLs; the SEC autograph overlay is separately confirmed. The hBP08 IRyS HR and IRyS/Mococo/Fuwawa C reprints match their hBP08 artwork, including the C_02 images; original same-number C printings keep fallback. No errata-labeled product is included. The competing before/after hBP03-027 C/S listings remain unmapped until their exact printed-text/version match is confirmed.

## Historical source audit and native fallback

An earlier local/indexed-title audit inferred eight candidates without primary artwork access. All eight remain `printingVerified: false` in `rejectedCandidates` as history. Fresh, independent paired-image evidence subsequently verified those same eight exact printings plus seven others; only the new `products` records enable links. A unique number/name/rarity candidate never proves artwork by itself.

The earlier complete primary catalog packet contains 965 deduplicated product tiles from [hBP03](https://yuyu-tei.jp/sell/hocg/s/hbp03), [hBP07](https://yuyu-tei.jp/sell/hocg/s/hbp07), [hBP08](https://yuyu-tei.jp/sell/hocg/s/hbp08) and [hBP09](https://yuyu-tei.jp/sell/hocg/s/hbp09): 234/239/245/247 rows. It was captured on 2026-10-03 06:39–06:47 UTC and verified here at 443,623 bytes / SHA-256 `7bbeae4cd0d4c81e70c6e1012dfc7d43650a88a515ca73861509025df380f9eb`. It explicitly makes no artwork-equivalence assertion, so metadata-only matches from that packet remain disabled.

The primary browser verified [native card-number search](https://yuyu-tei.jp/sell/hocg/s/search?search_word=hBP08-003), visibly returning FUWAMOCO SEC/OUR/OSR. Both platforms use the observed HTTPS `/sell/hocg/s/search` endpoint with only `search_word=<percent-encoded card number>`. Other-number/PR results, availability and current prices are not guaranteed. The [official card list](https://hololive-official-cardgame.com/cardlist/) supplies catalog identities/artwork.

Retailer page/image requests remain blocked in this executor (HTTP 403/inaccessible; ordinary Chromium source navigation also failed). No access-control bypass or alternate proxy/domain was attempted. Accepted direct mappings rely on the explicitly handed-off primary paired-image research, not local navigation fixtures or snippets.

## Baseline and preservation

The feature begins at safe recovery `e5274c52068f0d63e59cc655f4d471179d96689c`, based on true production `238915a9f71fe4158d45f8f18fad6d2af7d10aaf`, and includes deployed `release/download-1.2.7` commit `a789bcbac3f8ca5216f3188f30bb6177e97a40c9`. The draft PR targets that release branch. Stale main/reverted PR3 are not bases.

Catalog remains 1,394 card numbers / 2,981 printings. Engines, compatibility aliases, saved formats, workflow/security configuration and tags are unchanged. Published 1.2.7 metadata/release tests are byte-identical to `a789bcb`. The preservation check pins all 366 reviewed production files and recognizes exactly four added retailer runtime modules.

The private app uses byte-identical manifest bytes. Its 253 hBP09 package-local images normalize through the existing public artwork manifest, without catalog edits. All 2,981 number/ID/rarity/canonical-artwork tuples match across platforms.

## Validation

The focused evidence/import/resolver/UI/preservation suite passed 22 checks after importing all 15 mappings. It verifies normal/parallel/autograph separation, exact reprint editions, rejected historical inferences, PR/SEC/unknown IDs, URL encoding, safe external links, unchanged saved data and all 2,981 product/fallback decisions. Full `npm test` passed 11 synchronization/release checks and 4,038 regressions, plus TypeScript and the Firebase production build. The private Android counterpart passed 153 unit/UI tests, both unsigned arm64-v8a/x86_64 release builds, and lint with zero errors / 40 warnings. Final browser navigation evidence is recorded in the draft PR.

Physical-device browser handling remains unrun. Browser UI tests use external-navigation fixtures; they do not reverify source artwork or live prices. Unreviewed/ambiguous printings remain search-only. No production merge, deployment, signing, paid CI, publishing, purchasing or scraping occurred.
