import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createCliPromptContext, createSession } from "../../../cli/runner.mjs";
import { buildPresence, buildNpcContext, buildQuestStageNote, buildForcedEventNote, buildArrivalNote, createPromptContext, assemblePrompt } from "./index.js";
import { QUCUO_QUESTS } from "../../quests/qucuoQuests.js";
import { getDistrictAnchor } from "../../innerMap.js";
import { callMainOnce } from "../../act/actCall.js";
import { emptyBodyProfile } from "../../bodyProfile.js";
import { initialNarratorState } from "../../narrator.js";
import { defaultConfig } from "../../apiConfig.js";
import { classifyIntent } from "../../inputIntent.js";
import { gameActions } from "../../core/gameStore.js";
import { createMockAi } from "../ports/ai.js";
import { COMPANION_LORE } from "../../companion.js";
import { getCompanionDescForm } from "../../companionForms.js";

function fixture() {
  return {
    room: { name: "荒野", npcs: [{ name: "故人" }], items: [], exits: [] },
    char: { name: "少侠", hp: [100, 100] }, inv: [], skills: [],
    dao: { karma: 0, jie: 0 }, flags: [], questProgress: {},
    varTree: { 世界: { 已认识人物: ["故人"], 上次同框回合: { 故人: 0 } } },
    preset: { scenario: "江湖往事", npcLore: [{ name: "故人", entry: "旧时的朋友" }] },
    convo: [{ role: "assistant", content: "故人还在等你。" }],
    companionState: {}, time: 300, nsfwOn: false, gm: false, isTalk: false,
  };
}

describe("pure prompt builders", () => {
  it("preserves caller values and uses the explicit tally time across a day boundary", () => {
    const state = {
      ...fixture(), time: 24, timeForToday: 23,
      categoryLabel: { misc: "自定义分类" }, quality: ["自定义品阶"],
      varTree: { 世界: { 起居注: { today: { meditate: 2 }, dayStamp: 0 } } },
    };
    const args = { apiCfg: defaultConfig(), intent: classifyIntent("你好") };
    const prompt = createPromptContext(state, args);
    for (const [key, value] of Object.entries(state)) {
      expect(prompt[key]).toBe(value);
    }
    const assembled = assemblePrompt({ prompt }, "你好", {}, [], [], "", []);
    expect(assembled.ctx).toContain("[今日行迹] 打坐调息2次");
    expect(createPromptContext({ ...state, timeForToday: undefined }).timeForToday).toBe(24);
    expect(createPromptContext({ ...state, timeForToday: null }).timeForToday).toBe(24);
    expect(createPromptContext({ ...state, timeForToday: 0 }).timeForToday).toBe(0);
    expect(createPromptContext(state, { timeForToday: 48, quality: ["覆盖"] })).toMatchObject({
      timeForToday: 48, quality: ["覆盖"],
    });
    const customBuilder = () => "自定义";
    expect(createPromptContext({ ...state, describeEquipment: customBuilder }).describeEquipment).toBe(customBuilder);
  });

  it("uses beast as the unset or unavailable appearance fallback for all lore companions", () => {
    const state = fixture();
    const keys = Object.keys(COMPANION_LORE);
    for (const getItem of [() => null, () => { throw new Error("unavailable"); }]) {
      vi.stubGlobal("localStorage", { getItem });
      try {
        for (const key of keys) {
          expect(getCompanionDescForm(key)).toBe("beast");
          const args = {
            ...state, cmd: "", visibleNpcs: [],
            companionState: { [key]: { unlocked: true, active: true, data: { name: key } } },
          };
          expect(buildNpcContext(args)).toEqual(buildNpcContext({
            ...args, companionForms: { [key]: getCompanionDescForm(key) },
          }));
        }
      } finally {
        vi.unstubAllGlobals();
      }
    }
    const webSource = readFileSync(new URL("../../app/hooks/useTurn.js", import.meta.url), "utf8");
    expect(webSource).toContain("Object.keys(COMPANION_LORE).map(key => [key, getCompanionDescForm(key)])");
  });

  it("filters inner rooms, bypasses filtering on arrival, and includes companions without mutating state", () => {
    const state = fixture();
    state.room.name = "鱼定村";
    const innerRoomName = getDistrictAnchor(state.room.name);
    state.room.npcs = [{ name: "外客", innerRoom: "别处" }];
    const companionState = { snowLeopard: { unlocked: true, active: true, data: { name: "雪豹" } } };
    const input = { ...state, innerRoomName, companionState };
    const before = structuredClone(input);
    expect(buildPresence(input)).toEqual({ visibleNpcs: [], visibleNpcsForAI: [{ name: "雪豹" }] });
    expect(buildPresence({ ...input, lockedDestName: "远方" }).visibleNpcs).toEqual(state.room.npcs);
    expect(buildPresence({ ...input, isTalk: true, lockedDestName: "远方" }).visibleNpcs).toEqual([]);
    expect(input).toEqual(before);
    expect(() => buildPresence({})).toThrow();
  });

  it("builds NPC lore, imported lore, quest relationships, reunion notes, and explicit companion forms", () => {
    const state = fixture();
    const quest = QUCUO_QUESTS.find(q => q.giver && q.stages?.length);
    state.room.npcs.push({ name: quest.giver });
    state.questProgress[quest.id] = { status: "completed" };
    const args = { ...state, cmd: "你好", visibleNpcs: state.room.npcs };
    const result = buildNpcContext({ ...args, importedNpcLore: [{ name: "故人", entry: "导入的人设" }] });
    expect(result.lastAiText).toBe("故人还在等你。");
    expect(result.npcLoreBlockWithQuest).toContain("旧时的朋友");
    expect(result.npcLoreBlockWithQuest).toContain("导入的人设");
    expect(result.npcLoreBlockWithQuest).toContain("玩家已经完成过");
    expect(result.reunionBlock).toContain("300回合");
    const beast = { snowLeopard: { unlocked: true, active: true, data: { name: "雪豹" } } };
    const animal = buildNpcContext({ ...args, companionState: beast });
    const human = buildNpcContext({ ...args, companionState: beast, companionForms: { snowLeopard: "human" }, nsfwOn: true });
    expect(human.npcLoreBlockWithQuest).not.toBe(animal.npcLoreBlockWithQuest);
    const empty = buildNpcContext({ ...args, convo: [], preset: {}, room: { npcs: [] }, visibleNpcs: [], cmd: "", varTree: {} });
    expect(empty).toEqual({ lastAiText: "", npcLoreBlockWithQuest: "", reunionBlock: "" });
    expect(() => buildNpcContext({})).toThrow();
  });

  it("builds active quest and persuasion instructions and handles empty progress", () => {
    const state = fixture();
    expect(buildQuestStageNote(state)).toBe("");
    const quest = QUCUO_QUESTS.find(q => q.stages?.length && !q.exclusiveGroup && !q.requires);
    const note = buildQuestStageNote({
      ...state, questProgress: { [quest.id]: { status: "active", currentStageIndex: 0 } },
      pendingQuestBranch: { mode: "talk", goal: "交出旧信", flag: "交信" },
    });
    expect(note).toContain("[说服判定]");
    expect(note).toContain("交出旧信");
    expect(note).toContain("[任务阶段]");
    expect(() => buildQuestStageNote({})).toThrow();
  });

  it("builds forced-event instructions only when supplied", () => {
    expect(buildForcedEventNote(null)).toBe("");
    expect(buildForcedEventNote("交信", "故人", 500)).toContain("交信（关键人物：故人）");
    expect(buildForcedEventNote("交信", null, 500)).not.toContain("关键人物");
  });

  it("builds arrival and departure transit notes only for movement", () => {
    const args = { isTalk: false, movingDir: "north", lockedDestName: "鱼定村" };
    expect(buildArrivalNote(args)).toContain(getDistrictAnchor("鱼定村"));
    expect(buildArrivalNote({ ...args, outerDepart: { fromDistrict: "旧城", fromInner: "小屋", fromAnchor: "门口" } })).toContain("旧城·小屋");
    expect(buildArrivalNote({ ...args, isTalk: true })).toBe("");
    expect(buildArrivalNote({})).toBe("");
  });
});

