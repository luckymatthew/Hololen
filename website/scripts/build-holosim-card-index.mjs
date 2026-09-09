import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);
const cardsSource = process.argv[2];
const outputFile = process.argv[3] || path.resolve("public/holosim-card-index.json");

if (!cardsSource) {
  throw new Error("Usage: node scripts/build-holosim-card-index.mjs <HoloSim Cards directory or ZIP> [output file]");
}

const sourceStats = await stat(cardsSource);
let cardFilenames;

if (sourceStats.isDirectory()) {
  const files = await readdir(cardsSource, { withFileTypes: true });
  cardFilenames = files.filter((file) => file.isFile()).map((file) => file.name);
} else if (sourceStats.isFile() && path.extname(cardsSource).toLowerCase() === ".zip") {
  const { stdout } = await execFileAsync("unzip", ["-Z1", cardsSource], { maxBuffer: 16 * 1024 * 1024 });
  cardFilenames = stdout
    .split(/\r?\n/)
    .filter((name) => /(?:^|\/)Cards\/[^/]+\.png$/i.test(name))
    .map((name) => path.basename(name));
} else {
  throw new Error("HoloSim card source must be a Cards directory or ZIP archive");
}

const variants = {};

for (const filename of cardFilenames) {
  const match = filename.match(/^(h[A-Za-z0-9]+-\d+)_([0-9]+)\.png$/i);
  if (!match) continue;
  const [, number, suffix] = match;
  (variants[number] ??= []).push(`${number}_${suffix}`);
}

for (const values of Object.values(variants)) {
  values.sort((left, right) => {
    const leftSuffix = Number(left.match(/_(\d+)$/)?.[1] ?? 0);
    const rightSuffix = Number(right.match(/_(\d+)$/)?.[1] ?? 0);
    return leftSuffix - rightSuffix;
  });
}

const sorted = Object.fromEntries(
  Object.entries(variants).sort(([left], [right]) => left.localeCompare(right, "en", { numeric: true })),
);

await writeFile(outputFile, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
console.log(`Wrote ${Object.keys(sorted).length} HoloSim card ids to ${outputFile}`);
