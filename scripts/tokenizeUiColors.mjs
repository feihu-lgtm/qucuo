import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const sourceRoots = ["src/ui", "src/app"];
const tokenColors = {
  "--bg": ["#0a0a09", "#eae7dd"],
  "--bg-panel": ["#111110", "#f4f2e9"],
  "--border": ["#4a453c", "#2a2620"],
  "--text": ["#e8e4d6", "#201d18"],
  "--text-dim": ["#8f8a7c", "#6d6759"],
  "--accent": ["#c8323a", "#a8202a"],
  "--accent-dim": ["#8a4a48", "#8a4a42"],
  "--good": ["#5a8a5a", "#2e5a2e"],
  "--warn": ["#d4a853", "#7a5c14"],
  "--info": ["#8ac8b8", "#1e4a6a"],
  "--muted": ["#8a8270", "#5a5448"],
};
const nearDuplicateTokens = {
  "#161510": "--bg-panel",
  "#4a4436": "--border",
  "#ece3d0": "--text",
  "#12100a": "--bg-panel",
  "#8a8478": "--text-dim",
  "#8a8578": "--text-dim",
  "#a02020": "--accent",
  "#e0b060": "--warn",
  "#f0e8d8": "--text",
  "#120e0a": "--bg-panel",
  "#14100a": "--bg-panel",
  "#e8e0d0": "--text",
  "#f7f2e8": "--bg-panel",
  "#fffdf6": "--bg-panel",
};
const unusedNearDuplicates = ["#2a2419", "#1c1a15", "#26221c", "#f2efe4", "#7a7060"];
const hexPattern = /#[\da-f]{3,8}\b/gi;

function filesUnder(root, output = []) {
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) filesUnder(path, output);
    else if (/\.(js|jsx|css)$/.test(name)) output.push(path);
  }
  return output;
}

function targetFiles() {
  return sourceRoots.flatMap(root => filesUnder(root)).filter(path =>
    path.endsWith(".js") || path.endsWith(".jsx"),
  ).filter(path =>
    !path.endsWith("/theme.js") && !/\.test\.(js|jsx)$/.test(path),
  );
}

function rgbToLab(hex) {
  const rgb = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = rgb.map(value =>
    value > 0.04045 ? ((value + 0.055) / 1.055) ** 2.4 : value / 12.92,
  );
  const x = (linear[0] * 0.4124564 + linear[1] * 0.3575761 + linear[2] * 0.1804375) / 0.95047;
  const y = linear[0] * 0.2126729 + linear[1] * 0.7151522 + linear[2] * 0.072175;
  const z = (linear[0] * 0.0193339 + linear[1] * 0.119192 + linear[2] * 0.9503041) / 1.08883;
  const f = value => value > 0.008856451679
    ? Math.cbrt(value)
    : 7.787037037 * value + 16 / 116;
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE2000(first, second) {
  const [l1, a1, b1] = rgbToLab(first);
  const [l2, a2, b2] = rgbToLab(second);
  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const cBar = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt(cBar ** 7 / (cBar ** 7 + 25 ** 7)));
  const aPrime1 = (1 + g) * a1;
  const aPrime2 = (1 + g) * a2;
  const cPrime1 = Math.hypot(aPrime1, b1);
  const cPrime2 = Math.hypot(aPrime2, b2);
  const hPrime1 = (Math.atan2(b1, aPrime1) * 180 / Math.PI + 360) % 360;
  const hPrime2 = (Math.atan2(b2, aPrime2) * 180 / Math.PI + 360) % 360;
  const deltaL = l2 - l1;
  const deltaC = cPrime2 - cPrime1;
  let deltaHue;
  if (cPrime1 * cPrime2 === 0) deltaHue = 0;
  else if (Math.abs(hPrime2 - hPrime1) <= 180) deltaHue = hPrime2 - hPrime1;
  else if (hPrime2 <= hPrime1) deltaHue = hPrime2 - hPrime1 + 360;
  else deltaHue = hPrime2 - hPrime1 - 360;
  const deltaH = 2 * Math.sqrt(cPrime1 * cPrime2) * Math.sin(deltaHue * Math.PI / 360);
  const lBar = (l1 + l2) / 2;
  const cPrimeBar = (cPrime1 + cPrime2) / 2;
  let hPrimeBar;
  if (cPrime1 * cPrime2 === 0) hPrimeBar = hPrime1 + hPrime2;
  else if (Math.abs(hPrime1 - hPrime2) <= 180) hPrimeBar = (hPrime1 + hPrime2) / 2;
  else if (hPrime1 + hPrime2 < 360) hPrimeBar = (hPrime1 + hPrime2 + 360) / 2;
  else hPrimeBar = (hPrime1 + hPrime2 - 360) / 2;
  const t = 1
    - 0.17 * Math.cos((hPrimeBar - 30) * Math.PI / 180)
    + 0.24 * Math.cos(2 * hPrimeBar * Math.PI / 180)
    + 0.32 * Math.cos((3 * hPrimeBar + 6) * Math.PI / 180)
    - 0.20 * Math.cos((4 * hPrimeBar - 63) * Math.PI / 180);
  const deltaTheta = 30 * Math.exp(-(((hPrimeBar - 275) / 25) ** 2));
  const rC = 2 * Math.sqrt(cPrimeBar ** 7 / (cPrimeBar ** 7 + 25 ** 7));
  const sL = 1 + 0.015 * (lBar - 50) ** 2 / Math.sqrt(20 + (lBar - 50) ** 2);
  const sC = 1 + 0.045 * cPrimeBar;
  const sH = 1 + 0.015 * cPrimeBar * t;
  const rT = -Math.sin(2 * deltaTheta * Math.PI / 180) * rC;
  const lTerm = deltaL / sL;
  const cTerm = deltaC / sC;
  const hTerm = deltaH / sH;
  return Math.sqrt(lTerm ** 2 + cTerm ** 2 + hTerm ** 2 + rT * cTerm * hTerm);
}

