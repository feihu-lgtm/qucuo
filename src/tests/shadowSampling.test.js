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

// 回合脚本：cmd + plan 覆盖 + 主叙事 mock（含 mvu 单调用落账）+ 影子 intake mock
const TURNS = [
  // ── talk 线：判官已接管好感签发，单调用侧好感靠模型自觉写 mvu ──
  { cmd: "掌柜，最近可好？", plan: { isTalk: true, talkTarget: "掌柜", intent: { code: "TALK", label: "搭话" } },
    narrative: narrative("掌柜笑着擦了擦柜台：「托福托福，小店还算安生。」", { mvu: "_.add('角色.掌柜.好感度', 1);" }),
    intake: intake1("talk", "掌柜", "", "掌柜，最近可好？"),
    note: "talk 寒暄·模型写+1（对照判官签发口径）" },
  { cmd: "跟伙计打听镇上的消息", plan: { isTalk: true, talkTarget: "伙计", intent: { code: "TALK", label: "搭话" } },
    narrative: narrative("伙计压低声音说了些镇上的闲事。"),
    intake: intake1("talk", "伙计", "", "跟伙计打听镇上的消息"),
    note: "talk 打听·模型不写好感（judge_only 证据面）" },
  { cmd: "骂掌柜是个奸商", plan: { isTalk: true, talkTarget: "掌柜", intent: { code: "TALK", label: "搭话" } },
    narrative: narrative("掌柜脸色一沉，别过头去不理人了。", { mvu: "_.add('角色.掌柜.好感度', -2);" }),
    intake: intake1("talk", "掌柜", "", "骂掌柜是个奸商"),
    note: "talk 冒犯·模型写-2（负向对照）" },
  { cmd: "跟掌柜闲聊天气", plan: { isTalk: true, talkTarget: "掌柜", intent: { code: "TALK", label: "搭话" } },
    narrative: narrative("掌柜抬头望了望窗外，随口应付两句。"),
    intake: intake1("talk", "掌柜", "", "跟掌柜闲聊天气"),
    note: "talk 闲谈·零效果" },
  // ── give 线：物品经 delta.items_rm 落账，好感走 mvu ──
  { cmd: "把干粮塞给掌柜", plan: {},
    narrative: narrative("少侠把干粮推过柜台，掌柜愣了愣，拱手道谢。", { mvu: "_.add('角色.掌柜.好感度', 3);", memory: "赠干粮予掌柜", delta: { items_rm: ["干粮"] } }),
    intake: intake1("give", "掌柜", "干粮", "把干粮塞给掌柜"),
    note: "give 自由文本送礼（affection+inv 双类目）" },
  { cmd: "把伤药送给伙计", plan: {},
    narrative: narrative("伙计接过伤药，喜出望外连声道谢。", { mvu: "_.add('角色.伙计.好感度', 2);", memory: "赠伤药予伙计", delta: { items_rm: ["伤药"] } }),
    intake: intake1("give", "伙计", "伤药", "把伤药送给伙计"),
    note: "give 第二件·药房类礼" },
  { cmd: "送掌柜一壶酒", plan: {},
    narrative: narrative("少侠拱手递上一壶酒，掌柜推辞再三还是收了。", { mvu: "_.add('角色.掌柜.好感度', 2);", memory: "赠酒予掌柜" }),
    intake: intake1("give", "掌柜", "酒", "送掌柜一壶酒"),
    note: "give 无实物礼（inv 不动）" },
  // ── steal 线：判官 F1 查表接管类目 ──
  { cmd: "偷偷摸走柜台的茶壶", plan: {},
    narrative: narrative("少侠趁人不备，把茶壶袖进了怀里。", { memory: "窃了茶壶", delta: { items_add: ["茶壶"] } }),
    intake: intake1("steal", "掌柜", "茶壶", "偷偷摸走柜台的茶壶"),
    note: "steal 偷窃成功面（对照判官查表签发）" },
  { cmd: "偷掌柜怀里的钱袋", plan: {},
    narrative: narrative("少侠刚伸手，掌柜一巴掌拍开：「好你个小贼！」", { char: { hp: [85, 100] }, memory: "行窃被擒" }),
    intake: intake1("steal", "掌柜", "钱袋", "偷掌柜怀里的钱袋"),
    note: "steal 被擒·伤损（vitals.hp）" },
  { cmd: "顺走伙计的抹布", plan: {},
    narrative: narrative("少侠顺手把抹布揣进怀里，伙计浑然不觉。", { delta: { items_add: ["抹布"] } }),
    intake: intake1("steal", "伙计", "抹布", "顺走伙计的抹布"),
    note: "steal 小物件成功面" },
  // ── free_act 线：调息/修习/伤损/中毒/受寒/醉酒/破费/得财 ──
  { cmd: "打坐调息一个时辰", plan: {},
    narrative: narrative("少侠盘膝而坐，气息渐匀，只觉经脉通畅了几分。", { delta: { exp: 2, pot: 1 }, memory: "打坐练功" }),
    intake: intake1("free_act", "无", "", "打坐调息一个时辰", { outcome: "调息" }),
    note: "free_act 调息（cultivation exp/pot）" },
  { cmd: "修习内功心法", plan: {},
    narrative: narrative("少侠默运心法，内力又有精进。", { delta: { exp: 3 } }),
    intake: intake1("free_act", "无", "", "修习内功心法", { outcome: "修习" }),
    note: "free_act 修习（cultivation）" },
  { cmd: "翻墙摔了一跤", plan: {},
    narrative: narrative("少侠脚下一滑摔下墙头，疼得龇牙咧嘴。", { char: { hp: [78, 100] } }),
    intake: intake1("free_act", "无", "", "翻墙摔了一跤", { outcome: "伤损", risk: "低" }),
    note: "free_act 伤损（vitals.hp -7）" },
  { cmd: "误食毒蘑菇", plan: {},
    narrative: narrative("少侠吃下野菇，腹中绞痛，面无人色。", { char: { hp: [70, 100] }, delta: { flags_add: ["中了菇毒"] } }),
    intake: intake1("free_act", "无", "", "误食毒蘑菇", { outcome: "受寒中毒", risk: "中" }),
    note: "free_act 中毒（vitals+flags 双类目）" },
  { cmd: "寒夜席地而睡", plan: {},
    narrative: narrative("夜里风寒刺骨，少侠冻得直打哆嗦。", { char: { hp: [66, 100] } }),
    intake: intake1("free_act", "无", "", "寒夜席地而睡", { outcome: "受寒中毒", risk: "低" }),
    note: "free_act 受寒（vitals）" },
  { cmd: "灌下三碗烈酒", plan: {},
    narrative: narrative("三碗下肚，少侠天旋地转，脚下打飘。"),
    intake: intake1("free_act", "无", "", "灌下三碗烈酒", { outcome: "醉酒" }),
    note: "free_act 醉酒·模型零写入（judge_only 证据面）" },
  { cmd: "打赏唱曲的十两银子", plan: {},
    narrative: narrative("少侠豪掷十两，满堂喝彩。", { char: { money: 90 } }),
    intake: intake1("free_act", "无", "", "打赏唱曲的十两银子", { outcome: "破费" }),
    note: "free_act 破费（vitals.money）" },
  { cmd: "捡到钱袋收进怀里", plan: {},
    narrative: narrative("少侠拾起钱袋掂了掂，约莫五十两，揣进怀里。", { char: { money: 150 } }),
    intake: intake1("free_act", "无", "", "捡到钱袋收进怀里", { outcome: "得财" }),
    note: "free_act 得财（vitals.money）" },
  // ── inspect_container 线：无备料/有备料 ──
  { cmd: "翻一翻柜台后面的木箱", plan: {},
    narrative: narrative("少侠探头去瞧那木箱，掌柜连忙拦住：「哎哎，那是家当。」"),
    intake: intake1("inspect_container", "木箱", "", "翻一翻柜台后面的木箱", { proposals: [{ claim: "箱里有碎银", kind: "find_item", fit: "natural" }] }),
    note: "inspect_container 无备料·被拦" },
  { cmd: "再翻客栈角落的箱笼", plan: {},
    narrative: narrative("箱笼里积着灰，翻出一串铜钱。", { delta: { items_add: ["铜钱"] } }),
    intake: intake1("inspect_container", "箱笼", "", "再翻客栈角落的箱笼"),
    note: "inspect_container 无备料·有所获" },
  { cmd: "翻一翻沉水石函", plan: { innerRoomName: "贡措海密室" },
    narrative: narrative("石函沉水多年，函盖吱呀开启，里头静静躺着一柄锈匕首。", { delta: { items_add: ["锈匕首"] } }),
    intake: intake1("inspect_container", "沉水石函", "", "翻一翻沉水石函"),
    setup: () => {
      // WO-16D-3 保真：容器三关只在「内容表声明的容器」上走——裸编容器名判官
      // 正确拒签「没什么可翻的」（那本身就是真实行为不是 gap）。把场景切到真实
      // 内层房 贡措海密室（声明了 沉水石函），备料种子按切后场景切片签发才有效。
      gameActions.setRoom({ name: "贡措海", desc: "密室", exits: [], npcs: [], items: [] });
      const s = { ...gameStore.getState(), innerRoomName: "贡措海密室" };
      const sv = prepStateVersion(s);
      gameActions.setPrepSeeds([createPrepSeed({
        id: "seed-prepitem-1", kind: "prep_item", turn: s.time, day: Math.floor((s.time || 0) / 24),
        location: "贡措海", stateVersion: sv,
        payload: { containerId: "沉水石函", name: "锈匕首", category: "weapon", quality: "白", clue: "备料线索" },
      })]);
    },
    note: "inspect_container 有备料 prep_item（真实内层房声明容器）" },
  // ── pickup/take 线 ──
  { cmd: "拾起地上的石子", plan: {},
    setup: () => {
      gameActions.setRoom(room);
      gameActions.setPrepSeeds([]);
    },
    narrative: narrative("少侠弯腰拾起那颗石子，掂了掂揣进怀里。", { delta: { items_add: ["石子"] } }),
    intake: intake1("pickup", "石子", "stone1", "拾起地上的石子"),
    note: "pickup 地上物（inv 类目）" },
  { cmd: "拿走桌上的茶壶", plan: {},
    narrative: narrative("少侠把桌上的茶壶拿了过来。"),
    intake: intake1("free_act", "茶壶", "", "拿走桌上的茶壶"),
    note: "take 拿取·模型未落账（对照判官签发）" },
  // ── equip/use_item：feature 路由专属，自由文本进 shadow 口径存疑——各一留证 ──
  { cmd: "把铁剑装备上", plan: {},
    narrative: narrative("少侠把铁剑佩在腰间。"),
    intake: intake1("equip", "铁剑", "sword1", "把铁剑装备上"),
    note: "equip 自由文本（feature 路由语义，shadow 口径或应 excluded）" },
  { cmd: "吃下干粮充饥", plan: {},
    narrative: narrative("少侠啃了几口干粮，腹中踏实了些。", { delta: { items_rm: ["干粮"] } }),
    intake: intake1("use_item", "干粮", "food1", "吃下干粮充饥"),
    note: "use_item 自由文本（feature 路由语义，留证）" },
  // ── move 线 ──
  { cmd: "出门往北走", plan: { movingDir: "n", intent: { code: "MOVE", label: "移动" } },
    narrative: narrative("少侠出了客栈，北风扑面。"),
    intake: EMPTY_INTAKE,
    note: "move 移动回合（零类目基线）" },
  // ── 世界.威望：合法 mvu 路径但 diff 类目不可见——taxonomy 结构盲区留证 ──
  { cmd: "当众羞辱掌柜", plan: { isTalk: true, talkTarget: "掌柜", intent: { code: "TALK", label: "搭话" } },
    narrative: narrative("少侠当众奚落掌柜，旁人窃窃私语。", { mvu: "_.add('世界.威望', -2);\n_.add('角色.掌柜.好感度', -3);" }),
    intake: intake1("talk", "掌柜", "", "当众羞辱掌柜"),
    note: "talk 贬损·威望 mvu 落账但 diff 不可见（taxonomy 盲区证据）" },
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

    const warnLines = [];
    const origWarn = console.warn;
    console.warn = (...args) => { warnLines.push(args.map(String).join(" ")); };
    for (const script of TURNS) {
      const before = shadowAggregates("default").turns;
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
      // WO-16D-3 关键 diff 证据：回合后实际落账切片（好感/背包/银两/气血），
      // 评审可对照影子 verdict 判断噪声还是真 gap；不含正文/key。
      const afterState = gameStore.getState();
      const turnWarns = warnLines.splice(0);
      report.turns.push({
        cmd: script.cmd, note: script.note,
        warns: turnWarns.filter((w) => !w.startsWith("[HMR]")).slice(0, 6),
        outcome: result?.ok ? "ok" : result?.stale ? "stale" : "fail",
        shadowed,
        mvuCount: result?.turn?.mvuCommands?.length ?? -1,
        parseKeys: result?.turn?.p ? Object.keys(result.turn.p).slice(0, 8) : null,
        landed: {
          affection: Object.fromEntries(Object.entries(afterState.varTree?.角色 || {}).map(([k, v]) => [k, v?.好感度]).filter(([, v]) => v != null)),
          inv: (afterState.inv || []).map((e) => e?.name || e).slice(0, 10),
          money: afterState.char?.money ?? null,
          hp: afterState.char?.hp?.[0] ?? null,
          威望: afterState.varTree?.世界?.威望 ?? null,
        },
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
