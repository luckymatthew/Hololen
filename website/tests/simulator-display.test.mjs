import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { displayedBatonCost, suuBatonIncrease } from "../lib/simulator/display.mjs";
import { revealedCardNumbers } from "../lib/simulator/reveals.mjs";

const simulatorCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const simulatorSource = readFileSync(new URL("../app/simulator/SimulatorClient.tsx", import.meta.url), "utf8");
const foilSource = readFileSync(new URL("../app/FoilCardImage.tsx", import.meta.url), "utf8");

test("compact simulator views hide card captions without hiding foil card artwork", () => {
  assert.match(simulatorCss, /\.sim-card-face\.small > span:not\(\.foil-card-surface\)/);
  assert.match(simulatorCss, /\.sim-hand-panel \.sim-card-face > span:not\(\.foil-card-surface\)/);
  assert.match(simulatorCss, /\.sim-motion-card-side \.sim-card-face > span:not\(\.foil-card-surface\)/);
  assert.doesNotMatch(simulatorCss, /\.sim-card-face\.small > span\s*\{\s*display:\s*none/);
});

test("stage cards keep large artwork and place live information beside it", () => {
  assert.match(simulatorSource, /sim-stage-content/);
  assert.match(simulatorSource, /className="sim-stage-side"/);
  assert.match(simulatorSource, /應援 \{art\.cost\.length\}/);
  assert.match(simulatorCss, /\.sim-stage-content \{[^}]*grid-template-columns:/);
  assert.match(simulatorCss, /\.sim-stage-visual > \.sim-card-face > span:not\(\.foil-card-surface\) \{ display: none;/);
});

test("front artwork centers on the same column as Back 1, 3 and 5 without counting side information", () => {
  assert.match(simulatorCss, /\.sim-match-active \.sim-front-zone \.sim-stage-content:not\(\.compact\) \{[^}]*grid-template-columns: minmax\(0, 1fr\);[^}]*place-items: center;/);
  assert.match(simulatorCss, /\.sim-match-active \.sim-front-zone \.sim-stage-visual \{ justify-self: center; \}/);
  assert.match(simulatorCss, /\.sim-match-active \.sim-front-zone \.sim-stage-side \{[^}]*position: absolute;[^}]*left: calc\(50% \+ var\(--sim-stage-half-card-width\) \+ 7px\)/);
  assert.match(simulatorCss, /\.sim-match-active \.sim-board\.opponent \.sim-front-zone \.sim-stage-side \{[^}]*right: calc\(50% \+ var\(--sim-stage-half-card-width\) \+ 7px\)/);
});

test("hand overlays the table transparently without reserving board space", () => {
  assert.match(simulatorCss, /\.sim-status-playing \.sim-hand-panel,[\s\S]*?position: absolute;[\s\S]*?background: color-mix\(in srgb, var\(--surface\) 72%, transparent\)/);
  assert.doesNotMatch(simulatorCss, /\.sim-game-shell\.hand-open \.sim-board\.own/);
});

test("Back row labels have reserved space and duplicate card captions stay hidden", () => {
  assert.match(simulatorCss, /\.sim-stage-card-inspect \.sim-card-face > span:not\(\.foil-card-surface\) \{ display: none; \}/);
  assert.match(simulatorCss, /\.sim-stage-card\.selectable\.occupied \.sim-card-control-frame > \.sim-stage-card-inspect \.sim-card-face/);
  assert.match(simulatorSource, /\{compact && unit && <ResponsiveZoneLabel className="sim-card-zone-label" label=\{label\} \/>\}/);
  assert.match(simulatorCss, /\.sim-stage-card\.compact \{[^}]*padding-top: 22px;/);
  assert.match(simulatorCss, /\.sim-stage-card\.compact > \.sim-card-zone-label \{[^}]*top: 3px;[^}]*font-weight: 900;/);
});

