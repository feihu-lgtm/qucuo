// A4 真实采样采集驱动：模板化序列 + 在场实况填充 + 配额覆盖 + 归属头留痕。
// 基于 S7 collector v2 的真实完成检测（queueCount/loading 空闲稳定），改动：
//   1. 序列不再预写死——每回合先读在场实况（NPC/背包/出口/地上物）填模板，
//      槽位缺料换下一条并记跳过原因；
//   2. 生成后立即校验非空字符串，不合格直接中止，不进入付费采样；
//   3. 每回合提交前写 window.__qucuoSampling={lane,turn,trace}，
//      传输层装进 x-qucuo-* 请求头，代理按头归属；
//   4. 存档 fixture 可选 fullhp（开局满血+耗材/兵刃/凭帖/钥匙各一）或 injured（原重伤），
//      两组情境分开统计。
//
// 用法：
//   node scripts/sampling/proxy.mjs &                      # 先起代理
//   SAMPLING_MODE=single SAMPLING_SCENARIO=fullhp \
//   SAMPLING_LANE=0 SAMPLING_LANES=1 SAMPLING_TURNS=205 \
//     node scripts/sampling/collect.mjs
import { chromium } from "playwright";
import { readFileSync, writeFileSync, createWriteStream, mkdirSync } from "node:fs";
import { startServer } from "../../e2e/harness/server.mjs";
import { TEMPLATES, fillTemplate, validateSequence } from "./templates.mjs";

const MODE = process.env.SAMPLING_MODE || "single"; // single=单调用+影子 / dual=双调用
const SCENARIO = process.env.SAMPLING_SCENARIO || "fullhp"; // fullhp / injured
const LANE = Number(process.env.SAMPLING_LANE) || 0;
const LANES = Number(process.env.SAMPLING_LANES) || 1;
const TURNS = Number(process.env.SAMPLING_TURNS) || 205; // 本 lane 目标回合数
const OUT = process.env.SAMPLING_OUT || `${process.env.HOME}/.sampling/artifacts`;
mkdirSync(OUT, { recursive: true });
const PREFIX = `${OUT}/${SCENARIO}_${MODE}_lane${LANE}`;
const turnsLog = createWriteStream(`${PREFIX}_turns.jsonl`, { flags: "a" });
const PROXY = process.env.SAMPLING_PROXY_URL || "http://127.0.0.1:5411/v1/chat/completions";
const FIXTURE = SCENARIO === "injured"
  ? "/home/ubuntu/repos/qucuo/e2e/fixtures/saves/village.json"
  : "/home/ubuntu/repos/qucuo/e2e/fixtures/saves/village_fullhp.json";
const save = JSON.parse(readFileSync(FIXTURE, "utf8"));

const server = await startServer();
const browser = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage", "--disable-gpu", "--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e.message || e)));

async function state(page) {
  return page.evaluate(async () => {
    const { gameStore } = await import("/src/store/gameStore.js");
    const { sessionUiStore } = await import("/src/store/sessionUiStore.js");
    const cur = gameStore.getState();
    const ui = sessionUiStore.getState();
    return {
      room: cur.room?.name || "", inner: cur.innerRoomName || "",
      silver: cur.char?.money ?? 0, turn: cur.time ?? 0,
      inv: (cur.inv || []).map((i) => typeof i === "string" ? { name: i } : { name: i?.name, category: i?.category }).filter((i) => i.name),
      npcs: (cur.room?.npcs || []).map((n) => n.name),
      exits: cur.room?.exits || [],
      ground: (cur.room?.items || []).map((i) => i?.name).filter(Boolean),
      logLen: (cur.log || []).length,
      hp: cur.char?.hp,
      queueCount: ui.queueCount ?? 0,
      loading: !!ui.loading,
    };
  }).catch(() => null);
}

async function logSlice(page, from) {
  return page.evaluate(async (idx) => {
    const { gameStore } = await import("/src/store/gameStore.js");
    const log = gameStore.getState().log || [];
    return log.slice(idx).map((e) => typeof e === "string" ? e : (e?.text ?? e?.line ?? JSON.stringify(e)));
  }, from).catch(() => []);
}

