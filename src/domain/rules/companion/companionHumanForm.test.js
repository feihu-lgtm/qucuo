import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../../../app/calls/registerAllPrompts.js";
import {
  COMPANION_PROFILES,
  HUMAN_PROFILE_REV,
  getCompanionProfile,
  resolveCompanionKeyByAlias,
} from "../../data/npc/companionProfiles.js";
import { getNpcCodexEntries } from "../../data/npc/npcCodex.js";
import {
  INTIMATE_DETAIL_FIELDS,
  formatCompanionBodyBlock,
} from "../character/companionBodyProfiles.js";
import {
  companionKeyByName,
  companionMeta,
  companionNpcEntry,
  followingCompanionKey,
  getCompanionFullProfile,
  migrateCompanionState,
  unlockImportedCompanion,
  unlockPearl,
  unlockSnowLeopard,
} from "./companion.js";
import { isHumanFormCompanion } from "./companionSlots.js";
import {
  buildFirstTransformPrompt,
  formatCompanionDossierBlock,
} from "./companionLore.js";
import { switchCompanionForm } from "../../../features/companion/logic.js";
import { inviteCompanion } from "../../../features/npc/inviteCompanion.js";
import { buildSysBase } from "../prompt/sysBase.js";
import { getCallControlMatrix } from "../prompt/promptCatalog.js";
import { resetPromptOverrides, setPromptOverride } from "../prompt/registry.js";
import { buildNpcContext } from "../../../engine/prompt/roundNotes.js";
import { validateEmergenceSeal } from "../npc/npcEmergence.js";
import { fixateNpcs } from "../../../engine/act/postCommit/npcFixation.js";
import { SNOW_INVITED, SNOW_TRUSTED } from "../quests/snowLeopardQuest.js";
import { initialNarratorState } from "../narrator/narrator.js";

function makeBaseState(overrides = {}) {
  return {
    char: { name: "少侠", money: 100, special: { 魅力: 5 } },
    companionState: {},
    flags: [],
    inv: [],
    questProgress: {},
    room: { name: "鱼定村", npcs: [] },
    innerRoomName: "村口",
    skills: [],
    time: 12,
    varTree: { 角色: {}, 世界: {} },
    ...overrides,
  };
}

