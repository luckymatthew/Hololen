# Card Studio redesign

The catalogue is now the default working surface. In-page navigation switches to
the complete deck builder without clearing draft, filters, or printing choices.
Cloud deck links still open the builder. Saved decks, export/import, scanner and
simulator links are preserved; simulator board geometry and rules are untouched.

- Navy/pearl surfaces, cyan accents, matched light/dark/system themes.
- Gallery and effect-list modes; compact type tabs, expandable advanced filters,
  individually removable filter chips and sorting.
- Pre-indexed Chinese/Japanese/English card text; NFKC normalization and AND-term
  search. Deferred search rendering and `/` keyboard shortcut outside form fields.
- Native modal detail reader for focus containment, Escape and return focus.
  Chinese effects use 16px-equivalent text with 1.9 line height. On phones, the
  art is compact and non-sticky so it does not cover the effect text.
- Browser zoom enabled. Two-column phone gallery, one-column effect list, wrapped
  controls and touch-sized buttons. Subtle interaction animation with reduced-
  motion support; no constantly looping foil effects in the catalogue.
- Shared saved-deck and scanner surface styles; OCR preparation unchanged.

Validation: production build, server-rendered HTML assertions, catalogue-search,
scanner/OCR and existing deck/simulator regression suites. No browser or real-device
visual testing performed in this change. Existing unrelated TypeScript diagnostics
remain in account/simulator/Cloudflare declarations.
