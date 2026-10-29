# HoloLens — collectible workbench

Editable Figma system: https://www.figma.com/design/CkkImhoIVG5oxaZNuSj43E

## Visual thesis
A quiet collector's workbench: warm paper surrounds real card artwork, navy carries hierarchy, cyan identifies selection and action. Controls recede while card numbers, printing distinctions and rules remain easy to scan. This is an Operate surface; the update log is Read mode. No giant marketing hero, ornamental metrics, gradient text or looping foil wall.

## Tokens
Source of truth: `app/design-system.css`.
Light: page #F6F5F0, white surface, secondary #EFEFEA, text #122737, muted #586974, line #D9E0E1, cyan #0EADC5, functional cyan #08788A, soft cyan #E2F6F8.
Dark: page #101C25, surface #172A36, secondary #1E3340, text #EAF2F3, muted #A8BAC3, line #35505F, cyan #43C9DA, functional cyan #70D7E4, selected #183E4B.
Semantic success, warning, error and focus colors have paired backgrounds and do not rely on color alone. White text is not placed on bright cyan.

System CJK family: Noto Sans TC / Noto Sans CJK TC / platform UI sans; no new font download or dependency. Type scale 12, 13, 14, 16, 18, 20, 24, 28, 32; display 40/48 only on the download/lobby introduction. Card numbers and counts use tabular numerals; monospace is limited to identifiers/code.

Spacing base 4/8px with 12/16/20/24/28/32 group intervals. Controls radius 8–10px, content panels 12px, overlays 16–20px. Border or elevation conveys a surface, not a heavy nested-card treatment.

## Layout
Shared compact navigation; content max-width 1440px. Search and type controls precede the working collection. Desktop filters occupy a 256px rail (230px at medium widths), collapsed to an inline disclosure on narrow screens. Artwork grid is 5/4/3/2 columns according to available width. Gallery hides repeated long descriptions, while list view brings them back. Single clear detail action per card plus adjacent quantity controls.

Deck workspace uses artwork sections and a 320px action rail, falling below content on tablets/phones. Account and download content have consistent gutters, clear primary tasks and deliberate empty/error states. Simulator lobby shares the language; active-match board geometry, action hooks and full-viewport control system are preserved.

## Motion thesis
The focal interaction is opening the card reader: selected artwork enters a protected native dialog, variant selection is immediate, and fast dismissal returns focus to its exact trigger. Shared segmented controls slide their selected surface; filters expand/collapse as a single disclosure; saved/failed actions produce readable status. Match movement remains the existing engine-derived presentation, not new invented game animations.

Selected free Transitions.dev recipes: modal 250ms open / 150ms close, tabs 250ms, accordion 250ms, toast 350ms in / 250ms out. `app/motion.css` preserves recipe selectors and reduced-motion guards. Native selects, browser focus semantics and fallback paths remain. Reduced motion disables spatial movement and loops while retaining final states and readable feedback.

## Accessibility and states
44px standard touch and quantity controls; visible 3px focus; native dialog focus scope and explicit restoration; labeled inputs; no offscreen focus within collapsed filters; close/cancel and repeated opening tested. Loaders do not conceal recovery controls. Imported-card warnings, preview release dates and printing choices remain explicit. Update-log table is keyboard-scrollable and distinguishes card IDs from new artwork for existing IDs.
