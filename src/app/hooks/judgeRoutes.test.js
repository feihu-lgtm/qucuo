import { describe, expect, it, vi } from "vitest";
// WO-16F-F2a 集成测试放 app 层：engine 测试不可反引 app 模块（分层门禁），
// app 层向下 import engine/store 合规。
import { runTurn } from "../../engine/runTurn.js";
import { executeJudgeRoutes, resolveMoveTarget } from "./judgeRoutes.js";
import { initialNarratorState } from "../../domain/rules/narrator/narrator.js";
import { emptyBodyProfile } from "../../domain/rules/character/bodyProfile.js";
import { gameActions, gameStore } from "../../store/gameStore.js";
import { bindTurnRuntime } from "../../features/turnRuntime.js";

const spySettle = vi.hoisted(() => vi.fn());
const spyAct = vi.hoisted(() => vi.fn());
vi.mock("../runtime/gameRuntime.js", async (importOriginal) => {
  const orig = await importOriginal();
  return {
    ...orig,
    featureCtx: () => ({ ...orig.featureCtx(), settleInBackground: spySettle, act: spyAct }),
  };
});
import { getTurnContext, PHASE, turnMonitor, withTurnContext } from "../../infra/turnMonitor.js";
bindTurnRuntime({ getTurnContext, PHASE, turnMonitor, withTurnContext });