const exactTokens = new Map();
for (const [token, colors] of Object.entries(tokenColors)) {
  for (const color of colors) exactTokens.set(color, token);
}
for (const [color, token] of Object.entries(nearDuplicateTokens)) {
  const distances = tokenColors[token].map(value => deltaE2000(color, value));
  if (Math.min(...distances) >= 3) throw new Error(`${color} is not within ΔE00 < 3 of ${token}`);
}

function colorCounts(files) {
  const colors = new Set();
  for (const file of files) {
    for (const color of readFileSync(file, "utf-8").match(hexPattern) || []) {
      colors.add(color.toLowerCase());
    }
  }
  return colors.size;
}

function replaceColors(source, totals) {
  return source.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, literal =>
    literal.replace(hexPattern, color => {
      const normalized = color.toLowerCase();
      const token = exactTokens.get(normalized) || nearDuplicateTokens[normalized];
      if (!token) return color;
      totals[token] = (totals[token] || 0) + 1;
      return `var(${token})`;
    }),
  );
}

const allSourceFiles = filesUnder("src");
const countFiles = ["src/ui", "src/app"]
  .flatMap(root => filesUnder(root))
  .filter(path => /\.(js|jsx)$/.test(path));
const editableFiles = targetFiles();
const beforeSrc = colorCounts(allSourceFiles);
const beforeUiApp = colorCounts(countFiles);
const totals = {};
let changedFiles = 0;

for (const file of editableFiles) {
  const source = readFileSync(file, "utf-8");
  const updated = replaceColors(source, totals);
  if (updated !== source) {
    changedFiles += 1;
    if (process.argv.includes("--write")) writeFileSync(file, updated);
  }
}

const afterSrc = process.argv.includes("--write")
  ? colorCounts(allSourceFiles)
  : beforeSrc;
const afterUiApp = process.argv.includes("--write")
  ? colorCounts(countFiles)
  : beforeUiApp;
console.log(`src distinct hexes: ${beforeSrc} -> ${afterSrc}`);
console.log(`ui/app distinct hexes: ${beforeUiApp} -> ${afterUiApp}`);
console.log(`files changed: ${changedFiles}${process.argv.includes("--write") ? "" : " (dry run)"}`);
console.log("replacement occurrences:", Object.entries(totals).map(([token, count]) => `${token}=${count}`).join(", "));
console.log("near-duplicate merges:", Object.entries(nearDuplicateTokens).map(([color, token]) => `${color} → ${token}`).join(", "));
console.log("near duplicates retained for separate visual roles:", unusedNearDuplicates.join(", "));
