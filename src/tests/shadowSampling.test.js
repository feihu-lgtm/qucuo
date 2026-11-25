// WO-16D-2 + S6 影子判官覆盖率可复现采样 harness（S6：情景表驱动 200+ 回合）
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
import { prepStateVersion, createPrepSeed } from "../domain/rules/prep/prepSeeds.js";

const room = {
  name: "曲措客栈", desc: "大堂", exits: [],
  npcs: [
    // WO-16D-3 可信度修：判官 steal 查表读 carriedItems——裸 npc 无随身物则
    // 「身无一物偷窃无获」恒成立，judge 侧恒零签发，属 harness 失真不是真 gap。
    { id: "innkeeper", name: "掌柜", brief: "精明和气的中年人",
      carriedItems: [{ id: "pot1", name: "茶壶", category: "misc", quality: "白" }, { id: "purse1", name: "钱袋", category: "misc", quality: "白" }] },
    { id: "huoji", name: "伙计", brief: "跑腿的小子",
      carriedItems: [{ id: "rag1", name: "抹布", category: "misc", quality: "白" }] },
  ],
  items: [{ id: "stone1", name: "石子" }],
};

function baseState(time = 50) {
  return {
    room, char: { name: "少侠", hp: [90, 100], neigong: 5, waigong: 6, special: { 气运: 5, 体魄: 5, 身法: 5 }, money: 100 },
    dao: { karma: 0, jie: 0 }, skills: [], exp: 0, pot: 0,
    inv: [
      // 判官 give 查重量/品级定收受——裸条目 weight 空则恒拒收，harness 失真。
      { id: "food1", name: "干粮", category: "misc", quality: "白", weight: 1 },
      { id: "med1", name: "伤药", category: "misc", quality: "绿", weight: 1 },
      { id: "sword1", name: "铁剑", category: "weapon", quality: "白", weight: 3 },
    ], companionState: {},
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
      // WO-16D-3 可信度修：判别器改用 intake userContent 独有的「[拆句提示]」——
      // 「玩家这句话」字样也会出现在主叙事 prompt 里，首轮 harness 因此把 intake
      // 回复错喂给主叙事（p 键全是 read/refIds/actions/proposals），8 回合全在吃错料。
      const isIntake = text.includes("拆句提示");
      // WO-16D-3 可信度修：主叙事 prompt 含 convo 历史，旧回合 cmd 也在文本里——
      // 顺序 find 会命中最早的旧 cmd 吃错料（首轮 harness 因此 give 回合吃到 talk 叙事）。
      // 当前回合 cmd 总在最新 user 消息里=文本中最后出现，取 lastIndexOf 最大者。
      // intake 与主叙事文本结构相反：intake 的「玩家这句话」在开头、convo 历史在后；
      // 主叙事的玩家输入回声在末尾。统一口径——intake 精确匹配玩家这句话行，
      // 主叙事取 lastIndexOf 最大者。
      let script;
      if (isIntake) {
        const m = /玩家这句话：「([^」]*)」/.exec(text);
        const said = m?.[1] || "";
        script = scripts.find((s) => s.cmd && said === s.cmd)
          || scripts.find((s) => s.cmd && said.includes(s.cmd));
      } else {
        script = scripts
          .map((s) => ({ s, idx: s.cmd ? text.lastIndexOf(s.cmd) : -1 }))
          .filter((x) => x.idx >= 0)
          .sort((a, b) => b.idx - a.idx)[0]?.s;
      }
      calls.push({ cmd: script?.cmd || "?", intake: isIntake });
      if (!script) throw new Error(`mock ai: no script matched ${text.slice(0, 100)}`);
      return { text: isIntake ? script.intake : script.narrative };
    },
  };
}

