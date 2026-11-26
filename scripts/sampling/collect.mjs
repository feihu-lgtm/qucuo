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
import { fillTemplate, validateSequence, buildLaneQueue } from "./templates.mjs";

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
// 代理入站令牌：proxy 启动时写入 ~/.sampling/proxy.token（0600），
// 游戏 config 的 apiKey 带它过代理验签——本机其他进程不能蹭配额/污染留底。
const PROXY_TOKEN = process.env.SAMPLING_PROXY_TOKEN
  || readFileSync(`${process.env.HOME}/.sampling/proxy.token`, "utf8").trim();
// 批次唯一 runId：trace 全局唯一，重跑同目录不会与上一批串账。
const RUN_ID = `r${Date.now().toString(36)}`;

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
    // A4 必修：在场名单按 buildPresence 同口径（内层房间过滤+随行同伴并入），
    // 不再粗读 room.npcs——S7"人不在场"失真即源于此。
    const { buildPresence } = await import("/src/engine/prompt/roundNotes.js");
    const cur = gameStore.getState();
    const ui = sessionUiStore.getState();
    const presence = buildPresence({
      isTalk: false, lockedDestName: null,
      room: cur.room || { npcs: [] }, innerRoomName: cur.innerRoomName || "",
      companionState: cur.companionState || null,
    });
    const presenceNames = (presence.visibleNpcsForAI || []).map((n) => n?.name || n).filter(Boolean);
    // 地上物同口径：getPresentNpcs 按 innerRoomName 过滤在场者，room.items 也需
    // 同滤——内层房间物品结构 items 带 room 字段时才收，无字段的按外层物收。
    const inner = cur.innerRoomName || "";
    const groundNames = (cur.room?.items || [])
      .filter((it) => !inner || !it?.room || it.room === inner)
      .map((i) => i?.name).filter(Boolean);
    return {
      room: cur.room?.name || "", inner: cur.innerRoomName || "",
      silver: cur.char?.money ?? 0, turn: cur.time ?? 0,
      inv: (cur.inv || []).map((i) => typeof i === "string" ? { name: i } : { name: i?.name, category: i?.category }).filter((i) => i.name),
      npcs: presenceNames,
      exits: cur.room?.exits || [],
      ground: groundNames,
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
await page.evaluate(async ({ fixture, proxy, extractionEnabled, token }) => {
  localStorage.setItem("wuxia_mud_api_config", JSON.stringify({
    apiType: "openai",
    endpoint: proxy,
    apiKey: token,
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
}, { fixture: save, proxy: PROXY, extractionEnabled: MODE === "dual", token: PROXY_TOKEN });
await page.waitForTimeout(400);
await page.reload();
await page.getByText("加载游戏", { exact: true }).click();
await page.getByText(`${save.label}（导入）`, { exact: true }).click();
await page.locator(".game-input").waitFor({ state: "visible", timeout: 15000 });

const meta = {
  mode: MODE, scenario: SCENARIO, lane: LANE, lanes: LANES, turns: TURNS, runId: RUN_ID,
  startedAt: new Date().toISOString(), serverUrl: server.url,
  proxy: PROXY, model: "gemini-3.8-flash", extractionEnabled: MODE === "dual",
  shadowJudgeEnabled: true, browser: "playwright chromium headless", viewport: "1440x900",
  fixture: FIXTURE,
  note: "A4：模板化序列+在场填充+配额覆盖；归属走 x-qucuo-* 请求头；口令经本地代理注入不落盘",
};
writeFileSync(`${PREFIX}_run_meta.json`, JSON.stringify(meta, null, 2));

// lane-aware 全局配额调度：模板实例全局编号按 lane 分配，本 lane 只跑自己那份。
// 槽位缺料的实例跳过记因并顺延同 lane 下一条——配额是全局账（见 templates.mjs）。
const QUEUE = buildLaneQueue(LANE, LANES);
const skippedLog = [];
let done = 0, failed = 0, aborted = false;
const targetTurns = Math.min(TURNS, QUEUE.length);

for (let turnIdx = 0; turnIdx < targetTurns && !aborted; turnIdx++) {
  const before = await state(page);
  if (!before) { console.error("state unreadable, abort"); break; }
  const inst = QUEUE[turnIdx];
  const tpl = inst.tpl;
  const filled = fillTemplate(tpl, { npcs: before.npcs, inv: before.inv, exits: before.exits, ground: before.ground });
  let picked = null;
  if (filled.ok) picked = { tpl, text: filled.text };
  else {
    skippedLog.push({ turn: turnIdx + 1, id: tpl.id, instance: inst.instanceId, reason: filled.reason });
    // 换下一条（工单口径）：在队列后续找第一条可填实例与本位交换——
    // 可填实例顶上来本回合跑，缺料实例后移，在场变化后仍有机会再试，不透支其他 lane。
    for (let j = turnIdx + 1; j < QUEUE.length; j++) {
      const af = fillTemplate(QUEUE[j].tpl, { npcs: before.npcs, inv: before.inv, exits: before.exits, ground: before.ground });
      if (af.ok) {
        [QUEUE[turnIdx], QUEUE[j]] = [QUEUE[j], QUEUE[turnIdx]];
        picked = { tpl: QUEUE[turnIdx].tpl, text: af.text };
        break;
      }
    }
  }
  if (!picked) {
    skippedLog.push({ turn: turnIdx + 1, id: tpl.id, reason: "无替补可填，本回合空转跳过" });
    turnsLog.write(JSON.stringify({ turn: turnIdx + 1, skipped: true, tpl: tpl.id, trace: null }) + "\n");
    continue;
  }

  // 输入校验：非空字符串，否则中止（不进入付费采样）
  const check = validateSequence([picked.text]);
  if (!check.ok) {
    console.error(`ABORT: 生成的输入不合格——${check.reason}（模板 ${picked.tpl.id}）`);
    turnsLog.write(JSON.stringify({ turn: turnIdx + 1, abort: check.reason, tpl: picked.tpl.id }) + "\n");
    aborted = true;
    break;
  }

  const trace = `${SCENARIO}-${MODE}-${RUN_ID}-l${LANE}-t${turnIdx + 1}`;
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
      // A4 必修：导出前先 drain 在途影子（上限 60s，同 TraceViewer 口径），
      // 聚合 JSON 内嵌 stageCounts 与 pendingAtExport——否则分不清影子是死了/丢了/在途。
      const { drainShadowTasks, shadowStageCounts } = await import("/src/engine/act/shadow/shadowStages.js");
      const { pending } = await drainShadowTasks(60000);
      out.pendingAtExport = pending;
      out.stageCounts = shadowStageCounts("default");
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
    ...exports_, pageErrors, skippedLog, queueLength: QUEUE.length,
    finishedAt: new Date().toISOString(), done, failed, laneId: LANE, aborted,
  }, null, 2));
  console.log(`[${SCENARIO}/${MODE}/lane${LANE}] exports written, done=${done} failed=${failed} aborted=${aborted}`);
} catch (e) {
  console.error("export error", e);
}
await browser.close();
await server.stop();
process.exit(0);
