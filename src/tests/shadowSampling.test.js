// WO-16D-2 影子判官覆盖率可复现采样 harness
// ============================================================================
// 真实接线：playTurn + 真 runTurn + 真 commitRound + 真 shadowJudge，
// 只有 AI 是确定性 router mock（按消息内容分流主叙事/影子 intake）。
// 单调用模式（extractionEnabled:false）——影子判官唯一激活口径。
// 跑完把与线上同形状的聚合写进仓库根 shadow-report.json，
// 可被 `npm run shadow:report -- shadow-report.json` 直接消费。
// 不改游戏行为：本文件是测试，不进构建。
import { afterAll, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { gameActions, gameStore, initGameStore, subscribeGameReplaced } from "../store/gameStore.js";
import { turnMonitor } from "../infra/turnMonitor.js";
import { createTurnContext } from "../engine/turn/turnContext.js";
import { playTurn } from "../engine/playTurn.js";
import { shadowAggregates, _resetShadowAggregates } from "../engine/act/shadow/shadowJudge.js";
import { initialNarratorState } from "../domain/rules/narrator/narrator.js";
import { summarizeShadowCoverage, evaluateShadowThresholds, formatCoverageReport } from "../engine/act/shadow/shadowCoverage.js";

const room = {
  name: "曲措客栈", desc: "大堂", exits: [],
  npcs: [
    { id: "innkeeper", name: "掌柜", brief: "精明和气的中年人" },
    { id: "huoji", name: "伙计", brief: "跑腿的小子" },
  ],
  items: [{ id: "stone1", name: "石子" }],
};

function baseState(time = 50) {
  return {
    room, char: { name: "少侠", hp: [90, 100], neigong: 5, waigong: 6, special: { 气运: 5, 体魄: 5, 身法: 5 }, money: 100 },
    dao: { karma: 0, jie: 0 }, skills: [], exp: 0, pot: 0,
    inv: [{ id: "food1", name: "干粮" }], companionState: {},
    preset: { id: "p1", name: "测试", scenario: "测试剧本" },
    innerRoomName: null, mapData: {}, dungeonRun: null, npcState: {}, roomCache: {},
    time, log: [], convo: [], narrator: initialNarratorState(),
    varTree: { 角色: { 掌柜: { 好感度: 10 } }, 世界: {} },
    flags: [], questProgress: {}, persuasionProgress: {}, claimedMilestones: [],
    deposit: 0, depositedAt: null, pledgedItems: [], prepSeeds: [],
    proseLineage: null, proseSeq: 0,
  };
}

// ── 确定性 router mock AI：按消息内容分流 ─────────────────────────────
// 主叙事回复按队列逐回合消费；影子 intake 回复按队列消费。
// 两条队列独立——主回合一次调用、影子一次调用，次序由 playTurn 流程保证。
// 按内容键控路由而非顺序队列：搭话回合影子本地合成不调 intake AI，
// 顺序队列会错位级联；按「消息里出现哪条 cmd」匹配脚本，次序/次数都免疫。
function makeRouterAi(scripts) {
  const calls = [];
  return {
    calls,
    async chat(messages, opts = {}) {
      const text = JSON.stringify(messages?.map?.((m) => m?.content) ?? messages);
      const script = scripts.find((s) => s.cmd && text.includes(s.cmd));
      calls.push({ cmd: script?.cmd || "?", intake: text.includes("玩家这句话") });
      if (!script) throw new Error(`mock ai: no script matched ${text.slice(0, 100)}`);
      return { text: text.includes("玩家这句话") ? script.intake : script.narrative };
    },
  };
}

const EMPTY_INTAKE = JSON.stringify({ read: "", refIds: [], actions: [], proposals: [] });
const narrative = (output, mvu = "", memory = "无事发生") =>
  `${JSON.stringify({ output: [output], memory })}${mvu ? `\n<mvu>\n${mvu}\n</mvu>` : ""}`;

function makeEnv(plan, apiCfg, trace) {
  const s = gameStore.getState();
  return {
    state: {
      room: s.room, char: s.char, inv: s.inv, skills: s.skills, dao: s.dao,
      flags: s.flags, mapData: s.mapData, time: s.time, preset: s.preset,
      narrator: s.narrator, convo: s.convo, nsfwOn: false,
      activeTarget: null, talkTarget: plan.talkTarget || null, companionState: s.companionState,
      questProgress: s.questProgress, pendingQuestBranch: null, innerRoomName: null,
      effectiveSpecialNow: s.char?.special || {},
    },
    refs: {},
    io: {
      addLog: vi.fn(), setLog: gameActions.setLog, setVarTree: gameActions.setVarTreeState,
      setRoom: gameActions.setRoom, setGambleNegotiation: vi.fn(), setInv: gameActions.setInv,
      setChar: gameActions.setChar, setDao: gameActions.setDao, setExp: gameActions.setExp,
      setPot: gameActions.setPot, setSkills: gameActions.setSkills, setMapData: gameActions.setMapData,
      setTime: gameActions.setTime, setPendingQuestBranch: vi.fn(), setConvo: gameActions.setConvo,
      setCommandPhase: vi.fn(), onTurnsInvalidated: vi.fn(),
      setFlags: gameActions.setFlags, setCompanionState: gameActions.setCompanionState,
      setClaimedMilestones: gameActions.setClaimedMilestones,
      getGameState: () => gameStore.getState(), gameActions, subscribeGameReplaced,
      getGambleSession: () => null, setGambleSession: vi.fn(), appendDayMaterial: vi.fn(),
    },
    opts: {},
    isStale: () => false, apiCfg, gm: false, _trace: trace,
  };
}

function makePlan(overrides = {}) {
  return {
    isTalk: false, isSettle: false, intent: { code: "FREE", label: "自由行动" },
    movingDir: null, lockedDestName: null, destinationLock: null, collectNote: null,
    activeGroundItemForTurn: null, intimateTicket: null, pendDir: null, outerDepart: null,
    pickupJudgment: null, collectGranted: null,
    ...overrides,
  };
}

// 回合脚本：cmd + plan 覆盖 + 主叙事 mock（含 mvu 单调用落账）+ 影子 intake mock
const TURNS = [
  { cmd: "掌柜，最近可好？", plan: { isTalk: true, talkTarget: "掌柜", intent: { code: "TALK", label: "搭话" } },
    narrative: narrative("掌柜笑着擦了擦柜台：「托福托福，小店还算安生。」"),
    intake: JSON.stringify({ read: "", refIds: [], actions: [{ kind: "talk", target: "掌柜", itemId: "", direction: "none", stance: "casual", text: "掌柜，最近可好？" }], proposals: [] }),
    note: "talk 纯搭话" },
  { cmd: "把干粮塞给掌柜", plan: {},
    narrative: narrative("少侠把干粮推过柜台，掌柜愣了愣，拱手道谢。", "_.add('角色.掌柜.好感度', 3);\n_.add('主角.行囊.干粮', -1);", "赠干粮予掌柜"),
    intake: JSON.stringify({ read: "", refIds: [], actions: [{ kind: "give", target: "掌柜", itemId: "干粮", direction: "none", stance: "casual", text: "把干粮塞给掌柜" }], proposals: [] }),
    note: "give 自由文本送礼（affection 类目）" },
  { cmd: "翻一翻柜台后面的木箱", plan: {},
    narrative: narrative("少侠探头去瞧那木箱，掌柜连忙拦住：「哎哎，那是家当。」"),
    intake: JSON.stringify({ read: "", refIds: [], actions: [{ kind: "inspect_container", target: "木箱", itemId: "", direction: "none", stance: "casual", text: "翻一翻柜台后面的木箱" }], proposals: [{ claim: "箱里有碎银", kind: "find_item", fit: "natural" }] }),
    note: "inspect_container 未声明容器" },
  { cmd: "拾起地上的石子", plan: {},
    narrative: narrative("少侠弯腰拾起那颗石子，掂了掂揣进怀里。"),
    intake: JSON.stringify({ read: "", refIds: [], actions: [{ kind: "pickup", target: "石子", itemId: "stone1", direction: "none", stance: "casual", text: "拾起地上的石子" }], proposals: [] }),
    note: "pickup 地上物（inv 类目）" },
  { cmd: "出门往北走", plan: { movingDir: "n", intent: { code: "MOVE", label: "移动" } },
    narrative: narrative("少侠出了客栈，北风扑面。"),
    intake: EMPTY_INTAKE,
    note: "move 移动回合" },
  { cmd: "跟伙计打听镇上的消息", plan: { isTalk: true, talkTarget: "伙计", intent: { code: "TALK", label: "搭话" } },
    narrative: narrative("伙计压低声音说了些镇上的闲事。"),
    intake: JSON.stringify({ read: "", refIds: [], actions: [{ kind: "talk", target: "伙计", itemId: "", direction: "none", stance: "casual", text: "跟伙计打听镇上的消息" }], proposals: [] }),
    note: "talk 打探消息" },
  { cmd: "偷偷摸走柜台的茶壶", plan: {},
    narrative: narrative("少侠趁人不备，把茶壶袖进了怀里。", "_.add('世界.威望', -2);", "窃了茶壶"),
    intake: JSON.stringify({ read: "", refIds: [], actions: [{ kind: "steal", target: "掌柜", itemId: "茶壶", direction: "none", stance: "casual", text: "偷偷摸走柜台的茶壶" }], proposals: [] }),
    note: "steal 偷窃（判官 F1 查表路径）" },
  { cmd: "打坐调息一个时辰", plan: {},
    narrative: narrative("少侠盘膝而坐，气息渐匀。", "_.add('角色.少侠.修为', 2);", "打坐练功"),
    intake: JSON.stringify({ read: "", refIds: [], actions: [{ kind: "free_act", target: "无", itemId: "", direction: "none", stance: "casual", text: "打坐调息一个时辰" }], proposals: [] }),
    note: "free_act 修炼（cultivation 参考）" },
];

const report = { turns: [], errors: [] };

describe("WO-16D-2 影子覆盖率采样 harness", () => {
  it("驱动代表性回合串并产出 shadow-report.json", async () => {
    _resetShadowAggregates();
    initGameStore(baseState());
    const apiCfg = {
      extractionEnabled: false, shadowJudgeEnabled: true, judgePipelineEnabled: false,
      streamEnabled: false, maxTokens: 4000, bookkeepEnabled: false,
    };
    const ai = makeRouterAi(TURNS);

    for (const script of TURNS) {
      const before = shadowAggregates("default").turns;
      const plan = makePlan(script.plan);
      const trace = turnMonitor.start(script.cmd);
      const env = makeEnv(plan, apiCfg, trace);
      const turnCtx = createTurnContext({ plan, env });
      const ctx = {
        ...turnCtx,
        ai, apiCfg, bookkeep: false,
        commitDeps: turnCtx.commitDeps,
        getGameState: () => gameStore.getState(),
        gameActions, subscribeGameReplaced,
        _trace: trace,
      };
      let result;
      try {
        result = await playTurn(ctx, script.cmd, { isTalk: plan.isTalk });
      } catch (e) {
        report.errors.push({ cmd: script.cmd, error: String(e?.message || e) });
        report.turns.push({ cmd: script.cmd, note: script.note, outcome: "throw" });
        continue;
      }
      // 影子是 fire-and-forget：等聚合 turns 递增（mock 同步返回，几拍内必落）
      let shadowed = false;
      for (let i = 0; i < 200; i++) {
        await new Promise((r) => setTimeout(r, 5));
        if (shadowAggregates("default").turns > before) { shadowed = true; break; }
      }
      report.turns.push({
        cmd: script.cmd, note: script.note,
        outcome: result?.ok ? "ok" : result?.stale ? "stale" : "fail",
        shadowed,
      });
    }

    const agg = shadowAggregates("default");
    const summary = summarizeShadowCoverage(agg);
    const evaluation = evaluateShadowThresholds(summary);
    // 落盘线上同形状聚合 + 摘要，供 npm run shadow:report 消费
    writeFileSync("shadow-report.json", JSON.stringify(agg, null, 2));
    writeFileSync("shadow-report-summary.json", JSON.stringify({ summary, evaluation, turns: report.turns, errors: report.errors }, null, 2));
    console.log("=== shadow coverage sample ===");
    console.log(formatCoverageReport(summary, evaluation).join("\n"));
    console.log("turns:", JSON.stringify(report.turns, null, 1));
    console.log("errors:", JSON.stringify(report.errors, null, 1));
    // harness 自检：至少大半回合真正跑通且影子有采样——否则报告无意义
    const okTurns = report.turns.filter((t) => t.outcome === "ok" && t.shadowed).length;
    expect(report.errors).toEqual([]);
    expect(okTurns).toBeGreaterThanOrEqual(Math.ceil(TURNS.length / 2));
    expect(agg.turns).toBeGreaterThan(0);
  }, 120000);
});

afterAll(() => {
  initGameStore({});
  turnMonitor.clear();
});