describe("化形同伴全档案（雪豹→白栖雪 / 珍珠→夏明珠）", () => {
  beforeEach(() => {
    resetPromptOverrides();
  });

  afterEach(() => {
    resetPromptOverrides();
  });

  it("双角色具备三字人名、成年声明、完整武功、12 项体貌与细粒度 NSFW 字段", () => {
    expect(COMPANION_PROFILES.snowLeopard.humanName).toBe("白栖雪");
    expect(COMPANION_PROFILES.pearl.humanName).toBe("夏明珠");
    expect(HUMAN_PROFILE_REV).toBeGreaterThanOrEqual(1);

    for (const [key, profile] of Object.entries(COMPANION_PROFILES)) {
      expect([...profile.humanName]).toHaveLength(3);
      expect(profile.age).toBeGreaterThanOrEqual(18);
      expect(profile.gender).toBe("女");
      expect(profile.brief).toBeTruthy();
      expect(profile.personality).toBeTruthy();
      expect(profile.lifeHistory).toBeTruthy();
      expect(profile.fullBio).toContain(profile.humanName);
      expect(profile.likes).toBeTruthy();
      expect(profile.hobby).toBeTruthy();
      expect(profile.tradeStyle).toBeTruthy();
      expect(profile.firstJoinCue).toContain(profile.humanName);

      expect(profile.kungfu.school).toBeTruthy();
      expect(profile.kungfu.neigongName).toBeTruthy();
      expect(profile.kungfu.qinggongName).toBeTruthy();
      expect(profile.kungfu.weapon).toBeTruthy();
      expect(profile.kungfu.moves.length).toBeGreaterThanOrEqual(5);

      for (const detail of INTIMATE_DETAIL_FIELDS) {
        expect(profile.nsfwProfile[detail.key], `${key}.nsfwProfile.${detail.key}`).toBeTruthy();
      }
      expect(profile.nsfwProfile.sensitive).toBeTruthy();
      expect(profile.nsfwProfile.habit).toBeTruthy();
    }

    const codex = getNpcCodexEntries();
    expect(codex.find((e) => e.name === "雪豹")?.humanName).toBe("白栖雪");
    expect(codex.find((e) => e.name === "珍珠")?.humanName).toBe("夏明珠");
  });

  it("formatCompanionBodyBlock 与 formatCompanionDossierBlock 严格执行 ■ 模式门控", () => {
    for (const key of ["snowLeopard", "pearl"]) {
      const sfwBody = formatCompanionBodyBlock(key, { nsfw: false });
      expect(sfwBody).toContain("身量");
      expect(sfwBody).not.toContain("私密·胸");
      expect(sfwBody).not.toContain("私密·乳");
      expect(sfwBody).not.toContain("私密·屁股");
      expect(sfwBody).not.toContain("私密·小穴");

      const nsfwBody = formatCompanionBodyBlock(key, { nsfw: true });
      expect(nsfwBody).toContain("私密·胸");
      expect(nsfwBody).toContain("私密·乳");
      expect(nsfwBody).toContain("私密·屁股");
      expect(nsfwBody).toContain("私密·小穴");
      expect(nsfwBody).toContain("私密·腰腿玉足");

      const beastDossier = formatCompanionDossierBlock(key, { form: "beast", nsfw: true });
      expect(beastDossier).not.toContain("私密·小穴");
      expect(beastDossier).not.toContain("化形体貌明细");
    }
  });

  it("初次入队化形写入旗标、三字人名、varTree 形态与好感钉账，并保持单槽互斥与幂等", () => {
    const leopardNpc = { name: "雪豹", beast: true, companionCandidate: true, affectionable: true };
    const snowState = makeBaseState({
      flags: [SNOW_TRUSTED],
      room: { name: "鱼定村", npcs: [leopardNpc] },
    });
    const resSnow = inviteCompanion(snowState, leopardNpc, { getNow: () => 500 });
    expect(resSnow.changes.companionState.snowLeopard).toMatchObject({
      unlocked: true,
      active: true,
      form: "human",
      transformed: true,
      humanName: "白栖雪",
      beastName: "雪豹",
      transformedAt: 500,
      voice: "human",
      cannotSpeak: false,
      affectionable: true,
    });
    expect(resSnow.changes.companionState.snowLeopard.data.kungfu.school).toBe("雪隐三绝·栖雪剑掌");
    expect(resSnow.changes.flags([])).toEqual(expect.arrayContaining([SNOW_INVITED, "snow_leopard_humanized"]));

    const vtSnow = resSnow.changes.varTree({ 世界: {}, 角色: {} });
    expect(vtSnow.角色.雪豹).toMatchObject({
      化形人名: "白栖雪",
      形态: "人形",
      已化形: true,
      好感度: 45,
    });
    expect(resSnow.settleOptions).toMatchObject({
      settleNpc: "雪豹",
      settleKind: "companion_invite",
      companionKey: "snowLeopard",
      firstTransform: true,
      humanName: "白栖雪",
      beastName: "雪豹",
    });

    const pearlNpc = { name: "珍珠", beast: true, companionCandidate: true, affectionable: true };
    const withPearl = inviteCompanion({
      ...snowState,
      companionState: resSnow.changes.companionState,
      room: { name: "鱼定村", npcs: [pearlNpc] },
    }, pearlNpc, { getNow: () => 600 });
    expect(withPearl.changes.companionState.pearl).toMatchObject({
      unlocked: true,
      active: true,
      form: "human",
      humanName: "夏明珠",
      transformedAt: 600,
    });
    expect(withPearl.changes.companionState.snowLeopard.active).toBe(false);
    expect(withPearl.changes.flags([])).toContain("pearl_humanized");
    expect(withPearl.changes.varTree({ 世界: {}, 角色: {} }).角色.珍珠).toMatchObject({
      化形人名: "夏明珠",
      形态: "人形",
      已化形: true,
      好感度: 45,
    });

    // 解锁雪豹也同步压下先前出战的导入伙伴（单槽互斥修复）
    const importedFirst = unlockImportedCompanion({}, { name: "元朵朵", levelCap: 1 });
    const thenSnow = unlockSnowLeopard(importedFirst, { now: 700 });
    expect(thenSnow.imported_元朵朵.active).toBe(false);
    expect(thenSnow.snowLeopard.active).toBe(true);
    expect(unlockPearl(thenSnow, { now: 800 }).snowLeopard.active).toBe(false);
  });

  it("三字人名与别名解析完整打通，且防传闻冒名与防幽灵滤除", () => {
    expect(resolveCompanionKeyByAlias("白栖雪")).toBe("snowLeopard");
    expect(resolveCompanionKeyByAlias("夏明珠")).toBe("pearl");
    expect(resolveCompanionKeyByAlias("小珍珠")).toBe("pearl");
    expect(resolveCompanionKeyByAlias("哈瓦夏日")).toBe("pearl");
    expect(getCompanionProfile("夏明珠")?.beastName).toBe("珍珠");

    expect(companionKeyByName("白栖雪")).toBe("snowLeopard");
    expect(companionKeyByName("夏明珠")).toBe("pearl");
    expect(isHumanFormCompanion("白栖雪")).toBe(true);
    expect(isHumanFormCompanion("夏明珠")).toBe(true);

    const cs = unlockPearl(unlockSnowLeopard({}, { now: 1 }), { now: 2 });
    expect(followingCompanionKey(cs, "白栖雪")).toBe("snowLeopard");
    expect(followingCompanionKey(cs, "夏明珠")).toBe("pearl");
    expect(companionMeta(cs, "snowLeopard")).toMatchObject({
      label: "雪豹",
      humanName: "白栖雪",
      displayName: "白栖雪",
      form: "human",
    });
    expect(companionNpcEntry(cs, "pearl")).toMatchObject({
      name: "珍珠",
      humanName: "夏明珠",
      displayName: "夏明珠",
      form: "human",
    });
    expect(companionNpcEntry(cs, "pearl").cannotSpeak).toBeUndefined();

    const sealCheck = validateEmergenceSeal(
      {
        mentionedNewNpcs: ["白栖雪", "夏明珠", "阿青"],
        emergedNpc: { name: "白栖雪", description: "神秘女子" },
      },
      { screenText: "白栖雪与夏明珠和阿青都在场", varTree: { 世界: {} }, roomNpcs: [] },
    );
    expect(sealCheck.mentionedNewNpcs).toEqual(["阿青"]);
    expect(sealCheck.emergedNpc).toBeNull();

    const p = {
      room: {
        name: "天都镇",
        npcs: [{ name: "白栖雪" }, { name: "夏明珠" }, { name: "天都路人" }],
      },
    };
    fixateNpcs({
      p,
      room: { name: "天都镇", npcs: [] },
      innerRoomName: "街口",
      narrativeText: "街口人来人往",
      varTree: { 世界: {} },
      time: 5,
      systemAcceptedNames: new Set(),
      luck: 5,
      npcState: {},
    });
    expect(p.room.npcs.map((n) => n.name)).toEqual(["天都路人"]);
  });

  it("buildNpcContext 并发注入全部随行化形同伴档案，并接通天工台总控台文本与开关覆盖", () => {
    const cs = unlockPearl(unlockSnowLeopard({}, { now: 1 }), { now: 2 });
    const ctx = buildNpcContext({
      convo: [],
      preset: { npcLore: [] },
      visibleNpcs: [],
      room: { name: "鱼定村", npcs: [] },
      cmd: "看看身边同伴",
      isTalk: false,
      questProgress: {},
      varTree: { 角色: {}, 世界: {} },
      time: 12,
      companionState: cs,
      nsfwOn: true,
    });
    expect(ctx.npcLoreBlockWithQuest).toContain("白栖雪");
    expect(ctx.npcLoreBlockWithQuest).toContain("夏明珠");
    expect(ctx.npcLoreBlockWithQuest).toContain("雪隐三绝·栖雪剑掌");
    expect(ctx.npcLoreBlockWithQuest).toContain("白驹踏云劲·游缰腿法");
    expect(ctx.npcLoreBlockWithQuest).toContain("私密·小穴");

    // 统一总控台（天工台调度）矩阵含两个新块，可读取原文、覆盖文案与切换关闭
    const combatMatrix = getCallControlMatrix("main:combat", { mode: "dual" });
    const dossierBlock = combatMatrix.items.find((i) => i.id === "companion_dossier");
    const transformBlock = combatMatrix.items.find((i) => i.id === "companion_transform");
    expect(dossierBlock).toMatchObject({ canEditText: true, canToggleOff: true, slot: "inChat" });
    expect(transformBlock).toMatchObject({ canEditText: true, canToggleOff: true, slot: "inChat" });
    expect(dossierBlock.effectiveText).toContain("@humanName");
    expect(transformBlock.effectiveText).toContain("@transformCue");

    setPromptOverride("companion_transform", { text: "【自定义初化】@beastName→@humanName：@kungfuSummary" });
    const { phiRules } = buildSysBase(
      220,
      initialNarratorState(),
      "总纲",
      null,
      false,
      "",
      true,
      "settle",
      { settleNpc: "珍珠", settleKind: "companion_invite", firstTransform: true, companionKey: "pearl" },
    );
    expect(phiRules).toContain("【自定义初化】珍珠→夏明珠：白驹踏云劲·游缰腿法");

    setPromptOverride("companion_transform", { mode: "off" });
    expect(buildFirstTransformPrompt("雪豹")).toBe("");

    setPromptOverride("companion_dossier", { mode: "off" });
    const offCtx = buildNpcContext({
      convo: [],
      preset: { npcLore: [] },
      visibleNpcs: [],
      room: { name: "鱼定村", npcs: [] },
      cmd: "",
      isTalk: false,
      questProgress: {},
      varTree: { 角色: {}, 世界: {} },
      time: 12,
      companionState: cs,
      nsfwOn: true,
    });
    expect(offCtx.npcLoreBlockWithQuest).not.toContain("白栖雪");
    expect(offCtx.npcLoreBlockWithQuest).not.toContain("夏明珠");
  });

  it("旧档迁移幂等且不篡改旧战力数值，morph 形态切换与完整档案查询契约稳定", () => {
    const legacy = {
      snowLeopard: {
        unlocked: true,
        active: true,
        data: {
          name: "雪豹",
          id: "companion_snow_leopard",
          levelCap: 2,
          special: { 体魄: 7, 身法: 8, 悟性: 2 },
          combatStats: { hp: [120, 120], energy: [10, 10] },
          moveset: [{ name: "碎岩击" }],
        },
      },
    };
    const migrated = migrateCompanionState(legacy);
    expect(migrated).not.toBe(legacy);
    expect(migrated.snowLeopard).toMatchObject({
      form: "human",
      transformed: true,
      humanName: "白栖雪",
      affectionable: true,
      cannotSpeak: false,
    });
    expect(migrated.snowLeopard.data.special).toEqual(legacy.snowLeopard.data.special);
    expect(migrated.snowLeopard.data.moveset).toEqual(legacy.snowLeopard.data.moveset);
    expect(migrateCompanionState(migrated)).toBe(migrated);

    const switchedToBeast = switchCompanionForm({ companionState: migrated }, "白栖雪", "beast");
    const csBeast = switchedToBeast.changes.companionState(migrated);
    expect(csBeast.snowLeopard.form).toBe("beast");
    expect(csBeast.snowLeopard.cannotSpeak).toBe(true);
    expect(switchedToBeast.changes.varTree({}).角色.雪豹.形态).toBe("兽形");

    const full = getCompanionFullProfile(csBeast, "白栖雪");
    expect(full).toMatchObject({
      key: "snowLeopard",
      humanName: "白栖雪",
      beastName: "雪豹",
      form: "beast",
      transformed: true,
    });
    expect(full.nsfwProfile.vulva).toBeTruthy();
  });
});
