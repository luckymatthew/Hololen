# HoloLens — product context

Hololive OCG Traditional Chinese reference, deck-building and private battle practice website for players and collectors. The useful object is the actual card and its printing, not dashboard statistics or a marketing landing page.

## User outcomes
- Find a card by member, number, type, stage, set or effect; inspect its real artwork and rules text.
- Allocate specific printings to a 1 / 50 / 20 deck; preserve drafts, save locally or synchronize, import and export JSON.
- Manage saved or archived decks, backup and restore, and keep account ownership separated.
- Prepare a private room or single-player practice with the existing engine and explicit unsupported-effect warnings.
- Access the existing Android release downloads and inspect dated, source-backed website/card updates.

## Non-negotiables
Traditional Chinese/Cantonese UI, literal official Japanese fallback for unreviewed imported effects, actual artwork, stable card/printing IDs, deck storage and compatibility projection, authentication, Firebase synchronization and rules, API/download endpoints, simulator action legality and game resolution remain intact. A UI refresh does not validate or implement card effects. No Android changes.

## Usage and constraints
Responsive desktop and portrait phone use; touch, keyboard and screen reader operation; light/dark/system appearance; reduced motion; no decorative animation that delays play or obscures legal actions. Active-match geometry and scrolling lock must remain unchanged. New releases must not reload an ongoing match or edit.