const EMPTY_INTAKE = JSON.stringify({ read: "", refIds: [], actions: [], proposals: [] });
// WO-16D-3 合法契约修：真实单调用 JSON 的状态通道是 delta.items_add/items_rm/exp/pot/flags_add
// 与 char.hp/char.money 字段；mvu 只管 varTree（角色.X.好感度 / 世界.* 变量）。
// 物品增减没有合法 mvu 路径——`主角.行囊.X` 是 harness 杜撰，真实模型契约里不存在。
const narrative = (output, opts = {}) => {
  const { mvu = "", memory = "无事发生", delta = null, char = null } = typeof opts === "string" ? { mvu: opts } : opts;
  const body = { output: [output], memory };
  if (delta) body.delta = delta;
  if (char) body.char = char;
  return `${JSON.stringify(body)}${mvu ? `\n<mvu>\n${mvu}\n</mvu>` : ""}`;
};
// WO-16D-3 契约形状修：turn.intake 走 strict schema（additionalProperties:false +
// 12 字段全 required），缺字段的 mock 回复在网关校验即拒收——normalize 层
// 修复式补全救不回，影子 intake 恒零动作（judge 侧恒零签发的 harness 噪声源）。
const intake1 = (kind, target = "", itemId = "", text = "", extra = {}) => {
  const { proposals = [], outcome = "无", risk = "无", item = "无", ...rest } = extra;
  return JSON.stringify({
    read: "", refIds: [],
    actions: [{
      kind, target, item, itemId, direction: "none", condition: "无", condition_text: "",
      stance: "casual", outcome, risk, confidence: 0.9, text, ...rest,
    }],
    proposals: proposals.map((p) => ({ claim: "", kind: "find_item", fit: "natural", questId: "", flag: "", ...p })),
  });
};

