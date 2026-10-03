# Yuyutei card links

Card details in the deck studio and the persistent simulator inspector now offer a compact external action. The selected stable printing ID, card number and rarity identify a curated retailer product. For example, switching hBP03-001 from OSR to OUR changes the destination from `hbp03/10001` to `hbp03/10002`.

The initial list has eight observed product URLs. All other valid card numbers show **搜尋遊遊亭**, a Google search limited to Yuyutei's Hololive sales pages with the exact card number and selected rarity. The text explicitly says the printing link is unverified and asks users to check number, rarity and artwork. Missing/invalid card numbers show an unavailable state. Unknown printing IDs never inherit a normal printing's product link.

No prices are stored, displayed, fetched or estimated. Opening the retailer page lets the user check its current price and stock.

## Public source evidence

Research date: 2026-10-03. Yuyutei's public indexed product titles distinguish set, Japanese card name, rarity and parallel status. Each row below matches exactly one official catalog printing with that set/name/rarity. This card identity match is an inference from those observed titles and the official catalog; product IDs themselves were observed in the indexed URLs, never computed from a card number or Hololens ID. Direct Yuyutei HTML requests returned HTTP 403 in this cloud environment, so current page contents, price and stock could not be rechecked automatically.

| Card number | Stable printing ID | Rarity | Observed Yuyutei sales page |
| --- | --- | --- | --- |
| hBP03-001 | 565 | OSR | [姫森ルーナ](https://yuyu-tei.jp/sell/hocg/card/hbp03/10001) |
| hBP03-001 | 678 | OUR | [姫森ルーナ parallel](https://yuyu-tei.jp/sell/hocg/card/hbp03/10002) |
| hBP03-002 | 679 | OUR | [獅白ぼたん parallel](https://yuyu-tei.jp/sell/hocg/card/hbp03/10004) |
| hBP08-001 | 2204 | OSR | [IRyS](https://yuyu-tei.jp/sell/hocg/card/hbp08/10001) |
| hBP07-002 | 1788 | OSR | [ベスティア・ゼータ](https://yuyu-tei.jp/sell/hocg/card/hbp07/10003) |
| hBP09-003 | hbp09-hBP09-003_OUR | OUR | [白銀ノエル parallel](https://yuyu-tei.jp/sell/hocg/card/hbp09/10007) |
| hBP08-018 | 2339 | UR | [ときのそら parallel](https://yuyu-tei.jp/sell/hocg/card/hbp08/10042) |
| hBP07-043 | 1954 | SR | [さくらみこ parallel](https://yuyu-tei.jp/sell/hocg/card/hbp07/10090) |

[Official Hololive card list](https://hololive-official-cardgame.com/cardlist/) supplies the card identities and artwork recorded in `lib/yuyutei-products.json`. Promo and same-rarity reprints have separate IDs and require separate verification; no promo product link is asserted from a Japanese name alone. For example, hPR-001/P uses the search fallback. An observed [Miko promo page](https://yuyu-tei.jp/sell/hocg/card/promo-100/10001) was deliberately left unmapped because the indexed range/name did not prove its exact numbered printing.

The fallback uses Google's documented [site and exact-match search operators](https://support.google.com/websearch/answer/2466433). The `/search?q=` query is percent-encoded; it is labeled as Google search, not a retailer product. Automated Google result-page requests were also blocked here; results and indexing coverage are not guaranteed. No unverified Yuyutei native search parameters are used.

## Preservation and validation

The feature branch starts at safe `recovery/production-card-refresh`, commit `e5274c52068f0d63e59cc655f4d471179d96689c`, which descends from true production `238915a9f71fe4158d45f8f18fad6d2af7d10aaf`. It also incorporates deployed `release/download-1.2.7` commit `a789bcbac3f8ca5216f3188f30bb6177e97a40c9`, a narrow follow-on that changes only download metadata and its tests. The draft PR targets that latest release branch. Stale remote `main` and the reverted PR3 engine are not bases.

Catalog data remains at 1,394 card numbers and 2,981 printings. Engine files, compatibility aliases, saved deck/collection formats, workflow/security configuration and release tags are unchanged. The published 1.2.7 download metadata and release tests are byte-identical to the latest deployed baseline. The historical preservation test recognizes exactly four new retailer modules and retains the release branch's exact approved 1.2.7 metadata hash; all 366 protected files still require their reviewed production bytes.

Validated in the saved cloud environment:

- `npm test`: 11 synchronization/release tests, 4,030 regression tests, TypeScript checking and Firebase production build passed.
- After incorporating the deployed 1.2.7 baseline, synchronization/release, preservation and retailer resolver/React UI tests, TypeScript checking and Firebase production build were rechecked. Download metadata and its release tests were compared byte-for-byte with `a789bcb`.
- Real React/DOM tests exercise normal-to-parallel selection, unmapped parallel and PR searches, safe external attributes, unchanged saved deck data, simulator selection, and compact hover previews.
- Chromium checks against the Firebase production build cover printing changes, an actual new tab with `window.opener === null`, unchanged saved draft data, 44px mobile actions, PR/SEC search labels and no page errors. Catalog/image and external navigation responses used local fixtures; this does not verify live retailer content.
- Resolver tests validate every manifest entry against the official catalog, distinguish repeated rarities/unknown IDs, check percent encoding and reject invalid numbers.
- The existing cross-platform regression expected an `android-current` checkout; a local symlink to the authorized private checkout satisfied it. No private source or fixture was copied into this repository.

No production deployment, release signing, paid CI, purchasing or price scraping was performed. Physical-device browser handling and live retailer content checks remain unrun.

To add a mapping, record an observed public product URL and evidence of the exact numbered artwork/rarity, use its existing stable printing ID, and run resolver/UI tests. Do not generate retailer IDs, reuse another printing's URL, or recapture the catalog to add links.
