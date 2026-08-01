// 酒馆经营沙盒 · 截图验证脚本
// ─────────────────────────────────────────────────────────────────────────
// 跟 ui-shot.mjs（主游戏）分开：这个只拍「开始界面 → 酒馆经营」的独立沙盒。
// 关键：酒馆每个营业 tick 小概率弹随机事件（EventModal，标题「⚠ …」），事件未决
// 时时间冻结、沙盒不再自转。所以脚本必须**主动处理弹窗**才能继续看店自转——
// 检测到 ⚠ 就点第一个「可用」选项（cursor:pointer 的那个，禁用项是 not-allowed）。
//
// 用法：SHOT_URL=http://localhost:5172 node tavern-shot.mjs
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = process.env.SHOT_URL || "http://localhost:5172";
// 可选：SHOT_SEED 指向一份合法沙盒存档 JSON（可含 pendingEvent），用来强制复现弹窗
// 处理路径。不给则清档、从第 1 日干净起步。
const SEED = process.env.SHOT_SEED ? readFileSync(process.env.SHOT_SEED, "utf-8") : null;
const OUT = process.env.SHOT_OUT ||
  "/private/tmp/claude-501/-Users-sagev/d32e7365-0124-4434-9216-7bd359f1cc2b/scratchpad";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });

// 注入假 API key（沙盒 AI 夜报可选，注了也不会真发请求），并清掉旧沙盒存档，
// 保证每次从「第 1 日 · 开门」干净起步（种子确定性，事件序列可复现）。
await page.addInitScript((seed) => {
  localStorage.setItem("wuxia_mud_api_config", JSON.stringify({ apiKey: "sk-dummy-ui-check" }));
  localStorage.setItem("wuxia_mud_day_mode", "0");
  if (seed) localStorage.setItem("qucuo_tavern_sim_v1", seed);
  else localStorage.removeItem("qucuo_tavern_sim_v1");
}, SEED);

page.on("pageerror", e => console.error("[pageerror]", e.message));
page.on("console", m => { if (m.type() === "error") console.error("[console.error]", m.text()); });

// Vite 的 HMR websocket 常驻，networkidle 永不 settle——用 domcontentloaded + 定时等
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

// 开始界面 → 酒馆经营（顶层菜单入口，跟斗蛐蛐同级）
await page.getByText("酒馆经营", { exact: false }).first().click();
await page.waitForTimeout(700);
console.log("✓ 进入酒馆经营沙盒");

// 提速到 3x（1s/tick），让看店自转与事件来得快些
try { await page.getByText("1x", { exact: false }).first().click({ timeout: 2000 }); } catch { /* 已是 3x 或标签变了 */ }
await page.waitForTimeout(400);

// ── 事件弹窗处理 ──────────────────────────────────────────────────────
// detectEvent：只探测，不点，好在点掉前先给弹窗拍一张。
const detectEvent = () => page.evaluate(() => {
  const marker = [...document.querySelectorAll("div")]
    .find(d => d.children.length === 0 && /^⚠/.test(d.textContent.trim()));
  return marker ? marker.textContent.trim() : null;
});
// dismissEvent：点第一个「可用」选项（cursor:pointer；禁用项是 not-allowed）。
const dismissEvent = () => page.evaluate(() => {
  const marker = [...document.querySelectorAll("div")]
    .find(d => d.children.length === 0 && /^⚠/.test(d.textContent.trim()));
  if (!marker) return null;
  let overlay = marker;
  while (overlay && getComputedStyle(overlay).position !== "fixed") overlay = overlay.parentElement;
  const scope = overlay || document;
  const opts = [...scope.querySelectorAll("span")]
    .filter(s => getComputedStyle(s).cursor === "pointer" && s.textContent.trim());
  if (!opts.length) return "（无可用选项）";
  const label = opts[0].textContent.trim();
  opts[0].click();
  return label;
});

// ── 主循环：自转看店，撞上事件就拍照+处理，顺带定期拍大堂 ──────────────
let handled = 0, shots = 0;
for (let i = 0; i < 45; i++) {
  const title = await detectEvent();
  if (title) {
    await page.screenshot({ path: `${OUT}/tavern-event-${handled}.png` });
    const picked = await dismissEvent();
    console.log(`⚠ 事件「${title}」→ 选「${picked}」  (event-${handled}.png)`);
    handled++;
    await page.waitForTimeout(500);
    continue;
  }
  if (i % 12 === 0) {
    await page.screenshot({ path: `${OUT}/tavern-${shots}.png` });
    console.log(`✓ 大堂快照 tavern-${shots}.png`);
    shots++;
  }
  await page.waitForTimeout(1000);
}

await page.screenshot({ path: `${OUT}/tavern-final.png` });
console.log(`done · 处理事件 ${handled} 起 · 大堂快照 ${shots + 1} 张`);
await browser.close();