test("front Holomem details use the full zone height and spaced two-column stats", () => {
  assert.match(simulatorCss, /\.sim-front-zone \.sim-stage-content:not\(\.compact\) \{[^}]*height: 100%;/);
  assert.match(simulatorCss, /\.sim-front-zone \.sim-stage-side \{[^}]*max-height: calc\(100% - 12px\);/);
  assert.match(simulatorCss, /\.sim-front-zone \.sim-unit-stats \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
});

test("ordinary card movement is direct while reveals stay non-blocking and visible to both players", () => {
  assert.match(simulatorCss, /84% \{ opacity: 1; transform: translate3d\(var\(--motion-x2\), var\(--motion-y2\)/);
  assert.match(simulatorSource, /const \[revealQueue, setRevealQueue\]/);
  assert.match(simulatorSource, /const animationBusy = Boolean\(activeMotion\) \|\| motionQueue\.length > 0;/);
  assert.match(simulatorSource, /const revealBatches = batches\.filter\(\(batch\) => batch\.events\.every\(\(event\) => event\.kind === "reveal"\)\);/);
  assert.match(simulatorSource, /REVEAL TO BOTH PLAYERS/);
  assert.doesNotMatch(simulatorSource, /event\.from\.playerIndex !== viewerIndex/);
  assert.match(simulatorSource, /確認前卡片會留在中央；對局及 AI 行動不會暫停/);
  assert.doesNotMatch(simulatorSource, /const animationBusy = [^;]*revealQueue/);
});

test("room synchronization passes card data into the motion builder instead of crashing after hydration", () => {
  assert.match(simulatorSource, /function buildMotionEvents\(previous: RoomState, next: RoomState, cards: CardInfo\[\], viewerIndex: number\)/);
  assert.match(simulatorSource, /buildMotionEvents\(previous\.state, room\.state, cards, viewerIndex\)/);
});

test("foil shimmer is passive and setup cards fit in a centered horizontal tray", () => {
  assert.doesNotMatch(foilSource, /onPointerMove|onPointerDown|--foil-x|--foil-y/);
  assert.match(simulatorCss, /\.sim-status-setup \.sim-opening-hand \{[^}]*display: flex;[^}]*overflow-y: hidden;/);
  assert.match(simulatorCss, /\.sim-status-setup \.sim-hand-panel \{[^}]*position: fixed;[^}]*top: 50%;[^}]*backdrop-filter: blur/);
  assert.match(simulatorSource, /className="sim-hand-toggle"/);
  assert.match(simulatorSource, /className="sim-hand-reopen"/);
});

test("all effect choices float in the center and can be temporarily minimized", () => {
  assert.match(simulatorCss, /\.sim-match-active \.sim-action-dock \{[^}]*position: fixed;[^}]*top: 50%;[^}]*transform: translate\(-50%, -50%\)/);
  assert.match(simulatorSource, /className="sim-panel-minimize"/);
  assert.match(simulatorSource, /className="sim-choice-reopen"/);
});

test("reveal fallback accepts card codes only and never guesses from duplicate names", () => {
  const cards = [
    { number: "hBP06-084", name: "AIこより", jpName: "AIこより" },
    { number: "hY04-001", name: "藍色應援", jpName: "青エール" },
  ];
  assert.deepEqual(revealedCardNumbers("AIこより · EXPERT在應援步驟公開藍色應援。", cards), []);
  assert.deepEqual(revealedCardNumbers("AIこより · EXPERT公開 hBP06-084、hY04-001。", cards), ["hBP06-084", "hY04-001"]);
});

test("reveal parsing preserves repeated copies instead of collapsing them", () => {
  const cards = [{ number: "hEB01-020", name: "博衣小夜璃", jpName: "博衣こより" }];
  assert.deepEqual(revealedCardNumbers("展示 「博衣小夜璃」（hEB01-020）、「博衣小夜璃」（hEB01-020）。", cards), ["hEB01-020", "hEB01-020"]);
});

