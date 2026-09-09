import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { groupMemberOptions } from "../lib/member-sort.mjs";

const payload = JSON.parse(
  fs.readFileSync(new URL("../public/cards.json", import.meta.url), "utf8"),
);

test("member filter groups branches and generations in the requested order", () => {
  const groups = groupMemberOptions(payload.cards);

  assert.deepEqual(
    groups.map((group) => group.key),
    [
      "jp-0",
      "jp-1",
      "jp-2",
      "jp-gamers",
      "jp-3",
      "jp-4",
      "jp-5",
      "jp-holox",
      "jp-special",
      "dev-regloss",
      "dev-flow-glow",
      "en-myth",
      "en-promise",
      "en-advent",
      "en-justice",
      "id-1",
      "id-2",
      "id-3",
    ],
  );

  assert.equal(groups.find((group) => group.key === "jp-0").label, "JP・0期生");
  assert.equal(groups.find((group) => group.key === "dev-regloss").label, "DEV_IS・ReGLOSS");
  assert.equal(groups.find((group) => group.key === "en-myth").label, "EN・Myth（1期生）");
  assert.equal(groups.find((group) => group.key === "id-1").label, "ID・1期生");

  const options = groups.flatMap((group) => group.options);
  assert.equal(options.length, 80);
  assert.equal(new Set(options.map((option) => option.value)).size, options.length);
});

test("multi-generation units and dual-affiliation members use the intended cohort", () => {
  const groups = groupMemberOptions(payload.cards);
  const valuesFor = (key) => groups.find((group) => group.key === key).options.map((option) => option.value);

  assert.ok(valuesFor("jp-1").includes("白上フブキ"));
  assert.ok(!valuesFor("jp-gamers").includes("白上フブキ"));
  assert.ok(valuesFor("jp-special").includes("ラムダック"));
  assert.ok(valuesFor("en-myth").includes("森カリオペ"));
  assert.ok(valuesFor("id-3").includes("こぼ・かなえる"));
});