describe("WO-16F-F2a 判官路由集成", () => {
  it("WO-16F-F2a：判官链下打字装备/用物/拾取状态真实变化且叙事输入含回执；单调用零变化", async () => {
    const mkAction = (kind, item, text) => ({
      kind, target: "无", item, itemId: "", direction: "none", condition: "无",
      condition_text: "", stance: "casual", outcome: "无", risk: "无", confidence: 0.9, text,
    });
    const runOnce = async (action, apiExtra = {}) => {
      const intakeJson = JSON.stringify({ read: "x", refIds: [], actions: [action], proposals: [] });
      const narrativeInputs = [];
      const ai = {
        async chat(messages, chatOpts) {
          const all = String(chatOpts?.systemPrompt || "") + "\n" + JSON.stringify(messages || []);
          if (!all.includes("听意员")) narrativeInputs.push(all);
          if (all.includes("听意员")) return { text: intakeJson };
          return { text: '叙事一句。\n---SEAL---\n{"fills":{},"respondedNpcs":[],"spontaneousPact":null}' };
        },
      };
      const varTree = { 角色: {} };
      const deps = {
        convo: [], addLog: vi.fn(), setConvo: vi.fn(),
        apiCfg: { extractionEnabled: true, judgePipelineEnabled: true, streamEnabled: false, maxTokens: 4000, ...apiExtra },
        intent: { code: "UNKNOWN", label: "无法判定" },
        room: { name: "鱼定村", npcs: [], items: [], exits: [] },
        inv: [], char: { hp: [80, 100], special: { 气运: 5 } }, skills: [],
        varTree, memory: { varTreeLatest: varTree, recall: { lastAiText: "" } },
        gm: false, flags: [],
        narrator: initialNarratorState(), narratorStage: initialNarratorState().stage,
        scenario: "测试剧本", preset: { scenario: "测试剧本" },
        charBodyProfile: emptyBodyProfile(), charName: "少侠",
        dao: { karma: 0, jie: 0 }, questProgress: {}, companionState: {},
        time: 1, getTimeStr: () => "卯时",
        hasInnerMap: () => false, describeEquipment: () => "", describeTodayForAI: () => "",
        visibleNpcsCount: 0, npcLoreBlockWithQuest: "",
        isTalk: false,
        executeJudgeRoutes,
        ai,
      };
      await runTurn(deps, action.text);
      return narrativeInputs;
    };

    const prevInv = gameStore.getState().inv;
    try {
      // 装备：背包铁护甲从无 equipped 到 true
      gameActions.setInv([{ id: "it_a1", name: "铁护甲", category: "armor" }]);
      const inputs = await runOnce(mkAction("equip", "铁护甲", "戴上铁护甲"));
      expect(gameStore.getState().inv.find((it) => it?.id === "it_a1")?.equipped).toBe(true);
      expect(inputs.some((c) => c.includes("系统已结算·路由回执"))).toBe(true);
      expect(inputs.some((c) => c.includes("装备"))).toBe(true);

      // 用物：消耗品服下后从背包消失
      gameActions.setInv([{ id: "it_j1", name: "青稞酒", category: "misc", consumable: { sixDimTemp: { 体魄: 1 } } }]);
      const useInputs = await runOnce(mkAction("use_item", "青稞酒", "喝一口青稞酒"));
      expect(gameStore.getState().inv.find((it) => it?.id === "it_j1")).toBeUndefined();
      expect(useInputs.some((c) => c.includes("系统已结算·路由回执"))).toBe(true);

      // 拾取：地上物进背包、从房间消失
      const prevRoom = gameStore.getState().room;
      gameActions.setRoom({ ...(prevRoom || {}), name: "鱼定村", npcs: [], exits: [], items: [{ id: "it_g1", name: "遗落的皮靴" }] });
      await runOnce(mkAction("take", "遗落的皮靴", "捡起遗落的皮靴"));
      expect((gameStore.getState().inv || []).some((it) => it?.id === "it_g1")).toBe(true);
      expect((gameStore.getState().room?.items || []).some((it) => it?.id === "it_g1")).toBe(false);
      if (prevRoom) gameActions.setRoom(prevRoom);

      // 单调用模式（extractionEnabled 关）：判官链不激活，路由零执行
      gameActions.setInv([{ id: "it_a2", name: "铁护甲", category: "armor" }]);
      await runOnce(mkAction("equip", "铁护甲", "戴上铁护甲"), { extractionEnabled: false });
      expect(gameStore.getState().inv.find((it) => it?.id === "it_a2")?.equipped).toBeFalsy();
    } finally {
      gameActions.setInv(prevInv || []);
    }
  });

  it("WO-16F-F2a：找不到物件不得静默签成功——回执注入失败摘要", async () => {
    const calls = [];
    const intakeJson = JSON.stringify({
      read: "x", refIds: [],
      actions: [{ kind: "equip", target: "无", item: "屠龙宝刀", itemId: "", direction: "none", condition: "无", condition_text: "", stance: "casual", outcome: "无", risk: "无", confidence: 0.9, text: "戴上屠龙宝刀" }],
      proposals: [],
    });
    const ai = {
      async chat(messages, chatOpts) {
        const all = String(chatOpts?.systemPrompt || "") + "\n" + JSON.stringify(messages || []);
        calls.push(all);
        if (all.includes("听意员")) return { text: intakeJson };
        return { text: '叙事一句。\n---SEAL---\n{"fills":{},"respondedNpcs":[],"spontaneousPact":null}' };
      },
    };
    const varTree = { 角色: {} };
    const deps = {
      convo: [], addLog: vi.fn(), setConvo: vi.fn(),
      apiCfg: { extractionEnabled: true, judgePipelineEnabled: true, streamEnabled: false, maxTokens: 4000 },
      intent: { code: "UNKNOWN", label: "无法判定" },
      room: { name: "鱼定村", npcs: [], items: [], exits: [] },
      inv: [], char: { hp: [80, 100], special: { 气运: 5 } }, skills: [],
      varTree, memory: { varTreeLatest: varTree, recall: { lastAiText: "" } },
      gm: false, flags: [],
      narrator: initialNarratorState(), narratorStage: initialNarratorState().stage,
      scenario: "测试剧本", preset: { scenario: "测试剧本" },
      charBodyProfile: emptyBodyProfile(), charName: "少侠",
      dao: { karma: 0, jie: 0 }, questProgress: {}, companionState: {},
      time: 1, getTimeStr: () => "卯时",
      hasInnerMap: () => false, describeEquipment: () => "", describeTodayForAI: () => "",
      visibleNpcsCount: 0, npcLoreBlockWithQuest: "",
      isTalk: false,
      executeJudgeRoutes,
      ai,
    };
    await runTurn(deps, "戴上屠龙宝刀");
    // deps 是 runTurn 内部新组装的，断言走叙事输入内容
    const narrative = calls.find((c) => !c.includes("听意员")) || "";
    expect(narrative).toContain("未能如愿");
    expect(narrative).toContain("不得写成成功");
  });
  it("D3 条件动作按前提裁决路由/纯搭话误产不路由", async () => {
    const runWith = async (action, { isTalk = false, npcs = [] } = {}) => {
      const intakeJson = JSON.stringify({ read: "x", refIds: [], actions: [action], proposals: [] });
      const ai = {
        async chat(messages, chatOpts) {
          const all = String(chatOpts?.systemPrompt || "") + JSON.stringify(messages || []);
          if (all.includes("听意员")) return { text: intakeJson };
          return { text: '叙事。\n---SEAL---\n{"fills":{},"respondedNpcs":[],"spontaneousPact":null}' };
        },
      };
      const varTree = { 角色: {} };
      const deps = {
        convo: [], addLog: vi.fn(), setConvo: vi.fn(),
        apiCfg: { extractionEnabled: true, judgePipelineEnabled: true, streamEnabled: false, maxTokens: 4000 },
        intent: { code: "UNKNOWN", label: "无法判定" },
        room: { name: "鱼定村", npcs, items: [], exits: [] },
        inv: [], char: { hp: [80, 100], special: { 气运: 5 } }, skills: [],
        varTree, memory: { varTreeLatest: varTree, recall: { lastAiText: "" } },
        gm: false, flags: [],
        narrator: initialNarratorState(), narratorStage: initialNarratorState().stage,
        scenario: "测试剧本", preset: { scenario: "测试剧本" },
        charBodyProfile: emptyBodyProfile(), charName: "少侠",
        dao: { karma: 0, jie: 0 }, questProgress: {}, companionState: {},
        time: 1, getTimeStr: () => "卯时",
        hasInnerMap: () => false, describeEquipment: () => "", describeTodayForAI: () => "",
        visibleNpcsCount: npcs.length, npcLoreBlockWithQuest: "",
        isTalk, talkTarget: isTalk ? "才旦" : null,
        executeJudgeRoutes,
        ai,
      };
      await runTurn(deps, action.text);
    };
    const mk = (patch) => ({
      kind: "take", target: "无", item: "遗落的皮靴", itemId: "", direction: "none",
      condition: "无", condition_text: "", stance: "casual", outcome: "无", risk: "无", confidence: 0.9, text: "捡起遗落的皮靴",
      ...patch,
    });
    const prevInv = gameStore.getState().inv;
    const prevRoom = gameStore.getState().room;
    try {
      const seedGround = () => gameActions.setRoom({ ...(gameStore.getState().room || {}), name: "鱼定村", npcs: [], exits: [], items: [{ id: "it_g1", name: "遗落的皮靴" }] });

      // ①a D3：条件 take「要是没人」+ 场上真没人——前提成立，照常路由执行
      seedGround(); gameActions.setInv([]);
      await runWith(mk({ condition: "其他", condition_text: "要是没人" }));
      expect((gameStore.getState().inv || []).some((it) => it?.id === "it_g1")).toBe(true);

      // ①b D3：条件 take「要是没人」+ 场上有人——前提未成立，不执行且状态不变
      seedGround(); gameActions.setInv([]);
      await runWith(mk({ condition: "其他", condition_text: "要是没人" }), { npcs: [{ name: "才旦" }] });
      expect((gameStore.getState().inv || []).some((it) => it?.id === "it_g1")).toBe(false);
      expect((gameStore.getState().room?.items || []).some((it) => it?.id === "it_g1")).toBe(true);

      // ② 纯搭话误产 take：talkOnly 禁止硬事实——状态不变
      seedGround(); gameActions.setInv([]);
      await runWith(mk({}), { isTalk: true });
      expect((gameStore.getState().inv || []).some((it) => it?.id === "it_g1")).toBe(false);

      // ③ 无条件非搭话：照常执行（对照）
      seedGround(); gameActions.setInv([]);
      await runWith(mk({}));
      expect((gameStore.getState().inv || []).some((it) => it?.id === "it_g1")).toBe(true);
    } finally {
      gameActions.setInv(prevInv || []);
      if (prevRoom) gameActions.setRoom(prevRoom);
    }
  });

  it("同名两件按 itemId 命中正确副本（Review 修）", async () => {
    gameActions.setInv([
      { id: "it_new", name: "青稞酒", category: "misc", consumable: { sixDimTemp: { 体魄: 1 } } },
      { id: "it_old", name: "青稞酒", category: "misc", consumable: { sixDimTemp: { 体魄: 1 } } },
    ]);
    const out = executeJudgeRoutes([{ kind: "use_item", item: "青稞酒", itemId: "it_new", target: "无", text: "喝一口青稞酒" }]);
    expect(out.receipts[0].ok).toBe(true);
    const ids = (gameStore.getState().inv || []).map((it) => it?.id);
    expect(ids).toEqual(["it_old"]);  // 吃的是 it_new 不是第一件
    gameActions.setInv([]);
  });

  it("A0：自由打字用物不提前扣时辰/写 convo（commitRound 统一推进）", async () => {
    gameActions.setInv([{ id: "it1", name: "青稞酒", category: "misc", consumable: { sixDimTemp: { 体魄: 1 } } }]);
    const timeBefore = gameStore.getState().time;
    const convoBefore = (gameStore.getState().convo || []).length;
    const out = executeJudgeRoutes([{ kind: "use_item", item: "青稞酒", itemId: "it1", target: "无", text: "喝一口青稞酒" }]);
    expect(out.receipts[0].ok).toBe(true);
    expect(gameStore.getState().time).toBe(timeBefore); // 路由不提前 +1，否则双倍扣时辰
    expect((gameStore.getState().convo || []).length).toBe(convoBefore);
    gameActions.setInv([]);
  });

  it("D1：兵刃演练端详零状态改动且 ok（未装备带可佩挂提示）", async () => {
    gameActions.setInv([{ id: "it_sw", name: "鱼定枪", category: "weapon", equipped: false }]);
    const invBefore = JSON.stringify(gameStore.getState().inv);
    const timeBefore = gameStore.getState().time;
    const out = executeJudgeRoutes([{ kind: "use_item", item: "鱼定枪", itemId: "it_sw", target: "无", text: "拔出鱼定枪演练几式" }]);
    expect(out.receipts[0].ok).toBe(true);
    expect(out.receipts[0].text).toContain("端详");
    expect(out.receipts[0].text).toContain("可佩挂");
    expect(JSON.stringify(gameStore.getState().inv)).toBe(invBefore);
    expect(gameStore.getState().time).toBe(timeBefore);
    gameActions.setInv([]);
  });

  it("D1：已装备兵刃演练为「随身已佩」口径", async () => {
    gameActions.setInv([{ id: "it_sw2", name: "鱼定枪", category: "weapon", equipped: true }]);
    const out = executeJudgeRoutes([{ kind: "use_item", item: "鱼定枪", itemId: "it_sw2", target: "无", text: "演练鱼定枪" }]);
    expect(out.receipts[0].ok).toBe(true);
    expect(out.receipts[0].text).toContain("随身已佩");
    expect(out.receipts[0].text).not.toContain("可佩挂");
    gameActions.setInv([]);
  });

  it("D1 Review 修：accessory 邀帖（无数值加持）出示而非演练", async () => {
    gameActions.setInv([{ id: "starter_letter", name: "赌石邀帖", category: "accessory", quality: "白", equipped: true, durability: 25 }]);
    const out = executeJudgeRoutes([{ kind: "use_item", item: "赌石邀帖", itemId: "starter_letter", target: "无", text: "亮出赌石邀帖说明来意" }]);
    expect(out.receipts[0].ok).toBe(true);
    expect(out.receipts[0].text).toContain("当场出示或查验");
    expect(out.receipts[0].text).not.toContain("端详");
    gameActions.setInv([]);
  });

  it("D1：凭帖钥匙杂物出示零状态改动", async () => {
    gameActions.setInv([{ id: "it_let", name: "赌石邀帖", category: "misc" }]);
    const invBefore = JSON.stringify(gameStore.getState().inv);
    const out = executeJudgeRoutes([{ kind: "use_item", item: "赌石邀帖", itemId: "it_let", target: "无", text: "亮出赌石邀帖" }]);
    expect(out.receipts[0].ok).toBe(true);
    expect(out.receipts[0].text).toContain("当场出示或查验");
    expect(out.receipts[0].text).toContain("未签发任何额外得失事实");
    expect(JSON.stringify(gameStore.getState().inv)).toBe(invBefore);
    gameActions.setInv([]);
  });

  it("D1：耗材服用走消耗账（物件减少+回执服用生效）", async () => {
    gameActions.setInv([{ id: "it_w3", name: "青稞酒", category: "misc", consumable: { sixDimTemp: { 体魄: 1 } } }]);
    const out = executeJudgeRoutes([{ kind: "use_item", item: "青稞酒", itemId: "it_w3", target: "无", text: "喝一口青稞酒" }]);
    expect(out.receipts[0].ok).toBe(true);
    expect(out.receipts[0].text).toContain("已服用生效");
    expect(gameStore.getState().inv).toHaveLength(0);
    gameActions.setInv([]);
  });

  it("D1 classifyUseItem 纯函数三分流", async () => {
    const { classifyUseItem } = await import("./judgeRoutes.js");
    const state = { inv: [] };
    expect(classifyUseItem(state, { name: "青稞酒", consumable: { hpDelta: 1 } })).toBe("consumable");
    expect(classifyUseItem(state, { name: "鱼定枪", category: "weapon" })).toBe("wield");
    expect(classifyUseItem(state, { name: "铁护甲", category: "armor" })).toBe("wield");
    expect(classifyUseItem(state, { name: "玉佩", category: "accessory", sixDim: { 魅力: 1 } })).toBe("wield");
    // Review 修：accessory 纸面凭帖无数值加持走出示（赌石邀帖 starter）
    expect(classifyUseItem(state, { name: "赌石邀帖", category: "accessory", quality: "白", equipped: true, durability: 25 })).toBe("present");
    expect(classifyUseItem(state, { name: "赌石邀帖", category: "misc" })).toBe("present");
    expect(classifyUseItem(state, { name: "溪边小屋钥匙", category: "misc" })).toBe("present");
    // noCatalog 盾：撞图鉴名也不吃图鉴药效
    expect(classifyUseItem(state, { name: "青稞酒", category: "misc", noCatalog: true })).toBe("present");
  });

  it("名/号矛盾不动错物（Review 修）", async () => {
    gameActions.setInv([
      { id: "it_sword", name: "铁剑", category: "weapon" },
      { id: "it_wine", name: "青稞酒", category: "misc", consumable: { sixDimTemp: { 体魄: 1 } } },
    ]);
    // 请求名是青稞酒，itemId 却指铁剑——宁可失败也不得吃铁剑/穿错物
    const out = executeJudgeRoutes([{ kind: "use_item", item: "青稞酒", itemId: "it_sword", target: "无", text: "喝青稞酒" }]);
    expect(out.receipts[0].ok).toBe(false);
    expect(gameStore.getState().inv).toHaveLength(2);
    gameActions.setInv([]);
  });

  it("pickup/equip 名/号矛盾状态不变（抽核 blocker 修）", async () => {
    // pickup：地上两件同名不同号？不——矛盾是名配别物之号。地上放铁剑(it_gnd_sword)与皮靴(it_gnd_boot)，
    // 请求「捡起遗落的皮靴」却配 it_gnd_sword——绝不可捡起任何一件。
    gameActions.setRoom({ name: "鱼定村", npcs: [], exits: [], items: [
      { id: "it_gnd_sword", name: "铁剑" },
      { id: "it_gnd_boot", name: "遗落的皮靴" },
    ] });
    gameActions.setInv([]);
    const out1 = executeJudgeRoutes([{ kind: "take", item: "遗落的皮靴", itemId: "it_gnd_sword", target: "无", text: "捡起遗落的皮靴" }]);
    expect(out1.receipts[0].ok).toBe(false);
    expect(gameStore.getState().inv).toHaveLength(0);
    expect((gameStore.getState().room?.items || [])).toHaveLength(2);

    // equip：铁剑之名配酒之号——不得穿上任何装备
    gameActions.setInv([
      { id: "it_sword", name: "铁剑", category: "weapon" },
      { id: "it_wine", name: "青稞酒", category: "misc" },
    ]);
    const out2 = executeJudgeRoutes([{ kind: "equip", item: "铁剑", itemId: "it_wine", target: "无", text: "装备铁剑" }]);
    expect(out2.receipts[0].ok).toBe(false);
    expect((gameStore.getState().inv || []).every((it) => !it?.equipped)).toBe(true);

    // 对照：id 不存在按名兜底仍可用——请求皮靴配一个查无的号
    const out3 = executeJudgeRoutes([{ kind: "take", item: "遗落的皮靴", itemId: "it_ghost", target: "无", text: "捡起遗落的皮靴" }]);
    expect(out3.receipts[0].ok).toBe(true);
    expect((gameStore.getState().inv || []).some((it) => it?.id === "it_gnd_boot")).toBe(true);
    gameActions.setInv([]);
    gameActions.setRoom({ name: "鱼定村", npcs: [], exits: [], items: [] });
  });

  it("invite 路由：可邀目标成功/普通 NPC 失败/条件与 talkOnly 不执行/单调用零变化", async () => {
    const mkDeps = ({ action, isTalk = false, judgeOn = true, npcs = [] }) => {
      const intakeJson = JSON.stringify({ read: "x", refIds: [], actions: action ? [action] : [], proposals: [] });
      const calls = [];
      const ai = {
        async chat(messages, chatOpts) {
          const all = String(chatOpts?.systemPrompt || "") + JSON.stringify(messages || []);
          calls.push(all);
          if (all.includes("听意员")) return { text: intakeJson };
          return { text: '叙事。\n---SEAL---\n{"fills":{},"respondedNpcs":[],"spontaneousPact":null}' };
        },
      };
      const varTree = { 角色: {} };
      return { deps: {
        convo: [], addLog: vi.fn(), setConvo: vi.fn(),
        apiCfg: { extractionEnabled: judgeOn, judgePipelineEnabled: judgeOn, streamEnabled: false, maxTokens: 4000 },
        intent: { code: "UNKNOWN", label: "无法判定" },
        room: { name: "鱼定村", npcs, items: [], exits: [] },
        inv: [], char: { hp: [80, 100], special: { 气运: 5 } }, skills: [],
        varTree, memory: { varTreeLatest: varTree, recall: { lastAiText: "" } },
        gm: false, flags: [],
        narrator: initialNarratorState(), narratorStage: initialNarratorState().stage,
        scenario: "测试剧本", preset: { scenario: "测试剧本" },
        charBodyProfile: emptyBodyProfile(), charName: "少侠",
        dao: { karma: 0, jie: 0 }, questProgress: {}, companionState: {},
        time: 1, getTimeStr: () => "卯时",
        hasInnerMap: () => false, describeEquipment: () => "", describeTodayForAI: () => "",
        visibleNpcsCount: npcs.length, npcLoreBlockWithQuest: "",
        isTalk, talkTarget: isTalk ? "才旦" : null,
        executeJudgeRoutes,
        ai,
      }, calls };
    };
    const mk = (patch) => ({
      kind: "invite", target: "阿岚", item: "无", itemId: "", direction: "none",
      condition: "无", condition_text: "", stance: "casual", outcome: "无", risk: "无", confidence: 0.9, text: "邀阿岚同行",
      ...patch,
    });
    const prevComp = gameStore.getState().companionState;
    const prevRoom = gameStore.getState().room;
    try {
      const seedImported = () => {
        const npc = { name: "阿岚", imported: true, companionCandidate: true };
        gameActions.setRoom({ name: "鱼定村", npcs: [npc], exits: [], items: [] });
        gameActions.setCompanionState({});
      };
      const unlockedKeys = () => Object.keys(gameStore.getState().companionState || {}).filter((k) => gameStore.getState().companionState[k]?.unlocked);

      // ① 成功：可邀 imported 目标 → 同伴解锁 + 叙事输入含回执
      seedImported();
      const d1 = mkDeps({ action: mk({}), npcs: [{ name: "阿岚", imported: true, companionCandidate: true }] });
      await runTurn(d1.deps, "邀阿岚同行");
      expect(unlockedKeys().length).toBeGreaterThan(0);
      const narrative1 = d1.calls.find((c) => !c.includes("听意员")) || "";
      expect(narrative1).toContain("系统已结算·路由回执");

      // ② 失败：普通 NPC 空结果 → 无解锁 + 失败回执入叙事
      gameActions.setRoom({ name: "鱼定村", npcs: [{ name: "才旦" }], exits: [], items: [] });
      gameActions.setCompanionState({});
      const d2 = mkDeps({ action: mk({ target: "才旦" }), npcs: [{ name: "才旦" }] });
      await runTurn(d2.deps, "邀才旦同行");
      expect(unlockedKeys().length).toBe(0);
      const narrative2 = d2.calls.find((c) => !c.includes("听意员")) || "";
      expect(narrative2).toContain("未能如愿");
      expect(narrative2).toContain("不得写成成功");

      // ③ 条件 invite 不执行
      seedImported();
      const d3 = mkDeps({ action: mk({ condition: "其他", condition_text: "要是她愿意" }), npcs: [{ name: "阿岚" }] });
      await runTurn(d3.deps, "要是她愿意我就邀阿岚同行");
      expect(unlockedKeys().length).toBe(0);

      // ④ talkOnly 误产 invite 不执行
      seedImported();
      const d4 = mkDeps({ action: mk({}), isTalk: true, npcs: [{ name: "阿岚" }] });
      await runTurn(d4.deps, "邀阿岚同行");
      expect(unlockedKeys().length).toBe(0);

      // ⑤ 单调用（判官链关）零变化
      seedImported();
      const d5 = mkDeps({ action: mk({}), judgeOn: false, npcs: [{ name: "阿岚" }] });
      await runTurn(d5.deps, "邀阿岚同行");
      expect(unlockedKeys().length).toBe(0);
    } finally {
      gameActions.setCompanionState(prevComp || {});
      if (prevRoom) gameActions.setRoom(prevRoom);
    }
  });

  it("invite 路由剥 settle 防递归：成功/生气 appease 岔路均不触发二次 settle（返修 blocker）", async () => {
    const prevComp = gameStore.getState().companionState;
    const prevRoom = gameStore.getState().room;
    const prevTree = gameStore.getState().varTree;
    try {
      spySettle.mockClear(); spyAct.mockClear();
      // ① 成功 imported companion：落 companionState 但替身零调用
      gameActions.setRoom({ name: "鱼定村", npcs: [{ name: "阿岚", imported: true, companionCandidate: true }], exits: [], items: [] });
      gameActions.setCompanionState({});
      const ok = executeJudgeRoutes([{ kind: "invite", target: "阿岚", item: "无", text: "邀阿岚同行" }]);
      expect(ok.receipts[0].ok).toBe(true);
      expect(ok.receipts[0].text).toContain("已应允同行");
      expect(Object.keys(gameStore.getState().companionState || {}).some((k) => gameStore.getState().companionState[k]?.unlocked)).toBe(true);
      expect(spySettle).not.toHaveBeenCalled();
      expect(spyAct).not.toHaveBeenCalled();

      // ② 生气 NPC：appease 岔路不判成功、递归计数仍为 0
      gameActions.setVarTree({ 角色: { 才旦: { 生气状态: { active: true } } } });
      gameActions.setRoom({ name: "鱼定村", npcs: [{ name: "才旦", imported: true, companionCandidate: true }], exits: [], items: [] });
      gameActions.setCompanionState({});
      const angry = executeJudgeRoutes([{ kind: "invite", target: "才旦", item: "无", text: "邀才旦同行" }]);
      expect(angry.receipts[0].ok).toBe(false);
      expect(Object.keys(gameStore.getState().companionState || {}).some((k) => gameStore.getState().companionState[k]?.unlocked)).toBe(false);
      expect(spySettle).not.toHaveBeenCalled();
      expect(spyAct).not.toHaveBeenCalled();
    } finally {
      gameActions.setCompanionState(prevComp || {});
      if (prevRoom) gameActions.setRoom(prevRoom);
      if (prevTree) gameActions.setVarTree(prevTree);
    }
  });

});