function makeEnv(plan, apiCfg, trace) {
  const s = gameStore.getState();
  return {
    state: {
      room: s.room, char: s.char, inv: s.inv, skills: s.skills, dao: s.dao,
      flags: s.flags, mapData: s.mapData, time: s.time, preset: s.preset,
      narrator: s.narrator, convo: s.convo, nsfwOn: false,
      activeTarget: null, talkTarget: plan.talkTarget || null, companionState: s.companionState,
      questProgress: s.questProgress, pendingQuestBranch: null, innerRoomName: plan.innerRoomName || null,
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

// ============================================================================
// S6 情景表驱动采样：十四种 kind 每类 ≥10；free_act 十种 outcome 每类 ≥5；
// settle 三类/群聊/条件动作各 ≥5；总数 ≥200，确定性可复现。
// 每个脚本带 kind/outcome 标签，报告按两个维度分列覆盖率。
// ============================================================================

// 通用道具池：判官 give/steal 查重量品级，裸条目恒拒签属 harness 失真。
const ITEMS = [
  { id: "food1", name: "干粮", category: "misc", quality: "白", weight: 1 },
  { id: "med1", name: "伤药", category: "misc", quality: "绿", weight: 1 },
  { id: "sword1", name: "铁剑", category: "weapon", quality: "白", weight: 3 },
  { id: "wine1", name: "烧刀子", category: "misc", quality: "白", weight: 1 },
  { id: "jade1", name: "玉佩", category: "misc", quality: "绿", weight: 1 },
];

// 回合前状态复位：逐回合回到同一基线，保证串行 200 回合确定性可复现——
// 不复位则 hp 跌穿/银两耗尽/背包容器状态漂移，后面的回合输入面就变了。
function resetBaseline() {
  const s = gameStore.getState();
  gameActions.setChar({ ...s.char, hp: [90, 100], money: 100 });
  gameActions.setInv(ITEMS.map((it) => ({ ...it })));
  gameActions.setExp(0); gameActions.setPot(0);
  gameActions.setFlags([]);
  gameActions.setRoom({
    ...room,
    npcs: room.npcs.map((n) => ({ ...n, carriedItems: (n.carriedItems || []).map((c) => ({ ...c })) })),
    items: [{ id: "stone1", name: "石子" }],
  });
  gameActions.setPrepSeeds([]);
  gameActions.setVarTreeState({ 角色: { 掌柜: { 好感度: 10 }, 伙计: { 好感度: 5 } }, 世界: {} });
}

// ── 情景生成器 ──────────────────────────────────────────────────────────
const T = (cmd, script) => ({ cmd, ...script });
const NPCS2 = ["掌柜", "伙计"];

function talkTurns() {
  const stances = ["sincere", "casual", "hostile", "perfunctory", "clever"];
  const lines = [
    ["掌柜，最近可好？", "掌柜笑着擦柜台：「托福托福。」"],
    ["跟伙计打听镇上的消息", "伙计压低声音说了些闲事。"],
    ["骂掌柜是个奸商", "掌柜脸色一沉别过头去。"],
    ["跟掌柜闲聊天气", "掌柜望望窗外随口应付。"],
    ["夸伙计手脚麻利", "伙计挠头嘿嘿一笑。"],
    ["讥讽掌柜抠门", "掌柜冷笑一声不再理会。"],
    ["跟伙计讨杯热茶", "伙计麻利地倒了碗热茶。"],
    ["问掌柜可有什么差事", "掌柜捻须沉吟片刻。"],
    ["当众羞辱掌柜", "旁人窃窃私语，掌柜面红耳赤。"],
    ["跟伙计套近乎", "伙计放下抹布攀谈起来。"],
  ];
  return lines.map(([cmd, out], i) => T(cmd, {
    kind: "talk",
    plan: { isTalk: true, talkTarget: NPCS2[i % 2], intent: { code: "TALK", label: "搭话" } },
    narrative: narrative(out, i % 3 === 0 ? { mvu: `_.add('角色.${NPCS2[i % 2]}.好感度', ${i % 2 ? -2 : 1});` } : {}),
    intake: intake1("talk", NPCS2[i % 2], "", cmd, { stance: stances[i % stances.length] }),
    note: `talk 场景${i + 1}·stance=${stances[i % stances.length]}`,
  }));
}

function moveTurns() {
  return Array.from({ length: 10 }, (_, i) => {
    const dir = ["n", "s", "e", "w"][i % 4];
    return T(`出门往${{ n: "北", s: "南", e: "东", w: "西" }[dir]}走${i > 3 ? "再折返" + i : ""}`, {
      kind: "move",
      plan: { movingDir: dir, intent: { code: "MOVE", label: "移动" } },
      narrative: narrative(`少侠出了门，沿街走了一段。`),
      intake: EMPTY_INTAKE,
      note: `move 场景${i + 1}·dir=${dir}`,
    });
  });
}

function inspectTurns() {
  const out = [];
  for (let i = 0; i < 10; i++) {
    const mode = i % 4;
    if (mode === 0) {
      // 有备料·真实声明容器（贡措海密室/沉水石函）
      out.push(T(`翻一翻沉水石函${i ? "再来" + i : ""}`, {
        kind: "inspect_container",
        plan: { innerRoomName: "贡措海密室" },
        setup: () => {
          gameActions.setRoom({ name: "贡措海", desc: "密室", exits: [], npcs: [], items: [] });
          const s = { ...gameStore.getState(), innerRoomName: "贡措海密室" };
          const sv = prepStateVersion(s);
          gameActions.setPrepSeeds([createPrepSeed({
            id: `seed-prep-${i}`, kind: "prep_item", turn: s.time, day: Math.floor((s.time || 0) / 24),
            location: "贡措海", stateVersion: sv,
            payload: { containerId: "沉水石函", name: "锈匕首", category: "weapon", quality: "白", clue: "备料线索" },
          })]);
        },
        narrative: narrative("石函开启，里头静静躺着一柄锈匕首。", { delta: { items_add: ["锈匕首"] } }),
        intake: intake1("inspect_container", "沉水石函", "", `翻一翻沉水石函`),
        note: "inspect_container 有备料·声明容器",
      }));
    } else if (mode === 1) {
      // 声明容器·无备料
      out.push(T(`再翻沉水石函空手${i}`, {
        kind: "inspect_container",
        plan: { innerRoomName: "贡措海密室" },
        setup: () => {
          gameActions.setRoom({ name: "贡措海", desc: "密室", exits: [], npcs: [], items: [] });
        },
        narrative: narrative("石函里空空如也，只剩些水渍。"),
        intake: intake1("inspect_container", "沉水石函", "", `再翻沉水石函`),
        note: "inspect_container 无备料·声明容器",
      }));
    } else {
      // 未声明容器：判官正确拒签「没什么可翻的」——真实行为留证
      const name = mode === 2 ? "木箱" : "箱笼";
      out.push(T(`翻一翻柜台后的${name}${i}`, {
        kind: "inspect_container",
        narrative: narrative(`少侠探头去瞧那${name}，掌柜连忙拦住。`, mode === 3 ? { delta: { items_add: ["铜钱"] } } : {}),
        intake: intake1("inspect_container", name, "", `翻一翻柜台后的${name}`, mode === 3 ? { proposals: [{ claim: "箱里有铜钱", kind: "find_item", fit: "natural" }] } : {}),
        note: `inspect_container 未声明容器·${mode === 2 ? "被拦" : "模型自称有所获"}`,
      }));
    }
  }
  return out;
}

function takeTurns() {
  return Array.from({ length: 10 }, (_, i) => T(`拾起地上的石子${i ? "又一次" + i : ""}`, {
    kind: "take",
    narrative: narrative(i % 2 ? "少侠弯腰拾起石子揣进怀里。" : "少侠看了看石子又放下了。", i % 2 ? { delta: { items_add: ["石子"] } } : {}),
    intake: intake1("take", "石子", "stone1", "拾起地上的石子"),
    note: `take 场景${i + 1}·${i % 2 ? "模型落账" : "模型未落账"}`,
  }));
}

function giveTurns() {
  const combos = [
    ["干粮", "掌柜"], ["伤药", "伙计"], ["烧刀子", "掌柜"], ["玉佩", "伙计"], ["铁剑", "掌柜"],
    ["干粮", "伙计"], ["伤药", "掌柜"], ["烧刀子", "伙计"], ["玉佩", "掌柜"], ["干粮", "掌柜"],
  ];
  return combos.map(([item, target], i) => T(`把${item}送给${target}${i >= 5 ? "再" + i : ""}`, {
    kind: "give",
    narrative: narrative(`少侠把${item}递过去，${target}拱手道谢。`, {
      mvu: `_.add('角色.${target}.好感度', 2);`, memory: `赠${item}予${target}`,
      delta: { items_rm: [item] },
    }),
    intake: intake1("give", target, item, `把${item}送给${target}`),
    note: `give 场景${i + 1}·${item}→${target}`,
  }));
}

function tradeTurns() {
  return Array.from({ length: 10 }, (_, i) => {
    const buy = i % 2 === 0;
    return T(`${buy ? "向掌柜买" : "把玉佩卖给掌柜换"}${buy ? "一壶烧刀子" : "些银两"}${i > 1 ? "又来" + i : ""}`, {
      kind: "trade",
      narrative: narrative(buy ? "掌柜收了银子，递来一壶烧刀子。" : "掌柜掂了掂玉佩，数出银两。", buy
        ? { char: { money: 92 }, delta: { items_add: ["烧刀子"] } }
        : { char: { money: 120 }, delta: { items_rm: ["玉佩"] } }),
      intake: intake1("trade", "掌柜", buy ? "烧刀子" : "玉佩", buy ? "买一壶烧刀子" : "把玉佩卖给掌柜"),
      note: `trade 场景${i + 1}·${buy ? "买入" : "卖出"}`,
    });
  });
}

function stealTurns() {
  return Array.from({ length: 10 }, (_, i) => {
    const target = NPCS2[i % 2];
    const item = target === "掌柜" ? (i % 4 === 0 ? "钱袋" : "茶壶") : "抹布";
    const caught = i % 3 === 1;
    return T(`偷${target}的${item}${i > 1 ? "再试" + i : ""}`, {
      kind: "steal",
      narrative: narrative(caught
        ? `少侠刚伸手，${target}一巴掌拍开：「好你个小贼！」`
        : `少侠趁人不备把${item}袖进怀里。`, caught
        ? { char: { hp: [82, 100] }, memory: "行窃被擒" }
        : { delta: { items_add: [item] }, memory: `窃了${item}` }),
      intake: intake1("steal", target, item, `偷${target}的${item}`, { risk: "中" }),
      note: `steal 场景${i + 1}·${caught ? "被擒伤损" : "得手"}`,
    });
  });
}

function duelTurns() {
  return Array.from({ length: 10 }, (_, i) => {
    const target = NPCS2[i % 2];
    const win = i % 2 === 0;
    return T(`向${target}讨教几招${i > 1 ? "再来" + i : ""}`, {
      kind: "duel",
      narrative: narrative(win ? `三招过后${target}拱手认输。` : `少侠一个踉跄败下阵来。`, win
        ? { delta: { exp: 2 } }
        : { char: { hp: [80, 100] } }),
      intake: intake1("duel", target, "", `向${target}讨教几招`, { outcome: win ? "修习" : "伤损", risk: "中" }),
      note: `duel 场景${i + 1}·${win ? "胜" : "负"}`,
    });
  });
}

function appeaseTurns() {
  return Array.from({ length: 10 }, (_, i) => {
    const target = NPCS2[i % 2];
    const withGift = i % 2 === 0;
    return T(`向${target}赔罪${withGift ? "奉上烧刀子" : "好言相劝"}${i > 1 ? "再" + i : ""}`, {
      kind: "appease",
      narrative: narrative(withGift ? `${target}脸色稍霁，把酒收下了。` : `${target}哼了一声，气却消了几分。`, {
        mvu: `_.add('角色.${target}.好感度', 2);`,
        ...(withGift ? { delta: { items_rm: ["烧刀子"] } } : {}),
      }),
      intake: intake1("appease", target, withGift ? "烧刀子" : "", `向${target}赔罪`, { stance: "sincere" }),
      note: `appease 场景${i + 1}·${withGift ? "带礼" : "空手"}`,
    });
  });
}

function learnTurns() {
  return Array.from({ length: 10 }, (_, i) => {
    const target = NPCS2[i % 2];
    return T(`求${target}教几手${i % 2 ? "算账的本事" : "跑堂的门道"}${i > 1 ? "再求" + i : ""}`, {
      kind: "learn",
      narrative: narrative(i % 3 === 0 ? `${target}指点了几句，少侠若有所悟。` : `${target}摆摆手不肯教。`, i % 3 === 0 ? { delta: { exp: 1, pot: 1 } } : {}),
      intake: intake1("learn", target, "", `求${target}教几手`),
      note: `learn 场景${i + 1}·${i % 3 === 0 ? "有所悟" : "被拒"}`,
    });
  });
}

function inviteTurns() {
  return Array.from({ length: 10 }, (_, i) => {
    const target = NPCS2[i % 2];
    return T(`邀${target}同行闯荡${i ? "再邀" + i : ""}`, {
      kind: "invite",
      narrative: narrative(i % 2 ? `${target}摇摇头：「店里走不开。」` : `${target}沉吟半晌没有作声。`),
      intake: intake1("invite", target, "", `邀${target}同行闯荡`),
      note: `invite 场景${i + 1}`,
    });
  });
}

function itemUseTurns() {
  const uses = [["干粮", "吃下干粮充饥"], ["伤药", "敷上伤药"], ["烧刀子", "喝一口烧刀子"], ["干粮", "又啃干粮"], ["伤药", "再敷伤药"]];
  return Array.from({ length: 10 }, (_, i) => {
    const [item, act] = uses[i % uses.length];
    return T(`${act}${i >= 5 ? "第" + i : ""}`, {
      kind: "use_item",
      narrative: narrative(`少侠${act.replace(/^(吃|敷|喝|又啃|再敷)/, (m) => m)}，感觉好了些。`, {
        delta: { items_rm: [item] },
        ...(item === "伤药" ? { char: { hp: [95, 100] } } : {}),
      }),
      intake: intake1("use_item", item, ITEMS.find((x) => x.name === item)?.id || "", act, { outcome: item === "伤药" ? "服用" : "无" }),
      note: `use_item 场景${i + 1}·${item}`,
    });
  });
}

function equipTurns() {
  return Array.from({ length: 10 }, (_, i) => T(`${i % 2 ? "卸下" : "装备"}铁剑${i > 1 ? "又" + i : ""}`, {
    kind: "equip",
    narrative: narrative(i % 2 ? "少侠把铁剑解下收好。" : "少侠把铁剑佩在腰间。"),
    intake: intake1("equip", "铁剑", "sword1", i % 2 ? "卸下铁剑" : "装备铁剑"),
    note: `equip 场景${i + 1}·${i % 2 ? "卸下" : "穿戴"}`,
  }));
}

// free_act 十种 outcome × 5：伤损/得财/破费/调息/修习/服用/受寒中毒/醉酒/无/其他
function freeActTurns() {
  const outcomes = [
    { outcome: "伤损", cmd: "翻墙摔了一跤", out: "少侠脚下一滑摔下墙头。", char: { hp: [80, 100] }, risk: "低" },
    { outcome: "得财", cmd: "捡到钱袋收进怀里", out: "少侠拾起钱袋揣进怀里。", char: { money: 140 } },
    { outcome: "破费", cmd: "打赏唱曲的十两银子", out: "少侠豪掷十两，满堂喝彩。", char: { money: 90 } },
    { outcome: "调息", cmd: "打坐调息一个时辰", out: "少侠盘膝而坐气息渐匀。", delta: { pot: 1 } },
    { outcome: "修习", cmd: "修习内功心法", out: "少侠默运心法内力精进。", delta: { pot: 2 } },
    { outcome: "服用", cmd: "冲服一包药粉", out: "药粉入喉苦得皱眉。", char: { hp: [94, 100] } },
    { outcome: "受寒中毒", cmd: "误食毒蘑菇", out: "少侠腹中绞痛面无人色。", char: { hp: [72, 100] }, delta: { flags_add: ["中了菇毒"] }, risk: "中" },
    { outcome: "醉酒", cmd: "灌下三碗烈酒", out: "三碗下肚天旋地转。" },
    { outcome: "无", cmd: "坐在门槛上发呆", out: "少侠望着街面出了会儿神。" },
    { outcome: "其他", cmd: "帮伙计劈了一担柴", out: "少侠抡斧劈柴，汗透衣背。" },
  ];
  const turns = [];
  for (const spec of outcomes) {
    for (let i = 0; i < 5; i++) {
      turns.push(T(`${spec.cmd}${i ? "第" + (i + 1) + "回" : ""}`, {
        kind: "free_act", outcome: spec.outcome,
        narrative: narrative(spec.out, {
          ...(spec.char ? { char: spec.char } : {}),
          ...(spec.delta ? { delta: spec.delta } : {}),
        }),
        intake: intake1("free_act", "无", "", spec.cmd, { outcome: spec.outcome, risk: spec.risk || "无" }),
        note: `free_act outcome=${spec.outcome} #${i + 1}`,
      }));
    }
  }
  return turns;
}

// settle 三类（gift/learn_skill/companion_invite）×5：判官管线直接裁定不走影子，
// 采样如实记录「影子结构性不参与」——覆盖报告里单列，不算计量缺口。
function settleTurns() {
  const kinds = [
    { settleKind: "gift", extra: { giftInfo: { item: "烧刀子" } }, cmd: "（结算）把烧刀子赠予掌柜" },
    { settleKind: "learn_skill", extra: { learnInfo: { skill: "算账" } }, cmd: "（结算）向掌柜求学算账" },
    { settleKind: "companion_invite", extra: {}, cmd: "（结算）邀伙计同行" },
  ];
  const turns = [];
  for (const k of kinds) {
    for (let i = 0; i < 5; i++) {
      turns.push(T(`${k.cmd}#${i + 1}`, {
        kind: `settle:${k.settleKind}`,
        plan: { isSettle: true },
        settleOpts: { settle: true, settleKind: k.settleKind, settleNpc: k.settleKind === "companion_invite" ? "伙计" : "掌柜", ...k.extra },
        narrative: narrative("掌柜沉吟片刻，点了点头。"),
        intake: EMPTY_INTAKE,
        note: `settle ${k.settleKind} #${i + 1}（影子结构性不参与）`,
      }));
    }
  }
  return turns;
}

// 群聊 ×5：isTalk 且无 talkTarget、在场 NPC≥2 → groupTalkRuleBlock 路径
function groupTalkTurns() {
  return Array.from({ length: 5 }, (_, i) => T(`跟大伙打个招呼${i ? "再" + i : ""}`, {
    kind: "group_talk",
    plan: { isTalk: true, talkTarget: null, intent: { code: "TALK", label: "搭话" } },
    narrative: narrative("掌柜和伙计都抬起头，笑着应了声。"),
    intake: intake1("talk", "无", "", "跟大伙打个招呼"),
    note: `群聊 #${i + 1}`,
  }));
}

// 条件动作 ×5：condition≠无 的动作 live router 跳过不执行（S5 Review 修后不豁免，
// 单调用若落账即 single_only 如实暴露）
function conditionalTurns() {
  const conds = [["遇敌", "要是遇上劫道的就"], ["到达", "到了山口就"], ["被拒", "若掌柜不肯就"], ["其他", "万一有人来就"], ["遇敌", "倘有埋伏就"]];
  return conds.map(([cond, prefix], i) => T(`${prefix}拔剑戒备${i ? "变式" + i : ""}`, {
    kind: "conditional",
    narrative: narrative("少侠按剑四顾，并无异动。"),
    intake: intake1("free_act", "无", "", `${prefix}拔剑戒备`, { condition: cond === "其他" ? "其他" : cond, condition_text: prefix }),
    note: `条件动作 #${i + 1}·condition=${cond}`,
  }));
}

const TURNS = [
  ...talkTurns(), ...moveTurns(), ...inspectTurns(), ...takeTurns(), ...giveTurns(),
  ...tradeTurns(), ...stealTurns(), ...duelTurns(), ...appeaseTurns(), ...learnTurns(),
  ...inviteTurns(), ...itemUseTurns(), ...equipTurns(), ...freeActTurns(),
  ...settleTurns(), ...groupTalkTurns(), ...conditionalTurns(),
];

// ── per-kind/outcome 覆盖率透视 ──────────────────────────────────────────
// agg.log 每条带 cmd——按 cmd 回联脚本的 kind/outcome 标签，分列 verdict 计数。
// verdict 类目级：一个回合多类目 verdict 各计一次（覆盖率口径=回合×类目格子）。
function buildKindPerspective(agg, scripts) {
  const byCmd = new Map(scripts.map((s) => [s.cmd, s]));
  const dim = {};
  const bump = (key, cat, verdict) => {
    dim[key] = dim[key] || { turns: new Set(), cells: 0, match: 0, single_only: 0, judge_only: 0, both_diff: 0, caliber_diff: 0, excluded: 0 };
    const d = dim[key];
    d.cells += 1;
    if (d[verdict] != null) d[verdict] += 1;
  };
  const shadowedCmds = new Set();
  for (const entry of agg.log || []) {
    const s = byCmd.get(entry.cmd);
    if (!s) continue;
    for (const [cat, v] of Object.entries(entry.cats || {})) {
      bump(`kind:${s.kind}`, cat, v.verdict);
      if (s.outcome) bump(`outcome:${s.outcome}`, cat, v.verdict);
    }
  }
  // match 回合不进 agg.log——用 shadowed 总数与 log 差额补 match 近似值太绕，
  // 直白口径：透视表只统计「非 match 格子」分布 + 每维度回合数，覆盖率细看聚合表。
  for (const s of scripts) {
    const key = `kind:${s.kind}`;
    dim[key] = dim[key] || { turns: new Set(), cells: 0, match: 0, single_only: 0, judge_only: 0, both_diff: 0, caliber_diff: 0, excluded: 0 };
    dim[key].turns.add(s.cmd);
    if (s.outcome) {
      const k2 = `outcome:${s.outcome}`;
      dim[k2] = dim[k2] || { turns: new Set(), cells: 0, match: 0, single_only: 0, judge_only: 0, both_diff: 0, caliber_diff: 0, excluded: 0 };
      dim[k2].turns.add(s.cmd);
    }
  }
  return Object.fromEntries(Object.entries(dim).map(([k, d]) => [k, {
    turns: d.turns.size, nonMatchCells: d.cells,
    single_only: d.single_only || 0, judge_only: d.judge_only || 0,
    both_diff: d.both_diff || 0, caliber_diff: d.caliber_diff || 0, excluded: d.excluded || 0,
  }]));
}

const report = { turns: [], errors: [] };

describe("WO-16D-2/S6 影子覆盖率采样 harness（情景表驱动 200+ 回合）", () => {
  it("驱动情景表回合串并产出 shadow-report.json", async () => {
    // S6 配额自检：十四种 kind ≥10、free_act outcome ≥5、settle/群聊/条件 ≥5、总数 ≥200
    const kindCount = {};
    for (const s of TURNS) kindCount[s.kind] = (kindCount[s.kind] || 0) + 1;
    for (const k of ["talk", "move", "inspect_container", "take", "give", "trade", "steal", "duel", "appease", "learn", "invite", "use_item", "equip", "free_act"]) {
      expect(kindCount[k] || 0, `kind ${k} 样本不足`).toBeGreaterThanOrEqual(10);
    }
    const ocCount = {};
    for (const s of TURNS.filter((x) => x.kind === "free_act")) ocCount[s.outcome] = (ocCount[s.outcome] || 0) + 1;
    for (const oc of ["无", "伤损", "得财", "破费", "调息", "修习", "服用", "受寒中毒", "醉酒", "其他"]) {
      expect(ocCount[oc] || 0, `outcome ${oc} 样本不足`).toBeGreaterThanOrEqual(5);
    }
    expect(kindCount["settle:gift"]).toBeGreaterThanOrEqual(5);
    expect(kindCount["settle:learn_skill"]).toBeGreaterThanOrEqual(5);
    expect(kindCount["settle:companion_invite"]).toBeGreaterThanOrEqual(5);
    expect(kindCount.group_talk).toBeGreaterThanOrEqual(5);
    expect(kindCount.conditional).toBeGreaterThanOrEqual(5);
    expect(TURNS.length).toBeGreaterThanOrEqual(200);

    _resetShadowAggregates();
    initGameStore(baseState());
    const apiCfg = {
      extractionEnabled: false, shadowJudgeEnabled: true, judgePipelineEnabled: false,
      streamEnabled: false, maxTokens: 4000, bookkeepEnabled: false,
    };
    const ai = makeRouterAi(TURNS);

    const warnLines = [];
    console.warn = (...args) => { warnLines.push(args.map(String).join(" ")); };
    for (const script of TURNS) {
      const before = shadowAggregates("default").turns;
      resetBaseline();
      if (script.setup) script.setup();
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
        result = await playTurn(ctx, script.cmd, { isTalk: plan.isTalk, ...(script.settleOpts || {}) });
      } catch (e) {
        report.errors.push({ cmd: script.cmd, error: String(e?.message || e) });
        report.turns.push({ cmd: script.cmd, note: script.note, outcome: "throw" });
        continue;
      }
      let shadowed = false;
      for (let i = 0; i < 200; i++) {
        await new Promise((r) => setTimeout(r, 5));
        if (shadowAggregates("default").turns > before) { shadowed = true; break; }
      }
      const afterState = gameStore.getState();
      const turnWarns = warnLines.splice(0);
      report.turns.push({
        cmd: script.cmd, note: script.note, kind: script.kind, ...(script.outcome ? { outcome: script.outcome } : {}),
        warns: turnWarns.filter((w) => !w.startsWith("[HMR]")).slice(0, 4),
        outcome: result?.ok ? "ok" : result?.stale ? "stale" : "fail",
        shadowed,
        landed: {
          affection: Object.fromEntries(Object.entries(afterState.varTree?.角色 || {}).map(([k, v]) => [k, v?.好感度]).filter(([, v]) => v != null)),
          invCount: (afterState.inv || []).length,
          money: afterState.char?.money ?? null,
          hp: afterState.char?.hp?.[0] ?? null,
          威望: afterState.varTree?.世界?.威望 ?? null,
        },
      });
    }

    const agg = shadowAggregates("default");
    const summary = summarizeShadowCoverage(agg);
    const evaluation = evaluateShadowThresholds(summary);
    const perspective = buildKindPerspective(agg, TURNS);
    // 落盘线上同形状聚合 + 摘要 + kind/outcome 透视，供 npm run shadow:report 消费
    writeFileSync("shadow-report.json", JSON.stringify(agg, null, 2));
    writeFileSync("shadow-report-summary.json", JSON.stringify({
      summary, evaluation, perspective,
      singleOnlyTop20: (agg.samples || []).slice(0, 20),
      turns: report.turns, errors: report.errors,
    }, null, 2));
    console.log("=== shadow coverage sample (S6 情景表) ===");
    console.log(formatCoverageReport(summary, evaluation).join("\n"));
    console.log("perspective:", JSON.stringify(perspective, null, 1));
    console.log("errors:", JSON.stringify(report.errors, null, 1));
    // harness 自检：零 throw；大半回合 ok；影子采样数与「非 settle」回合一致量级
    const okTurns = report.turns.filter((t) => t.outcome === "ok" && t.shadowed).length;
    expect(report.errors).toEqual([]);
    expect(okTurns).toBeGreaterThanOrEqual(150);
    expect(agg.turns).toBeGreaterThan(0);
  }, 600000);
});

afterAll(() => {
  initGameStore({});
  turnMonitor.clear();
});
