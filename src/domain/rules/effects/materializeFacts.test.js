// WO-11 十二律落盘引擎契约测试：十二律覆盖矩阵 + 纯函数性 + 保守不丢事实。
import { describe, expect, it } from "vitest";
import { materializeFacts } from "./materializeFacts.js";
import { parseActiveBuffs } from "../../../utils/buffSystem.js";
import { hpFromNeigong } from "../npc/npcGeneration.js";

function baseState() {
  return {
    time: 42,
    inv: [
      { id: "it_sword1", name: "青钢剑", category: "weapon", quality: "白", atk: 7, equipped: false },
      { id: "it_pill1", name: "活血丹", category: "misc", quality: "白" },
    ],
    room: {
      name: "鱼定村",
      items: [{ id: "it_stool", name: "凳子" }],
      npcs: [
        { name: "才旦", carriedItems: [{ id: "it_whistle", name: "骨哨", category: "accessory", quality: "绿" }] },
        { name: "管家", carriedItems: [] },
      ],
    },
    char: { name: "少侠", hp: [30, 40], money: 50, neigong: 10, waigong: 8, special: { 体魄: 5, 气运: 5 }, moveset: [] },
    skills: [
      { id: "kf_old", name: "基础剑法", type: "外功", moveType: "attack", quality: "白", stage: "入门", active: true },
    ],
    exp: 100, pot: 20,
    dao: { karma: 3, jie: 1 },
    flags: [],
    varTree: { 角色: {}, 世界: {} },
    claimedMilestones: new Set(),
    companionState: {},
  };
}