describe("S7 move 路由：内层移动确定性结算", () => {
  const mkMove = (direction, text) => ({
    kind: "move", target: "无", item: "无", itemId: "", direction, condition: "无",
    condition_text: "", stance: "casual", outcome: "无", risk: "无", confidence: 0.9, text,
  });
  function setupInnerRoom() {
    const prev = gameStore.getState();
    gameActions.setRoom({ name: "鱼定村", npcs: [], items: [], exits: [] });
    gameStore.setState({ innerRoomName: "村口", convo: [], flags: [], questProgress: {}, inv: [], char: { hp: [80, 100] }, varTree: {}, time: 6 });
    return prev;
  }

  it("内层有效方向：执行 innerMove 同一套账，回执成功", () => {
    const prev = setupInnerRoom();
    try {
      const { receipts } = executeJudgeRoutes([mkMove("e", "去东边看看")]);
      expect(receipts[0].ok).toBe(true);
      expect(receipts[0].text).toContain("系统已结算");
      expect(gameStore.getState().innerRoomName).toBe("歇马居");
    } finally {
      gameStore.setState({ innerRoomName: prev.innerRoomName, room: prev.room, convo: prev.convo, time: prev.time });
    }
  });

  it("评审 blocker：路由移动不提前扣回合/不提前写 convo（commitRound 统一推进）", () => {
    const prev = setupInnerRoom();
    try {
      gameStore.setState({ time: 6, convo: [] });
      const timeBefore = gameStore.getState().time;
      const convoLenBefore = (gameStore.getState().convo || []).length;
      executeJudgeRoutes([mkMove("e", "去东边看看")]);
      expect(gameStore.getState().innerRoomName).toBe("歇马居"); // 位移照结
      expect(gameStore.getState().time).toBe(timeBefore); // 时间不提前 +1
      expect((gameStore.getState().convo || []).length).toBe(convoLenBefore); // convo 不提前追加
    } finally {
      gameStore.setState({ innerRoomName: prev.innerRoomName, room: prev.room, convo: prev.convo, time: prev.time });
    }
  });

  it("direction none/无效：失败回执不得写成已移动", () => {
    setupInnerRoom();
    const { receipts } = executeJudgeRoutes([mkMove("none", "走走")]);
    expect(receipts[0].ok).toBe(false);
    // D4：无地名无方向走「查无此地/方向不明」确定拦截文案
    expect(receipts[0].text).toContain("系统未移动");
    expect(receipts[0].text).toContain("严禁编造");
  });

  it("D4：无内层箱庭据点的外层方向移动——相邻已解锁真实位移（雪山派向北进山洞）", () => {
    const prevCache = gameStore.getState().roomCache;
    try {
      gameActions.setRoom({ name: "雪山派", npcs: [], items: [], exits: ["e", "n"] });
      gameStore.setState({ innerRoomName: null, roomCache: { 山洞: { npcs: [], items: [] } } });
      const { receipts } = executeJudgeRoutes([mkMove("n", "往北走")]);
      expect(receipts[0].ok).toBe(true);
      expect(receipts[0].text).toContain("赶至「山洞」");
      expect(gameStore.getState().room?.name).toBe("山洞");
      // F3-T11：首访无缓存不再硬判负——合成空条目照样位移（驻场 NPC 由世界规则注入）
      gameActions.setRoom({ name: "雪山派", npcs: [], items: [], exits: ["e", "n"] });
      gameStore.setState({ roomCache: {} });
      const miss = executeJudgeRoutes([mkMove("n", "往北走")]);
      expect(miss.receipts[0].ok).toBe(true);
      expect(gameStore.getState().room?.name).toBe("山洞");
    } finally {
      gameStore.setState({ roomCache: prevCache });
    }
  });

  it("内层锁门不穿帮：无钥匙进溪边小屋被挡，失败回执带锁因", () => {
    const prev = setupInnerRoom();
    try {
      // 村口·广场向北是溪边小屋，unlockCondition 要钥匙——空手被挡
      gameStore.setState({ innerRoomName: "村口·广场" });
      const { receipts } = executeJudgeRoutes([mkMove("n", "往北走")]);
      expect(receipts[0].ok).toBe(false);
      expect(receipts[0].text).toContain("系统未结算");
      expect(gameStore.getState().innerRoomName).toBe("村口·广场"); // 原地未动
    } finally {
      gameStore.setState({ innerRoomName: prev.innerRoomName, room: prev.room, convo: prev.convo, time: prev.time });
    }
  });
});