test("log and reveal UI use immutable event snapshots with card code and rarity labels", () => {
  assert.match(simulatorSource, /revealRefs\?: CardInstance\[\]/);
  assert.match(simulatorSource, /Array\.isArray\(entry\.revealRefs\)/);
  assert.match(simulatorSource, /cardPrintingLabel\(instance, cardMap\)/);
  assert.match(simulatorSource, /sim-log-card-code/);
  assert.doesNotMatch(simulatorSource, /collectLogInstances/);
  assert.doesNotMatch(simulatorSource, /revealedCardNumbers/);
  assert.doesNotMatch(simulatorSource, /parsed-\$\{entry\.id\}/);
});

test("desktop table uses five shared stage columns with Oshi Power attached", () => {
  assert.match(simulatorCss, /@media \(pointer: fine\), \(min-device-width: 760px\)/);
  assert.match(simulatorCss, /grid-template-columns: minmax\(72px, \.56fr\) repeat\(5, minmax\(0, 1fr\)\) minmax\(72px, \.56fr\)/);
  assert.match(simulatorCss, /--sim-stage-card-width: var\(--sim-locked-stage-card-width, 104px\)/);
  assert.match(simulatorCss, /--sim-stage-half-card-width: calc\(var\(--sim-stage-card-width\) \/ 2\)/);
  assert.match(simulatorCss, /"life collab \. center \. oshi-power deck"/);
  assert.match(simulatorCss, /"deck oshi-power \. center \. collab life"/);
  assert.match(simulatorSource, /sim-oshi-attached-power[^\n]*data-pile="power"/);
  assert.doesNotMatch(simulatorSource, /<TablePile area="power"/);
});

test("browser zoom is inverse-compensated against a stable 100 percent canvas", () => {
  assert.match(simulatorSource, /const referenceWidth = Math\.max\(320, window\.outerWidth \|\| window\.screen\.availWidth \|\| viewportWidth\)/);
  assert.match(simulatorSource, /transform: `scale\(\$\{lockedCanvas\.scale\}\)`/);
  assert.match(simulatorSource, /data-canvas-scale=\{lockedCanvas\?\.scale\}/);
  assert.match(simulatorSource, /rect\.width \/ 2\) \/ canvasScale - cardWidth \/ 2/);
  assert.match(simulatorSource, /sim-match-active sim-zoom-locked/);
  assert.match(simulatorCss, /\.sim-match-active\.sim-zoom-locked \{[^}]*position: fixed;[^}]*transform-origin: left top;/);
  assert.match(simulatorCss, /\.sim-match-active \.sim-game-shell \{[^}]*width: calc\(100% - 12px\);/);
});

test("back row is artwork-first and mobile Holomen expose a live status control", () => {
  assert.match(simulatorSource, /compact\s+turn=\{turn\}/);
  assert.match(simulatorSource, /className="sim-stage-card-inspect"/);
  assert.match(simulatorSource, /aria-label=\{`查看\$\{effectText\(card, card\.name\)\}完整狀態`\}>狀態<\/button>/);
  assert.match(simulatorSource, /liveState=\{inspectedLiveState\}/);
  assert.match(simulatorSource, /playerIndex: liveReference\.playerIndex/);
  assert.match(simulatorSource, /hostNumber: hostCard\?\.number/);
  assert.match(simulatorSource, /inspectorMode = inspectingLiveHolomem \? "HOLOMEM STATUS" : liveState\?\.hostName \? "ATTACHED CARD" : "CARD EFFECT"/);
  assert.match(simulatorCss, /\.sim-card-inspector \{[^}]*left: 16px;[^}]*right: auto/);
});

test("hover card inspector uses readable typography for card details and effects", () => {
  assert.match(simulatorCss, /\.sim-inspector-head h2 \{[^}]*font-size: 32px;/);
  assert.match(simulatorCss, /\.sim-inspector-head code \{[^}]*font-size: 15px;/);
  assert.match(simulatorCss, /\.sim-inspector-live-grid > span \{[^}]*font-size: 13px;/);
  assert.match(simulatorCss, /\.sim-inspector-live-grid b \{[^}]*font-size: 16px;/);
  assert.match(simulatorCss, /\.sim-inspector-copy p \{[^}]*font-size: 15px;/);
});

