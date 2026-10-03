# Primary-browser evidence handoff

The coding environment does not share the parent's Dot browser or its open tabs. Primary records must be handed off explicitly. Existing eight rejected candidates remain disabled until fresh records prove their exact printing.

Supply a JSON array (or an object with `records`) with these fields for each standard product:

| Field | Required evidence |
| --- | --- |
| `url` | Actual canonical HTTPS Yuyutei product URL from the open primary page; no generated IDs, `/damage`, query or fragment |
| `number` | Card number displayed on that primary page, preserving canonical case |
| `rarity` | Displayed rarity for that product, such as OSR, OUR, UR, C or P |
| `title` | Primary product heading beginning with the observed rarity and containing the Japanese card name, retaining parallel/reprint labels |
| `retailerImage` | Actual front artwork URL from that page/tile, HTTPS without credentials |
| `officialImage` or `printingId` | Exact catalog artwork compared with the retailer art, or the existing stable printing ID whose artwork was compared; both may be supplied and must agree |
| `artworkConfirmed` | `true` only after that comparison, including edition/parallel/promo distinctions |
| `method` | `primary-browser`; indexed search results are insufficient |
| `observedAt` | ISO timestamp including timezone, preferably UTC |
| `reference` | Public primary-browser evidence reference: saved DOM excerpt, screenshot or recorded observation; no cookies, tokens, private source or browser credentials |
| `retailerSet`, `editionLabel` | Preserve the observed set and full reprint label when present, especially `(パラレル/hBP08)` |
| `errataConfirmed`, `errataVersion` | For an errata-labeled product, separately compare the printed text and provide `true` plus `before` or `after`; matching the illustration alone is insufficient |

Prices and stock are unnecessary and are not persisted. Product titles/images must describe the standard product; damaged-stock listings are excluded.

## Catalog constraints

- The preserved catalog has 1,394 card numbers / 2,981 printings and **191 repeated number/rarity pairs**. Number+rarity alone cannot select a printing.
- Number+rarity+exact official image currently identifies one printing for every existing variant. A stable ID must already belong to that numbered card and match the observed rarity.
- The private offline catalog stores its hashed local WebP path in `image` and the canonical official URL in `sourceImage`. Cross-platform evidence checks use that canonical URL; local asset paths never identify a retailer edition.
- 253 packaged hBP09 variants lack `sourceImage`; the shared manifest's `artworkSources` uses the existing public hBP09 art manifest to normalize them. All 2,981 number/ID/rarity/canonical-artwork tuples match across platforms after this lookup, without editing either catalog.
- hBP08 contains 23 catalog artwork variants on older card numbers. A `/card/hbp08/...` product must match the hBP08 artwork edition, not the original-number booster. The validator and both platform resolvers check this booster/artwork-directory agreement.
- Example: hBP01-028 C has original and hBP08 reprint variants; hBP08 C uses stable ID `2314` and `hBP08/hBP01-028_C_02.png`. Do not select the first C printing.
- hBP08-003 FUWAMOCO OSR uses existing ID `2206`; its SEC/OUR IDs are `2326`/`2333`. The reported product URL alone does not enable these mappings before artwork evidence arrives.
- Duplicate printing keys or reused retailer URLs fail the batch. No damaged-page or other-print price is inherited.
- The primary packet contains competing before/after-errata products for hBP03-027 C (`591`) and S (`709`). These four URLs cannot all map to the same two stable IDs. Exact printed-text evidence must select the corresponding version.

## Batch consumption

From the website checkout, run:

```sh
node scripts/validate-yuyutei-evidence.mjs /tmp/public-browser-records.json /tmp/yuyutei-products-preview.json
```

This command reads the existing catalog, derives existing stable IDs and produces a deterministic `products` preview. It performs no fetch, catalog recapture or production write. Incomplete, contradictory or ambiguous records fail with the record number and reason.

After evidence review, merge only validated products into the public manifest, preserve the rejection history, and copy the exact manifest bytes into the private app asset. Compare both catalogs' number/ID/rarity/image tuples before import. Unconfirmed records stay search-only. Both runtime resolvers require matching primary evidence, artwork, rarity, URL and provenance, so a bare record placed in `products` cannot enable a link.

Native fallback has now been confirmed by the parent: `https://yuyu-tei.jp/sell/hocg/s/search?search_word=hBP08-003` displayed FUWAMOCO SEC/OUR/OSR. Both platforms use this actual card-number query and ask users to select the matching printing. It is not rarity-specific, and no extra filter parameter is inferred. Further normal/PR query results and the saved primary artifact can extend the evidence register without changing the observed endpoint.