describe("materializeFacts 十二律覆盖矩阵", () => {
  it("GRANT_ITEM：编译产物入 inv 并出回执；同 id 幂等", () => {
    const state = baseState();
    const compiled = { F1: { id: "it_newbow", name: "裂风豹骨哨", category: "accessory", quality: "蓝", provenance: { turn: 42 }, history: [] } };
    const out = materializeFacts(state, [
      { id: "F1", op: "GRANT_ITEM", itemName: "裂风豹骨哨" },
      { id: "F1", op: "GRANT_ITEM", itemName: "裂风豹骨哨" }, // 重复事实幂等
    ], compiled);
    expect(out.changes.inv.filter((e) => e.id === "it_newbow")).toHaveLength(1);
    expect(out.receipts).toHaveLength(1);
    expect(out.receipts[0]).toMatchObject({ kind: "grant_item", factId: "F1" });
    expect(state.inv).toHaveLength(2); // 纯函数：入参不被改写
  });

  it("GRANT_ITEM：编译缺失时按事实字段兜底，不丢事实", () => {
    const out = materializeFacts(baseState(), [{ id: "F9", op: "GRANT_ITEM", itemName: "无名残页" }], {});
    expect(out.changes.inv.some((e) => e.name === "无名残页")).toBe(true);
  });

  // WO-24F：编译缺失兜底物并入 statsForQuality 系统表数值
  it("GRANT_ITEM 兜底 weapon 有 atk>0、armor 有 def>0", () => {
    const sword = materializeFacts(baseState(), [{ id: "Fw", op: "GRANT_ITEM", itemName: "无名铁剑", category: "weapon", quality: "白" }], {});
    const blade = sword.changes.inv.find((e) => e.name === "无名铁剑");
    expect(blade.atk).toBeGreaterThan(0);
    const armor = materializeFacts(baseState(), [{ id: "Fa", op: "GRANT_ITEM", itemName: "无名皮甲", category: "armor", quality: "白" }], {});
    expect(armor.changes.inv.find((e) => e.name === "无名皮甲").def).toBeGreaterThan(0);
  });

  it("GRANT_ITEM 兜底 misc 不强行加攻防", () => {
    const out = materializeFacts(baseState(), [{ id: "Fm", op: "GRANT_ITEM", itemName: "无名残页", category: "misc", quality: "白" }], {});
    const page = out.changes.inv.find((e) => e.name === "无名残页");
    expect(page.atk).toBeUndefined();
    expect(page.def).toBeUndefined();
  });

  it("GRANT_ITEM 兜底品质变数值变", () => {
    const white = materializeFacts(baseState(), [{ id: "F1", op: "GRANT_ITEM", itemName: "剑", category: "weapon", quality: "白" }], {});
    const blue = materializeFacts(baseState(), [{ id: "F2", op: "GRANT_ITEM", itemName: "剑", category: "weapon", quality: "蓝" }], {});
    const atkW = white.changes.inv.find((e) => e.name === "剑").atk;
    const atkB = blue.changes.inv.find((e) => e.name === "剑").atk;
    expect(atkB).toBeGreaterThan(atkW);
  });

  it("GRANT_ITEM 外部传入 atk/def 不能覆盖系统表", () => {
    const out = materializeFacts(baseState(), [{ id: "Fx", op: "GRANT_ITEM", itemName: "铁剑", category: "weapon", quality: "白", atk: 999, def: 999 }], {});
    const blade = out.changes.inv.find((e) => e.name === "铁剑");
    expect(blade.atk).not.toBe(999);
    expect(blade.def).not.toBe(999);
    expect(blade.atk).toBeGreaterThan(0);
  });

  it("TRANSFER_ITEM：NPC → 玩家，源头条目置 dropped:true 留档", () => {
    const out = materializeFacts(baseState(), [
      { id: "F2", op: "TRANSFER_ITEM", itemId: "it_whistle", from: "才旦", to: "player" },
    ], {});
    expect(out.changes.inv.some((e) => e.id === "it_whistle")).toBe(true);
    const caidan = out.changes.room.npcs.find((n) => n.name === "才旦");
    expect(caidan.carriedItems[0]).toMatchObject({ id: "it_whistle", dropped: true });
    expect(out.changes.inv.find((e) => e.id === "it_whistle").dropped).toBeUndefined();
  });

  it("TRANSFER_ITEM：玩家 → 落地 / 玩家 → NPC，双向原子增删", () => {
    const state = baseState();
    const drop = materializeFacts(state, [
      { id: "F3", op: "TRANSFER_ITEM", itemId: "it_pill1", from: "player", to: "ground" },
    ], {});
    expect(drop.changes.inv.some((e) => e.id === "it_pill1")).toBe(false);
    expect(drop.changes.room.items.some((e) => e.id === "it_pill1")).toBe(true);

    const give = materializeFacts(state, [
      { id: "F4", op: "TRANSFER_ITEM", itemId: "it_sword1", from: "player", to: "管家" },
    ], {});
    expect(give.changes.inv.some((e) => e.id === "it_sword1")).toBe(false);
    expect(give.changes.room.npcs.find((n) => n.name === "管家").carriedItems.some((e) => e.id === "it_sword1")).toBe(true);
  });

  it("TRANSFER_ITEM：目标 NPC 不在场时落地上，不丢事实", () => {
    const out = materializeFacts(baseState(), [
      { id: "F5", op: "TRANSFER_ITEM", itemId: "it_pill1", from: "player", to: "远行的人" },
    ], {});
    expect(out.changes.room.items.some((e) => e.id === "it_pill1")).toBe(true);
  });

  it("REFORGE_ITEM：升一品阶、重算攻防、追加词条与器史", () => {
    const out = materializeFacts(baseState(), [
      { id: "F6", op: "REFORGE_ITEM", itemId: "it_sword1", affix: "sixDim:身法+1", note: "才旦淬火" },
    ], {});
    const sword = out.changes.inv.find((e) => e.id === "it_sword1");
    expect(sword.quality).toBe("绿");
    expect(sword.atk).toBeGreaterThan(7);
    expect(sword.affixes).toContain("sixDim:身法+1");
    expect(sword.history).toHaveLength(1);
    expect(sword.history[0].text).toContain("才旦淬火");
    expect(out.receipts[0]).toMatchObject({ kind: "reforge_item" });
  });

  it("BESTOW_SKILL：入 skills；新武学 active 上岗时同路数旧招退槽", () => {
    const compiled = { F7: { id: "kf_emg_追风剑", name: "追风剑", type: "外功", moveType: "attack", quality: "蓝", stage: "入门", active: true } };
    const out = materializeFacts(baseState(), [{ id: "F7", op: "BESTOW_SKILL", skillName: "追风剑" }], compiled);
    expect(out.changes.skills.some((s) => s.name === "追风剑")).toBe(true);
    expect(out.changes.skills.find((s) => s.id === "kf_old").active).toBe(false);
    expect(out.receipts[0]).toMatchObject({ kind: "bestow_skill" });
  });

  it("BESTOW_SKILL：已习得幂等跳过", () => {
    const compiled = { F8: { id: "kf_old", name: "基础剑法", type: "外功", stage: "入门" } };
    const out = materializeFacts(baseState(), [{ id: "F8", op: "BESTOW_SKILL", skillName: "基础剑法" }], compiled);
    expect(out.changes.skills).toBeUndefined(); // 无变化不出 changes
  });

  it("PROGRESS_CULTIVATION：neigong 增加同步重算气血上限；stage 推进", () => {
    const state = baseState();
    const out = materializeFacts(state, [
      { id: "F10", op: "PROGRESS_CULTIVATION", neigongDelta: 5, expDelta: 30, potDelta: -4, skillId: "kf_old" },
    ], {});
    const newMax = hpFromNeigong(15, 5);
    expect(out.changes.char.neigong).toBe(15);
    expect(out.changes.char.hp[1]).toBe(newMax);
    expect(out.changes.char.hp[0]).toBeLessThanOrEqual(newMax);
    expect(out.changes.exp).toBe(130);
    expect(out.changes.pot).toBe(16);
    expect(out.changes.skills.find((s) => s.id === "kf_old").stage).toBe("小成");
  });

  it("SHIFT_SPECIAL_STAT：±1 并登记里程碑；重复 milestoneKey 跳过", () => {
    const state = baseState();
    const out = materializeFacts(state, [
      { id: "F11", op: "SHIFT_SPECIAL_STAT", attr: "体魄", delta: 1, milestoneKey: "ms_tipo_1" },
    ], {});
    expect(out.changes.char.special.体魄).toBe(6);
    expect(out.changes.claimedMilestones).toContain("ms_tipo_1");

    const again = materializeFacts({ ...state, claimedMilestones: new Set(["ms_tipo_1"]) }, [
      { id: "F11b", op: "SHIFT_SPECIAL_STAT", attr: "体魄", delta: 1, milestoneKey: "ms_tipo_1" },
    ], {});
    expect(again.changes.char).toBeUndefined();
  });

  it("CHANGE_VITALS_SILVER：hp 钳 [0,effectiveMaxHp]、money 下限 0、karma/jie 直加", () => {
    const state = baseState();
    const out = materializeFacts(state, [
      { id: "F12", op: "CHANGE_VITALS_SILVER", hpDelta: 999, moneyDelta: -999, karmaDelta: 2, jieDelta: -1 },
    ], {});
    expect(out.changes.char.hp[0]).toBeLessThanOrEqual(out.changes.char.hp[1]);
    expect(out.changes.char.hp[0]).toBeGreaterThanOrEqual(0);
    expect(out.changes.char.money).toBe(0);
    expect(out.changes.dao).toMatchObject({ karma: 5, jie: 0 });
  });

  it("APPLY_CONDITION：正向走 makeBuffFlag 格式；负向伤病写负号 flag 且可被 parseActiveBuffs 解析", () => {
    const out = materializeFacts(baseState(), [
      { id: "F13", op: "APPLY_CONDITION", attr: "体魄", val: 2, durationTurns: 30 },
      { id: "F14", op: "APPLY_CONDITION", attr: "身法", val: -1, durationTurns: 10, negative: true },
    ], {});
    expect(out.changes.flags).toContain("buff_体魄+2_untilturn_72");
    expect(out.changes.flags).toContain("buff_身法-1_untilturn_52");
    const parsed = parseActiveBuffs(out.changes.flags, 42);
    expect(parsed.体魄).toBe(2);
    expect(parsed.身法).toBe(-1);
  });

  it("MUTATE_SOCIAL 走系统好感账本：魅力修正/日涨上限/无轨道跳过/负向 clamp", () => {
    const base = baseState();
    base.varTree = { 角色: { 才旦: { 好感度: 10 }, 哑仆: { 好感度: 30 } }, 世界: {} };
    base.char = { ...base.char, special: { 魅力: 10 } };
    base.room = { ...base.room, npcs: [{ name: "才旦" }, { name: "哑仆", intimacy: { forbidden: true } }] };
    // 魅力 10 → 正向增量 +30% 修正（6→8 区间取整），且写好感日增账
    const out = materializeFacts(base, [
      { id: "F30", op: "MUTATE_SOCIAL", npc: "才旦", affectionDelta: 6, ledgerKind: "恩" },
      { id: "F31", op: "MUTATE_SOCIAL", npc: "哑仆", affectionDelta: 5, ledgerKind: "恩" },
      { id: "F32", op: "MUTATE_SOCIAL", npc: "才旦", affectionDelta: -4, ledgerKind: "怨" },
    ], {});
    const types = out.patches.map((p) => `${p.op}:${p.path.join(".")}`);
    expect(types).toContain("set:varTree.角色.才旦.好感度");
    expect(types).toContain("set:varTree.世界.好感日增");
    // 无好感轨道：整条事实跳过（含心账）
    expect(out.patches.some((p) => p.factId === "F31")).toBe(false);
    expect(out.logs.some((l) => l.text.includes("无好感轨道"))).toBe(true);
    // 负向：clamp 不写日增账
    const negPatch = out.patches.find((p) => p.factId === "F32" && p.path.join(".") === "varTree.角色.才旦.好感度");
    expect(negPatch).toBeTruthy();
  });

  it("MUTATE_SOCIAL 群聊串行叠加：同批多条事实不互相覆盖、日增账按 NPC 分别入账", () => {
    const base = baseState();
    base.varTree = { 角色: { 才旦: { 好感度: 10 }, 卓玛: { 好感度: 20 } }, 世界: {} };
    base.char = { ...base.char, special: { 魅力: 5 } };
    base.room = { ...base.room, npcs: [{ name: "才旦" }, { name: "卓玛" }] };
    const out = materializeFacts(base, [
      { id: "G1", op: "MUTATE_SOCIAL", npc: "才旦", affectionDelta: 2 },
      { id: "G2", op: "MUTATE_SOCIAL", npc: "才旦", affectionDelta: 3 },
      { id: "G3", op: "MUTATE_SOCIAL", npc: "卓玛", affectionDelta: 4 },
    ], {});
    // 同一 NPC 两条事实串行：最终 patch 必须是 10+2+3=15（若从同一快照起算会写成 13 覆盖 12）
    const lastCain = out.patches.filter((p) => p.path.join(".") === "varTree.角色.才旦.好感度").at(-1);
    expect(lastCain.value).toBe(15);
    // 日增账：两个 NPC 的额度都保留（后一条不冲掉前一条的 gained）
    const lastGained = out.patches.filter((p) => p.path.join(".") === "varTree.世界.好感日增").at(-1);
    expect(lastGained.value.gained).toMatchObject({ 才旦: 5, 卓玛: 4 });
  });

  it("MUTATE_SOCIAL charm 口径：effectiveSpecialNow 优先于裸 char.special", () => {
    const base = baseState();
    base.varTree = { 角色: { 才旦: { 好感度: 50 } }, 世界: {} };
    base.char = { ...base.char, special: { 魅力: 5 } };
    base.effectiveSpecialNow = { 魅力: 10 };
    base.room = { ...base.room, npcs: [{ name: "才旦" }] };
    const out = materializeFacts(base, [
      { id: "C1", op: "MUTATE_SOCIAL", npc: "才旦", affectionDelta: 10 },
    ], {});
    const patch = out.patches.find((p) => p.path.join(".") === "varTree.角色.才旦.好感度");
    // 魅力 10 修正后增量 >10（裸 char.special 5 则是整 10→60），证明 effective 口径生效
    expect(patch.value).toBeGreaterThan(60);
  });

  it("MUTATE_SOCIAL 首识基线：无好感数值的 NPC 按初始好感 10 打底再结算增量", () => {
    const base = baseState();
    base.varTree = { 角色: {}, 世界: {} };
    base.char = { ...base.char, special: { 魅力: 5 } };
    base.room = { ...base.room, npcs: [{ name: "陌生客" }] };
    const out = materializeFacts(base, [
      { id: "H1", op: "MUTATE_SOCIAL", npc: "陌生客", affectionDelta: 2 },
    ], {});
    const patch = out.patches.find((p) => p.path.join(".") === "varTree.角色.陌生客.好感度");
    // 10 基线 + 2 增量 = 12，而不是裸写的 2（否则顶掉 INITIAL_FAVORABILITY 种子）
    expect(patch.value).toBe(12);
  });

  it("MUTATE_SOCIAL perfunctory=0 不产事实（judgeTurn 层）", async () => {
    const { judgeTurn } = await import("../judge/judgeTurn.js");
    const verdict = judgeTurn(
      { turn: 5, day: 1, place: "鱼定村", npcs: [{ name: "才旦" }], varTree: { 角色: {} }, inv: [], talkOnly: true },
      { read: "", refIds: [], actions: [
        { kind: "talk", target: "才旦", itemId: "", direction: "none", stance: "perfunctory" },
        { kind: "talk", target: "才旦", itemId: "", direction: "none", stance: "clever" },
      ], proposals: [] },
      { rng: () => 0.5 },
    );
    // perfunctory 不产事实，clever+1 产一条
    expect(verdict.facts).toHaveLength(1);
    expect(verdict.facts[0]).toMatchObject({ op: "MUTATE_SOCIAL", npc: "才旦", affectionDelta: 1 });
  });

  it("judgeTurn talkOnly 白名单：give/inspect_container 整条拦截不搬物品", async () => {
    const { judgeTurn } = await import("../judge/judgeTurn.js");
    const verdict = judgeTurn(
      { turn: 5, day: 1, place: "鱼定村", npcs: [{ name: "才旦" }], varTree: { 角色: {} }, inv: [{ id: "it_1", name: "酒" }], talkOnly: true },
      { read: "", refIds: [], actions: [
        { kind: "give", target: "才旦", itemId: "it_1", direction: "none", stance: "sincere" },
        { kind: "inspect_container", target: "箱子", itemId: "", direction: "none", stance: "casual" },
      ], proposals: [{ claim: "桌上有剑谱", kind: "find_item", fit: "natural" }] },
      { rng: () => 0.0 },
    );
    expect(verdict.facts.filter((f) => f.op === "TRANSFER_ITEM" || f.op === "GRANT_ITEM")).toHaveLength(0);
    expect(verdict.notes.some((n) => n.includes("纯搭话回合不结算"))).toBe(true);
  });

  it("judgeTurn talk stance 映射覆盖全 enum：sincere+2/clever+1/casual+1/forceful-1/未知 0", async () => {
    const { judgeTurn } = await import("../judge/judgeTurn.js");
    for (const [stance, delta] of [["sincere", 2], ["clever", 1], ["casual", 1], ["forceful", -1], ["胡说八道", 0]]) {
      const verdict = judgeTurn(
        { turn: 5, day: 1, place: "村", npcs: [{ name: "才旦" }], varTree: { 角色: {} }, inv: [] },
        { read: "", refIds: [], actions: [{ kind: "talk", target: "才旦", itemId: "", direction: "none", stance }], proposals: [] },
        { rng: () => 0.5 },
      );
      const social = verdict.facts.filter((f) => f.op === "MUTATE_SOCIAL");
      if (delta === 0) expect(social).toHaveLength(0);
      else expect(social[0]?.affectionDelta).toBe(delta);
    }
  });

  it("judgeTurn take 不产 GRANT_ITEM：地上拾取全在 feature collectGranted 确定性通道，判官不重复入包", async () => {
    const { judgeTurn } = await import("../judge/judgeTurn.js");
    const verdict = judgeTurn(
      { turn: 5, day: 1, place: "村", npcs: [], varTree: { 角色: {} }, inv: [] },
      { read: "", refIds: [], actions: [{ kind: "take", target: "地上的剑", itemId: "", direction: "none", stance: "casual" }], proposals: [] },
      { rng: () => 0.0 },
    );
    expect(verdict.facts.filter((f) => f.op === "GRANT_ITEM")).toHaveLength(0);
  });

  it("APPLY_CONDITION：combatBuff 合并进 pendingCombatBuff", () => {
    const out = materializeFacts(baseState(), [
      { id: "F15", op: "APPLY_CONDITION", combatBuff: { waigong: 2, moveMul: 0.1 } },
    ], {});
    expect(out.changes.char.pendingCombatBuff).toMatchObject({ waigong: 2, moveMul: 0.1 });
  });

  it("MUTATE_SOCIAL / BIND_OR_SETTLE_PACT / MUTATE_COMPANION / ALTER_WORLD_SCENE 全部转 applyPatches 指令", () => {
    const out = materializeFacts(baseState(), [
      { id: "F16", op: "MUTATE_SOCIAL", npc: "才旦", affectionDelta: 6, ledgerKind: "恩", reason: "雪夜赠酒" },
      { id: "F17", op: "BIND_OR_SETTLE_PACT", npc: "才旦", promise: "三日取回猎叉", deadlineHours: 72 },
      { id: "F18", op: "MUTATE_COMPANION", companionId: "雪豹", updates: { loyalty: 5 } },
      { id: "F19", op: "ALTER_WORLD_SCENE", sceneKey: "鱼定村", key: "mood", value: "戒备" },
    ], {});
    expect(out.changes.varTree).toBeUndefined(); // 不直写，全走 patches
    const types = out.patches.map((p) => `${p.op}:${p.path.join(".")}`);
    expect(types).toContain("set:varTree.角色.才旦.好感度"); // WO-16A：系统账本语义，非裸 add
    expect(types).toContain("merge:varTree.角色.才旦.心账");
    expect(types).toContain("merge:varTree.世界.契约.才旦.F17");
    expect(types).toContain("merge:companionState.雪豹.loyalty");
    expect(types).toContain("merge:varTree.世界.场景.鱼定村.mood");
    // 每条 patch 带 factId 供回溯
    expect(out.patches.every((p) => p.factId)).toBe(true);
  });

  it("BIND_OR_SETTLE_PACT 了结：settled 标记落档不删原文", () => {
    const out = materializeFacts(baseState(), [
      { id: "F20", op: "BIND_OR_SETTLE_PACT", npc: "才旦", settle: true, note: "猎叉已还" },
    ], {});
    expect(out.patches[0].path.join(".")).toBe("varTree.世界.契约.才旦.F20.settled");
  });

  it("纯函数性：同一输入两次输出一致，入参零突变", () => {
    const state = baseState();
    const facts = [
      { id: "F1", op: "GRANT_ITEM", itemName: "x" },
      { id: "F2", op: "TRANSFER_ITEM", itemId: "it_whistle", to: "player" },
    ];
    const frozen = JSON.parse(JSON.stringify({ ...state, claimedMilestones: [] }));
    const a = materializeFacts(state, facts, {});
    const b = materializeFacts(state, facts, {});
    expect(JSON.stringify(a.changes)).toBe(JSON.stringify(b.changes));
    const after = JSON.parse(JSON.stringify({ ...state, claimedMilestones: [] }));
    expect(after).toEqual(frozen);
  });

  it("claimedMilestones 输出保持 Set（序列化是 infra 职责）", () => {
    const out = materializeFacts(baseState(), [
      { id: "F30", op: "SHIFT_SPECIAL_STAT", attr: "体魄", delta: 1, milestoneKey: "ms_x" },
    ], {});
    expect(out.changes.claimedMilestones instanceof Set).toBe(true);
    expect(out.changes.claimedMilestones.has("ms_x")).toBe(true);
  });

  it("GRANT_ITEM 兜底 id 走 mintItemId 确定性 hex（it_ 前缀），同输入幂等", () => {
    const a = materializeFacts(baseState(), [{ id: "F31", op: "GRANT_ITEM", itemName: "无名残页" }], {});
    const b = materializeFacts(baseState(), [{ id: "F31", op: "GRANT_ITEM", itemName: "无名残页" }], {});
    const ida = a.changes.inv.find((e) => e.name === "无名残页").id;
    const idb = b.changes.inv.find((e) => e.name === "无名残页").id;
    expect(ida).toMatch(/^it_[0-9a-f]+$/);
    expect(ida).toBe(idb);
    expect(ida).not.toContain("fallback");
  });

  it("TRANSFER_ITEM 不错配留档条目：前一人 dropped 的同名物不影响后一人真还", () => {
    const state = baseState();
    // 才旦身上的骨哨已被置 dropped（上次已给过玩家）；管家持有一件真品归还
    state.room.npcs[0].carriedItems[0] = { id: "it_whistle", name: "骨哨", dropped: true };
    state.inv = state.inv.filter((e) => e.id !== "it_whistle");
    state.room.npcs[1].carriedItems.push({ id: "it_whistle2", name: "骨哨" });
    const out = materializeFacts(state, [
      { id: "F32", op: "TRANSFER_ITEM", itemId: "it_whistle2", itemName: "骨哨", from: "管家", to: "player" },
    ], {});
    // 管家真品进袋并被摘除；才旦的留档原样不动
    expect(out.changes.inv.some((e) => e.id === "it_whistle2")).toBe(true);
    expect(out.changes.room.npcs[1].carriedItems.some((e) => e.id === "it_whistle2" && !e.dropped)).toBe(false);
    expect(out.changes.room.npcs[0].carriedItems[0]).toMatchObject({ id: "it_whistle", dropped: true });
  });

  it("MUTATE_COMPANION / ALTER_WORLD_SCENE 对象值浅并：未提及的嵌套字段不丢", () => {
    const out = materializeFacts(baseState(), [
      { id: "F33", op: "MUTATE_COMPANION", companionId: "雪豹", updates: { stats: { loyalty: 5 } } },
      { id: "F34", op: "ALTER_WORLD_SCENE", sceneKey: "鱼定村", updates: { guard: { level: 2 } } },
    ], {});
    const compPatch = out.patches.find((p) => p.path.join(".") === "companionState.雪豹.stats");
    const scenePatch = out.patches.find((p) => p.path.join(".") === "varTree.世界.场景.鱼定村.guard");
    expect(typeof compPatch.value).toBe("function");
    expect(compPatch.value({ loyalty: 1, trust: 9 })).toEqual({ loyalty: 5, trust: 9 });
    expect(scenePatch.value({ level: 1, patrol: "夜" })).toEqual({ level: 2, patrol: "夜" });
    // 原始值兜底：无旧值时直接用新对象
    expect(compPatch.value(undefined)).toEqual({ loyalty: 5 });
  });

  it("ALTER_WORLD_SCENE 不突变入参 fact.updates", () => {
    const updates = { mood: "戒备" };
    materializeFacts(baseState(), [{ id: "F35", op: "ALTER_WORLD_SCENE", sceneKey: "村", updates }], {});
    expect(updates).toEqual({ mood: "戒备" });
  });

  it("BIND_OR_SETTLE_PACT 同一 NPC 多约共存不互覆", () => {
    const out = materializeFacts(baseState(), [
      { id: "F36", op: "BIND_OR_SETTLE_PACT", npc: "才旦", promise: "约一" },
      { id: "F37", op: "BIND_OR_SETTLE_PACT", npc: "才旦", promise: "约二" },
    ], {});
    const paths = out.patches.map((p) => p.path.join("."));
    expect(paths).toContain("varTree.世界.契约.才旦.F36");
    expect(paths).toContain("varTree.世界.契约.才旦.F37");
  });

  it("GRANT_ITEM 兜底：合法 it_ 前缀 id 原样保留（后续 transfer/reforge 可寻址）", () => {
    const state = baseState();
    state.inv = [];
    const out = materializeFacts(state, [
      { id: "F40", op: "GRANT_ITEM", itemId: "it_whistle_new", itemName: "骨哨" },
    ], {});
    expect(out.changes.inv[0].id).toBe("it_whistle_new");
  });

  it("GRANT_ITEM 兜底：同轮两件同名 fallback 物不撞 id、不丢第二件", () => {
    const state = baseState();
    state.inv = [];
    const out = materializeFacts(state, [
      { id: "F41", op: "GRANT_ITEM", itemName: "馒头" },
      { id: "F42", op: "GRANT_ITEM", itemName: "馒头" },
    ], {});
    const buns = out.changes.inv.filter((e) => e.name === "馒头");
    expect(buns).toHaveLength(2);
    expect(buns[0].id).not.toBe(buns[1].id);
    expect(out.receipts).toHaveLength(2);
  });

  it("BIND_OR_SETTLE_PACT 无键了结：现存未结旧约全部落 settled 标记", () => {
    const state = baseState();
    state.varTree = { 角色: {}, 世界: { 契约: { 才旦: { F_old1: { promise: "旧约一" }, F_old2: { promise: "旧约二", settled: { turn: 1 } } } } } };
    const out = materializeFacts(state, [
      { id: "F43", op: "BIND_OR_SETTLE_PACT", npc: "才旦", settle: true },
    ], {});
    const paths = out.patches.map((p) => p.path.join("."));
    expect(paths).toContain("varTree.世界.契约.才旦.F_old1.settled");
    expect(paths).not.toContain("varTree.世界.契约.才旦.F_old2.settled"); // 已结的跳过
    expect(paths).not.toContain("varTree.世界.契约.才旦.F43.settled"); // 不写到自己名下
  });

  it("GRANT_ITEM 兜底：同一事实重复出现只授一件（factId 幂等）", () => {
    const state = baseState();
    state.inv = [];
    const out = materializeFacts(state, [
      { id: "F50", op: "GRANT_ITEM", itemName: "馒头" },
      { id: "F50", op: "GRANT_ITEM", itemName: "馒头" },
    ], {});
    expect(out.changes.inv.filter((e) => e.name === "馒头")).toHaveLength(1);
    expect(out.receipts).toHaveLength(1);
  });

  it("GRANT_ITEM 兜底：供来的 id 已被 NPC 持有时另 mint 新 id，不撞原主", () => {
    const state = baseState();
    state.inv = [];
    const out = materializeFacts(state, [
      { id: "F51", op: "GRANT_ITEM", itemId: "it_whistle", itemName: "骨哨" },
    ], {});
    const granted = out.changes.inv.find((e) => e.name === "骨哨");
    expect(granted.id).not.toBe("it_whistle"); // NPC 身上那件才是真主
    expect(granted.id).toMatch(/^it_[0-9a-f]+$/);
  });

  it("未知事实码不静默：进 logs 记异", () => {
    const out = materializeFacts(baseState(), [{ id: "F99", op: "SUMMON_DRAGON" }], {});
    expect(out.logs.some((l) => l.text.includes("SUMMON_DRAGON"))).toBe(true);
  });
});