describe("D4 外层自然语言移动确定性路由", () => {
  const mkState = (over = {}) => ({
    room: { name: "鱼定村", npcs: [], items: [], exits: ["w", "n", "s", "e"] },
    innerRoomName: null, questProgress: {}, flags: [], inv: [], char: {}, varTree: {},
    roomCache: { 喇嘛庙: { npcs: [], items: [] }, 大草甸: { npcs: [], items: [] }, 天龙营: { npcs: [], items: [] } },
    ...over,
  });
  const mkAction = (over = {}) => ({
    kind: "move", target: "无", item: "无", itemId: "", direction: "none", condition: "无",
    condition_text: "", stance: "casual", outcome: "无", risk: "无", confidence: 0.9, text: "",
    ...over,
  });

  it("target 填相邻地名反查方向 → outer", () => {
    const r = resolveMoveTarget(mkState(), mkAction({ target: "喇嘛庙", text: "去喇嘛庙" }));
    expect(r).toEqual({ type: "outer", dir: "n", dest: "喇嘛庙" });
  });
  it("direction 有效 → 直接外层解析", () => {
    const r = resolveMoveTarget(mkState(), mkAction({ direction: "s" }));
    expect(r).toEqual({ type: "outer", dir: "s", dest: "大草甸" });
  });
  it("原文提及据点名（target 无）也能提取", () => {
    const r = resolveMoveTarget(mkState(), mkAction({ text: "我想去大草甸走走" }));
    expect(r).toEqual({ type: "outer", dir: "s", dest: "大草甸" });
  });
  it("「回村」在鱼定周边映射鱼定村", () => {
    const r = resolveMoveTarget(mkState({ room: { name: "大草甸", npcs: [], exits: [] } }), mkAction({ text: "回村" }));
    expect(r).toEqual({ type: "outer", dir: "n", dest: "鱼定村" });
  });
  it("隔站不直通：天都镇在图但不相邻 → unreachable", () => {
    const r = resolveMoveTarget(mkState(), mkAction({ target: "天都镇", text: "去天都镇" }));
    expect(r.type).toBe("unreachable");
    expect(r.target).toBe("天都镇");
  });
  it("未解锁拦截：天龙营相邻但无信物 → locked；持通行旗 → outer", () => {
    const atMeadow = mkState({ room: { name: "大草甸", npcs: [], exits: [] } });
    const locked = resolveMoveTarget(atMeadow, mkAction({ target: "天龙营", text: "去天龙营" }));
    expect(locked.type).toBe("locked");
    expect(locked.dest).toBe("天龙营");
    const open = resolveMoveTarget(mkState({ room: { name: "大草甸", npcs: [], exits: [] }, flags: ["tianlong_pass_token"] }), mkAction({ target: "天龙营" }));
    expect(open).toEqual({ type: "outer", dir: "w", dest: "天龙营" });
  });
  it("查无此地：不在图的名字 → unknown", () => {
    const r = resolveMoveTarget(mkState(), mkAction({ target: "亚特兰蒂斯", text: "去亚特兰蒂斯" }));
    expect(r.type).toBe("unknown");
  });
  it("无地名无方向 → unknown", () => {
    const r = resolveMoveTarget(mkState(), mkAction({ text: "走走" }));
    expect(r.type).toBe("unknown");
  });

  it("F3-T13：虚构地名+方向词 → unknown 拦截，方向词救不回来", () => {
    const state = mkState({ innerRoomName: "村口" });
    const r = resolveMoveTarget(state, mkAction({ target: "忘忧谷", direction: "s", text: "往南边树林深处的忘忧谷走进去探探路" }));
    expect(r.type).toBe("unknown");
    expect(r.target).toBe("忘忧谷");
  });
  it("F3-T13：target 空时方向词仍走内层拓扑（不回归）", () => {
    const state = mkState({ innerRoomName: "村口" });
    const r = resolveMoveTarget(state, mkAction({ direction: "s", text: "往南走" }));
    expect(r).toEqual({ type: "inner", dir: "s" });
  });
  it("F3-T11：首访无 roomCache 的相邻目的地真实位移（真机：大草甸）", () => {
    const prevRoom = gameStore.getState().room;
    const prevCache = gameStore.getState().roomCache;
    const prevInner = gameStore.getState().innerRoomName;
    try {
      gameActions.setRoom({ name: "鱼定村", npcs: [], items: [], exits: ["w", "n", "s", "e"] });
      // 首访：roomCache 没有大草甸
      gameStore.setState({ roomCache: {}, innerRoomName: "村口" });
      const { receipts } = executeJudgeRoutes([mkAction({ target: "大草甸", text: "顺着山路去大草甸看看" })]);
      expect(receipts[0].ok).toBe(true);
      expect(receipts[0].text).toContain("赶至「大草甸」");
      expect(gameStore.getState().room?.name).toBe("大草甸");
      // 落地骨架正确：exits/desc 取自固定地图节点
      expect(gameStore.getState().room?.exits).toEqual(expect.arrayContaining(["n", "e", "s", "w"]));
    } finally {
      gameStore.setState({ roomCache: prevCache, innerRoomName: prevInner });
      gameActions.setRoom(prevRoom);
    }
  });

  it("executeJudgeRoutes：外层相邻已解锁真实位移且剥 time/convo；隔站/未解锁/未知三类零位移", () => {
    const prevRoom = gameStore.getState().room;
    const prevCache = gameStore.getState().roomCache;
    const prevInner = gameStore.getState().innerRoomName;
    try {
      gameActions.setRoom({ name: "鱼定村", npcs: [], items: [], exits: ["w", "n", "s", "e"] });
      gameStore.setState({ roomCache: { 喇嘛庙: { npcs: [], items: [] } }, innerRoomName: null });
      const timeBefore = gameStore.getState().time;

      // 相邻已解锁 → 真位移到喇嘛庙
      const ok = executeJudgeRoutes([mkAction({ target: "喇嘛庙", text: "去喇嘛庙" })]);
      expect(ok.receipts[0].ok).toBe(true);
      expect(ok.receipts[0].text).toContain("赶至「喇嘛庙」");
      expect(gameStore.getState().room?.name).toBe("喇嘛庙");
      // 剥 time/convo：路由不加时辰（commitRound 统一加）
      expect(gameStore.getState().time).toBe(timeBefore);

      // 复位后三类拦截零位移
      gameActions.setRoom({ name: "鱼定村", npcs: [], items: [], exits: ["w", "n", "s", "e"] });
      const far = executeJudgeRoutes([mkAction({ target: "天都镇", text: "去天都镇" })]);
      expect(far.receipts[0].ok).toBe(false);
      expect(far.receipts[0].text).toContain("没有直通「天都镇」的道路");
      expect(gameStore.getState().room?.name).toBe("鱼定村");

      const locked = executeJudgeRoutes([mkAction({ target: "天龙营", text: "去天龙营" })]);
      expect(locked.receipts[0].ok).toBe(false);
      expect(gameStore.getState().room?.name).toBe("鱼定村");

      const unknown = executeJudgeRoutes([mkAction({ target: "亚特兰蒂斯", text: "去亚特兰蒂斯" })]);
      expect(unknown.receipts[0].ok).toBe(false);
      expect(unknown.receipts[0].text).toContain("并无此去处");
      expect(gameStore.getState().room?.name).toBe("鱼定村");
    } finally {
      if (prevRoom) gameActions.setRoom(prevRoom);
      gameStore.setState({ roomCache: prevCache, innerRoomName: prevInner });
    }
  });
});