await page.goto(server.url);
await page.evaluate(async ({ fixture, proxy, extractionEnabled }) => {
  localStorage.setItem("wuxia_mud_api_config", JSON.stringify({
    apiType: "openai",
    endpoint: proxy,
    apiKey: "via-local-proxy",
    model: "gemini-3.8-flash",
    extractionEnabled,
    shadowJudgeEnabled: true,
    judgePipelineEnabled: true,
    questTriggerMode: "prompt",
    autoSaveEvery: 1,
  }));
  localStorage.setItem("qucuo_tutorial_seen", "1");
  const saves = await import("/src/infra/saves.js");
  await saves.init();
  saves.importSave(JSON.stringify(fixture));
}, { fixture: save, proxy: PROXY, extractionEnabled: MODE === "dual" });
await page.waitForTimeout(400);
await page.reload();
await page.getByText("加载游戏", { exact: true }).click();
await page.getByText(`${save.label}（导入）`, { exact: true }).click();
await page.locator(".game-input").waitFor({ state: "visible", timeout: 15000 });

const meta = {
  mode: MODE, scenario: SCENARIO, lane: LANE, lanes: LANES, turns: TURNS,
  startedAt: new Date().toISOString(), serverUrl: server.url,
  proxy: PROXY, model: "gemini-3.8-flash", extractionEnabled: MODE === "dual",
  shadowJudgeEnabled: true, browser: "playwright chromium headless", viewport: "1440x900",
  fixture: FIXTURE,
  note: "A4：模板化序列+在场填充+配额覆盖；归属走 x-qucuo-* 请求头；口令经本地代理注入不落盘",
};
writeFileSync(`${PREFIX}_run_meta.json`, JSON.stringify(meta, null, 2));

// 配额选型：按模板 target 追踪；round-robin 过模板表，填满即跳过。
// 顺序按 TEMPLATES 固定，保证可复现；lane 偏移错开各 lane 起跑点。
const tracker = {};
const skippedLog = [];
let cursor = (LANE * 7) % TEMPLATES.length;
let done = 0, failed = 0, aborted = false;