describe("WO-16E 每日搜刮配额账", () => {
  const lootState = () => ({
    time: 48, inv: [], room: { npcs: [], items: [] }, varTree: { 世界: {} },
    flags: [], skills: [], char: { hp: [10, 10], special: {} },
  });
  it("天机券编译入袋计数，预设/兜底不占配额", async () => {
    const { materializeFacts } = await import("./materializeFacts.js");
    // 编译产物入袋 → count+1
    const r1 = materializeFacts(lootState(),
      [{ id: "F1", op: "GRANT_ITEM", itemName: "匕首", to: "player" }],
      { F1: { id: "it_x", name: "匕首", category: "weapon", quality: "绿" } });
    const patch = r1.patches.find((pp) => pp.path?.join(".") === "varTree.世界.每日搜刮");
    expect(patch).toBeTruthy();
    expect(patch.value).toEqual({ day: 3, count: 1 });
    // 无编译产物（预设物直发/兜底）→ 不计数
    const r2 = materializeFacts(lootState(),
      [{ id: "F2", op: "GRANT_ITEM", itemName: "预设物", to: "player" }], {});
    expect(r2.patches.some((pp) => pp.path?.join(".") === "varTree.世界.每日搜刮")).toBe(false);
  });
  it("跨日归零重计", async () => {
    const { materializeFacts } = await import("./materializeFacts.js");
    const st = lootState();
    st.varTree = { 世界: { 每日搜刮: { day: 2, count: 3 } } }; // 昨天的账
    const r = materializeFacts(st,
      [{ id: "F1", op: "GRANT_ITEM", itemName: "匕首", to: "player" }],
      { F1: { id: "it_x", name: "匕首", category: "weapon", quality: "绿" } });
    const patch = r.patches.find((pp) => pp.path?.join(".") === "varTree.世界.每日搜刮");
    expect(patch.value).toEqual({ day: 3, count: 1 }); // 不是 4——跨日归零
  });
});