it("assembles byte-identical complete prompts through web and CLI wiring, including lore and reunions", async () => {
  const state = fixture();
  const cmd = "你好";
  const apiCfg = { ...defaultConfig(), extractionEnabled: false, streamEnabled: false };
  const explicit = { apiCfg, intent: classifyIntent(cmd), importedNpcLore: [{ name: "故人", entry: "导入旧事" }] };
  const web = createPromptContext(state, explicit);
  const cli = createCliPromptContext(state, explicit);
  const mainConvo = [...state.convo, { role: "user", content: cmd }];
  const assemble = prompt => assemblePrompt({ prompt }, cmd, {}, state.convo, mainConvo, "", mainConvo);
  expect(assemble(web)).toEqual(assemble(cli));
  expect(assemble(web).npcLoreBlockWithQuest).toContain("导入旧事");
  expect(assemble(web).reunionBlock).toContain("300回合");
  const capture = async prompt => {
    let request;
    const ai = createMockAi(["{}"], { onRequest: (messages, opts) => { request = { messages, systemPrompt: opts.systemPrompt }; } });
    await callMainOnce(null, false, {
      ...assemble(prompt), varTree: state.varTree, gm: false, isSettle: false, isTalk: false,
      intent: explicit.intent, apiCfg, narrator: initialNarratorState(), scenario: state.preset.scenario,
      charName: state.char.name, charBodyProfile: emptyBodyProfile(), convo: state.convo,
      nsfwOn: false, ai, addLog: () => {}, setLog: () => {},
    });
    return request;
  };
  expect(await capture(web)).toEqual(await capture(cli));
  const webSource = readFileSync(new URL("../../app/hooks/useTurn.js", import.meta.url), "utf8");
  expect(webSource).toContain("prompt: createPromptContext({");
});

it("injects lore and reunion notes in an actual CLI request", async () => {
  const requests = [];
  const session = createSession({
    out: () => {}, seed: 42,
    ai: createMockAi(['{"output":"故人颔首。"}'], { onRequest: (messages, opts) => requests.push({ messages, systemPrompt: opts.systemPrompt }) }),
  });
  await session.runLine(":new");
  const state = fixture();
  gameActions.setRoom(state.room);
  gameActions.setVarTreeState(state.varTree);
  gameActions.setTime(state.time);
  gameActions.setPreset(state.preset);
  await session.runLine("你好");
  const text = JSON.stringify(requests);
  expect(text).toContain("旧时的朋友");
  expect(text).toContain("300回合");
});

it("handles absent prompt wiring and rejects incomplete required state", () => {
  expect(assemblePrompt({}, "你好", {}, [], [], "", [])).toEqual({
    cmd: "你好", newConvo: [], mainConvo: [], hist: "",
  });
  expect(() => assemblePrompt({ prompt: createPromptContext({}) }, "", {}, [], [], "", [])).toThrow();
});