for (let turnIdx = 0; turnIdx < TURNS && !aborted; turnIdx++) {
  const before = await state(page);
  if (!before) { console.error("state unreadable, abort"); break; }
  // 选模板：从 cursor 起扫一圈，找配额未满且槽位可填的
  let picked = null;
  for (let step = 0; step < TEMPLATES.length; step++) {
    const i = (cursor + step) % TEMPLATES.length;
    const tpl = TEMPLATES[i];
    if ((tracker[tpl.id] || 0) >= tpl.target) continue;
    const filled = fillTemplate(tpl, { npcs: before.npcs, inv: before.inv, exits: before.exits, ground: before.ground });
    if (filled.ok) { picked = { tpl, text: filled.text, index: i }; break; }
    skippedLog.push({ turn: turnIdx + 1, id: tpl.id, reason: filled.reason });
  }
  if (!picked) {
    console.log("all templates exhausted or unfillable, stop early");
    break;
  }
  cursor = (picked.index + 1) % TEMPLATES.length;

  // 输入校验：非空字符串，否则中止（不进入付费采样）
  const check = validateSequence([picked.text]);
  if (!check.ok) {
    console.error(`ABORT: 生成的输入不合格——${check.reason}（模板 ${picked.tpl.id}）`);
    turnsLog.write(JSON.stringify({ turn: turnIdx + 1, abort: check.reason, tpl: picked.tpl.id }) + "\n");
    aborted = true;
    break;
  }

  const trace = `${SCENARIO}-${MODE}-l${LANE}-t${turnIdx + 1}`;
  // 归属标签先行：本回合所有 AI 调用（含影子）都带这三个头
  await page.evaluate((tag) => { window.__qucuoSampling = tag; }, { lane: LANE, turn: turnIdx + 1, trace });

  const rec = {
    turn: turnIdx + 1, mode: MODE, scenario: SCENARIO, laneId: LANE, trace,
    tpl: picked.tpl.id, kind: picked.tpl.kind,
    ...(picked.tpl.outcome ? { outcome: picked.tpl.outcome } : {}),
    ...(picked.tpl.settle ? { settle: picked.tpl.settle } : {}),
    ...(picked.tpl.group ? { group: true } : {}),
    ...(picked.tpl.conditional ? { conditional: true } : {}),
    cmd: picked.text, startedAt: new Date().toISOString(),
  };
  tracker[picked.tpl.id] = (tracker[picked.tpl.id] || 0) + 1;
  try {
    rec.turnBefore = before.turn; rec.roomBefore = before.room;
    const t0 = Date.now();
    const input = page.locator(".game-input");
    await input.fill(picked.text, { timeout: 8000 });
    await input.press("Enter");
    // 完成检测：queueCount==0 且 loading==false 连续 3 次（间隔 2s）且有推进迹象；上限 150s
    let complete = false, idleStreak = 0, sawProgress = false, sawBusy = false;
    while (Date.now() - t0 < 150000) {
      await page.waitForTimeout(2000);
      const now = await state(page);
      if (!now) continue;
      if (now.turn > before.turn || now.logLen > before.logLen + 1) sawProgress = true;
      if (now.queueCount > 0 || now.loading) { sawBusy = true; idleStreak = 0; continue; }
      idleStreak++;
      const elapsed = Date.now() - t0;
      if (sawBusy && idleStreak >= 3 && sawProgress) { complete = true; break; }
      if (sawBusy && idleStreak >= 5) { complete = true; rec.note = "idle_after_busy_no_progress"; break; }
      if (!sawBusy && elapsed > 20000 && sawProgress && idleStreak >= 3) { complete = true; rec.note = "no_busy_fallback"; break; }
    }
    const after = await state(page);
    if (after) {
      rec.turnAfter = after.turn; rec.roomAfter = after.room;
      rec.silver = after.silver; rec.npcs = after.npcs; rec.inv = after.inv.map((i) => i.name); rec.hp = after.hp;
      rec.newLog = await logSlice(page, before.logLen);
    }
    rec.ms = Date.now() - t0;
    if (!complete) { rec.failed = "turn_timeout_150s"; failed++; } else done++;
    rec.finishedAt = new Date().toISOString();
  } catch (err) {
    rec.failed = String(err?.message || err).slice(0, 300);
    rec.finishedAt = new Date().toISOString();
    failed++;
  }
  turnsLog.write(JSON.stringify(rec) + "\n");
  if (done % 10 === 0 && done > 0) console.log(`[${SCENARIO}/${MODE}/lane${LANE}] done=${done} failed=${failed}`);
}

try {
  const exports_ = await page.evaluate(async () => {
    const out = {};
    try { out.releaseMetrics = JSON.parse(localStorage.getItem("qc_release_metrics_v1") || "null"); } catch { out.releaseMetrics = null; }
    try {
      const shadowMod = await import("/src/engine/act/shadow/shadowJudge.js");
      const aggs = {};
      for (const key of ["default", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
        const a = shadowMod.shadowAggregates(key);
        if (a && (a.turns > 0 || (a.samples || []).length > 0)) aggs[key] = a;
      }
      out.shadowAggregatesByEpoch = aggs;
      out.shadowAggregates = shadowMod.shadowAggregates("default");
    } catch (e) { out.shadowError = String(e?.message || e); }
    return out;
  });
  writeFileSync(`${PREFIX}_exports.json`, JSON.stringify({
    ...exports_, pageErrors, skippedLog, tracker,
    finishedAt: new Date().toISOString(), done, failed, laneId: LANE, aborted,
  }, null, 2));
  console.log(`[${SCENARIO}/${MODE}/lane${LANE}] exports written, done=${done} failed=${failed} aborted=${aborted}`);
} catch (e) {
  console.error("export error", e);
}
await browser.close();
await server.stop();
process.exit(0);