describe("WO-21B 心账写侧五类迁移", () => {
  const socialBase = () => {
    const base = baseState();
    base.varTree = { 角色: { 才旦: { 好感度: 10 } }, 世界: {} };
    base.room = { ...base.room, name: "鱼定村", npcs: [{ name: "才旦" }] };
    return base;
  };
  const runValue = (patch, prev) => (typeof patch.value === "function" ? patch.value(prev) : patch.value);

  it("新写五类正常落账：tag/summary/turn/place/witnesses 全保留", () => {
    const out = materializeFacts(socialBase(), [
      { id: "H1", op: "MUTATE_SOCIAL", npc: "才旦", affectionDelta: 5, ledgerKind: "恩", reason: "雪中送炭", witnesses: ["主角", "才旦"] },
    ], {});
    const lp = out.patches.find((p) => p.path.join(".") === "varTree.角色.才旦.心账");
    expect(lp).toBeTruthy();
    const entries = runValue(lp, []);
    expect(entries).toHaveLength(1);
    expect(entries[0].tag).toBe("恩");
    expect(entries[0].summary).toBe("雪中送炭");
    expect(entries[0].witnesses).toEqual(["主角", "才旦"]);
    expect(entries[0].place).toBe("鱼定村");
    expect(entries[0].turn).toBeGreaterThan(0);
    // 不再写旧 kind/reason 键位——新写形状就是 tag/summary
    expect(entries[0].kind).toBeUndefined();
  });

  it("旧类目谊/隙/和与未知类目拒写不静默", () => {
    for (const legacy of ["谊", "隙", "和", "胡编"]) {
      const out = materializeFacts(socialBase(), [
        { id: "H2", op: "MUTATE_SOCIAL", npc: "才旦", ledgerKind: legacy, reason: "x" },
      ], {});
      expect(out.patches.some((p) => p.path.join(".") === "varTree.角色.才旦.心账")).toBe(false);
      expect(out.logs.some((l) => l.text.includes("拒写"))).toBe(true);
    }
  });

  it("同回合同类同简述反复搭话：id 确定性去重不撞 row key", () => {
    const fact = { id: "H4", op: "MUTATE_SOCIAL", npc: "才旦", ledgerKind: "恩", reason: "搭话投机", witnesses: ["主角", "才旦"] };
    const out = materializeFacts(socialBase(), [fact, { ...fact, id: "H5" }], {});
    const patches = out.patches.filter((p) => p.path.join(".") === "varTree.角色.才旦.心账");
    expect(patches.length).toBe(2);
    const runValue = (patch, prev) => (typeof patch.value === "function" ? patch.value(prev) : patch.value);
    // 串行应用两条 merge：第二条应看到第一条的 id 并加 #2 后缀
    const after1 = runValue(patches[0], []);
    const after2 = runValue(patches[1], after1);
    const ids = after2.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[1]).toBe(`${ids[0]}#2`);
  });

  it("单人 16 条上限淘汰最旧", () => {
    const out = materializeFacts(socialBase(), [
      { id: "H3", op: "MUTATE_SOCIAL", npc: "才旦", ledgerKind: "见", reason: "第十七面" },
    ], {});
    const lp = out.patches.find((p) => p.path.join(".") === "varTree.角色.才旦.心账");
    const prev = Array.from({ length: 16 }, (_, i) => ({ id: `old${i}`, tag: "见", summary: `旧${i}` }));
    const entries = runValue(lp, prev);
    expect(entries).toHaveLength(16);
    expect(entries[0].summary).toBe("旧1"); // 最旧「旧0」被淘汰
    expect(entries.at(-1).summary).toBe("第十七面");
  });
});