test("portrait mobile mode uses a fixed viewport table without changing desktop layout", () => {
  assert.match(simulatorCss, /\.sim-match-active\.sim-zoom-locked \{[\s\S]*?position: fixed !important;[\s\S]*?height: 100dvh !important;/);
  assert.match(simulatorCss, /height: calc\(100dvh - var\(--sim-mobile-topbar-height\) - env\(safe-area-inset-bottom, 0px\)\) !important;/);
  assert.doesNotMatch(simulatorCss, /height: calc\(100dvh - 56px - clamp\(96px, 18dvh, 128px\)/);
  assert.match(simulatorCss, /--sim-stage-card-width: clamp\(42px, 14vw, 64px\);/);
  assert.match(simulatorCss, /grid-template-columns: clamp\(34px, 9\.5vw, 40px\) repeat\(5, minmax\(0, 1fr\)\) clamp\(34px, 9\.5vw, 40px\)/);
  assert.match(simulatorCss, /"life collab \. center \. oshi-power deck"/);
  assert.match(simulatorCss, /--sim-pile-card-width: clamp\(28px, 8\.5vw, 36px\);[\s\S]*?\.sim-match-active \.sim-board\.opponent \.sim-table-layout \{[\s\S]*?"archive back back back back back cheer"[\s\S]*?"deck oshi-power \. center \. collab life";/);
  assert.match(simulatorCss, /\.sim-match-active \.sim-front-zone \.sim-stage-side \{ display: none; \}/);
  assert.match(simulatorCss, /\.sim-status-playing \.sim-hand-panel,[\s\S]*?position: fixed !important;/);
  assert.match(simulatorCss, /html:has\(\.sim-match-active\),[\s\S]*?overflow: hidden;/);
  assert.match(simulatorCss, /html\.sim-match-viewport-lock,[\s\S]*?overscroll-behavior: none;/);
  assert.match(simulatorCss, /\.sim-match-active \.sim-table-scroll \{ height: 100%; min-height: 0; margin: 0; overflow: hidden; padding: 0; \}/);
  assert.match(simulatorSource, /sim-match-viewport-lock/);
  assert.match(simulatorSource, /className="sim-mobile-card-effect"/);
  assert.match(simulatorSource, /className="sim-mobile-card-effect sim-mobile-hand-effect"/);
  assert.match(simulatorSource, /mobileInterfaceQuery/);
  assert.match(simulatorSource, /mobileInterface \? undefined : cardMap\.get/);
  assert.match(simulatorCss, /\.sim-match-active \.sim-oshi-power-zone \{[^}]*grid-area: oshi-power;[^}]*display: grid;/);
  assert.match(simulatorCss, /\.sim-card-inspector\.hover-preview \{ display: none !important; \}/);
  assert.match(simulatorCss, /\.sim-card-inspector \.sim-inspector-live-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(simulatorSource, /const inspectorMode = inspectingLiveHolomem \? "HOLOMEM STATUS" : liveState\?\.hostName \? "ATTACHED CARD" : "CARD EFFECT"/);
  assert.match(simulatorSource, /mobileStatus=\{mobileInterface\}/);
  assert.match(simulatorSource, /mobileStatus \? \{ \.\.\.cardReference, playerIndex, zone, location \} : cardReference/);
  assert.match(simulatorSource, /className="sim-mobile-card-actions"/);
  assert.match(simulatorSource, /className="sim-mobile-action-layer"/);
  assert.match(simulatorSource, /className="sim-card-control-frame"/);
  assert.match(simulatorSource, /className="sim-card-control-frame sim-oshi-control-frame"/);
  assert.match(simulatorSource, /className="sim-label-mobile"/);
  assert.match(simulatorCss, /\.sim-label-desktop \{ display: none; \}[\s\S]*?\.sim-label-mobile \{ display: inline; \}/);
  assert.doesNotMatch(simulatorCss, /\.sim-stage-card\.has-mobile-actions \{ padding-bottom:/);
  assert.match(simulatorCss, /\.sim-mobile-action-sheet \.sim-unit-actions button,[\s\S]*?min-height: 44px;/);
  assert.match(simulatorCss, /\.sim-match-active \.sim-stage-card\.compact \.sim-compact-controls \{ display: none; \}/);
});

test("mobile front Holomen expose exact attached cards without colliding with labels", () => {
  assert.match(simulatorSource, /className="sim-front-mobile-under"/);
  assert.match(simulatorSource, /查看附加卡[\s\S]*?onInspect\?\.\(instance\)/);
  assert.match(simulatorSource, /onInspect\?\.\(unit\.stack\[unit\.stack\.length - 1\]\)/);
  assert.match(simulatorCss, /\.sim-front-mobile-under \{ display: none; \}/);
  assert.match(simulatorCss, /\.sim-match-active \.sim-front-mobile-under \{[^}]*bottom: -17px;[^}]*display: block;/);
  assert.match(simulatorCss, /\.sim-mobile-card-effect \{ right: 1px; top: 1px; \}/);
  assert.match(simulatorCss, /\.sim-card-control-frame > \.sim-mobile-card-effect \{ right: 2px; top: 2px; \}/);
  assert.match(simulatorCss, /writing-mode: horizontal-tb;/);
  assert.match(simulatorCss, /\.sim-match-active \.sim-player-line \{[^}]*display: flex;[^}]*justify-content: space-between;/);
  assert.match(simulatorCss, /\.sim-match-active \.sim-hand-count \{[^}]*margin-top: 0;/);
});

test("phase advance lives beside the phase label and hand is open by default", () => {
  assert.match(simulatorSource, /const \[handOpen, setHandOpen\] = useState\(true\)/);
  assert.match(simulatorSource, /className="sim-turn-phase"/);
  assert.match(simulatorSource, /className="sim-turn-advance"/);
  assert.doesNotMatch(simulatorSource, /className="sim-phase-actions"/);
});

test("card art falls back through variants and same-colour Cheer instead of disappearing", () => {
  assert.match(foilSource, /fallbackSrc\?: string \| string\[\]/);
  assert.match(foilSource, /index < sources\.length - 1 \? \{ key: sourceKey, index: index \+ 1 \}/);
  assert.match(simulatorSource, /const sameColorCheer = card\.group === "cheer"/);
  assert.match(simulatorSource, /fallbackSrc=\{fallbackImages\}/);
});

test("Suu attachments on Center and Collab increase only the opponent Center Baton display", () => {
  const cards = new Map([
    ["suu", { number: "suu", name: "水宮樞", jpName: "水宮枢" }],
    ["other", { number: "other", name: "其他 Holomen" }],
  ]);
  const unit = (number, attachments) => ({ stack: [{ id: number, number }], attachments: attachments.map((id) => ({ id, number: "hBP08-104" })) });
  const player = { zones: { center: unit("suu", ["a"]), collab: unit("suu", ["b", "c"]), back1: unit("other", ["d"]) } };
  assert.equal(suuBatonIncrease(player, cards), 3);
});

test("Baton display combines live modifiers and attachment reductions, excluding expired modifiers", () => {
  const korone = { name: "戌神沁音", jpName: "戌神ころね", baton: 2 };
  const unit = {
    attachments: [{ id: "fan", number: "hBP03-111" }],
    modifiers: [
      { kind: "batonCost", amount: 3, expiresTurn: 7 },
      { kind: "batonCost", amount: 9, expiresTurn: 6 },
    ],
  };
  assert.equal(displayedBatonCost(korone, unit, 7, 2), 6);
});
