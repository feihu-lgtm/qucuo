import { describe, expect, it, vi } from "vitest";
// WO-16F-F2a 集成测试放 app 层：engine 测试不可反引 app 模块（分层门禁），
// app 层向下 import engine/store 合规。
import { runTurn } from "../../engine/runTurn.js";
import { executeJudgeRoutes } from "./judgeRoutes.js";
import { initialNarratorState } from "../../domain/rules/narrator/narrator.js";
import { emptyBodyProfile } from "../../domain/rules/character/bodyProfile.js";
import { gameActions, gameStore } from "../../store/gameStore.js";
import { bindTurnRuntime } from "../../features/turnRuntime.js";
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
  it("条件动作/纯搭话误产一律不路由（复审 blocker 修）", async () => {
    const runWith = async (action, { isTalk = false } = {}) => {
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

      // ① 条件 take：「要是没人我就捡」——前提未裁，状态不变
      seedGround(); gameActions.setInv([]);
      await runWith(mk({ condition: "其他", condition_text: "要是没人" }));
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

});