describe("D2 旁观者「见」补好感建档", () => {
  it("未建档 npc 记见：补 INITIAL_FAVORABILITY 好感+已认识人物，心账可见", () => {
    const state = baseState();
    state.varTree = { 角色: {}, 世界: {} };
    const out = materializeFacts(state, [
      { id: "W1", op: "MUTATE_SOCIAL", npc: "卓嘎", affectionDelta: 0, ledgerKind: "见", reason: "撞见翻动才旦的木箱", witnesses: ["主角", "卓嘎"] },
    ], {});
    const patchPaths = (out.patches || []).map((pp) => pp.path.join("."));
    expect(patchPaths.some((pp) => pp.includes("卓嘎") && pp.includes("好感度"))).toBe(true);
    expect(patchPaths.some((pp) => pp.includes("已认识人物"))).toBe(true);
    expect(patchPaths.some((pp) => pp.includes("心账"))).toBe(true);
  });
  it("已建档 npc 记见不重复 pin", () => {
    const state = baseState();
    state.varTree = { 角色: { 卓嘎: { 好感度: 42 } }, 世界: { 已认识人物: ["卓嘎"] } };
    const out = materializeFacts(state, [
      { id: "W2", op: "MUTATE_SOCIAL", npc: "卓嘎", affectionDelta: 0, ledgerKind: "见", reason: "撞见翻动木箱" },
    ], {});
    const pins = (out.patches || []).filter((pp) => pp.path.join(".").includes("好感度") && pp.value === 10);
    expect(pins).toHaveLength(0);
    expect((out.patches || []).some((pp) => pp.path.join(".").includes("心账"))).toBe(true);
  });
});
