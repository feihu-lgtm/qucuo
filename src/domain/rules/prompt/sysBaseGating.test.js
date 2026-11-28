import { describe, it, expect, vi } from "vitest";
import { buildSysBase } from "./sysBase.js";

// 本文件钉住 buildSysBase 的"开关矩阵"：scope / narrativeOnly / opts 各开关
// 组合下，物件志、认知隔离、MVU、schema 形状、settle 铁律该不该出现。
// settleAndTalk.test.js 已覆盖的部分（talk 物品规范、learn/appease/duel_invite
// 铁律、duelReport、心灵之海门禁）不重复——这里补的是剩下的分支。

const NARRATOR = { stage: "NORMAL", affection: 20 };
// buildSysBase(字数, narrator, scenario, budgetInstruction, embedding, npcLore, narrativeOnly, scope, opts)
const mk = (scope, narrativeOnly = false, opts = {}) =>
  buildSysBase(220, NARRATOR, "剧本总纲占位", null, false, "", narrativeOnly, scope,
    { playerName: "少侠", ...opts });

const worldInfoAfter = (r) => r.sysBlocks.find(b => b.tavernBlock === "worldInfoAfter").content;

describe("wantMvu 绿灯：只在'这一轮可能改好感/变量'时挂 MVU 说明书", () => {
  it("settle+settleNpc → phi 里带 <mvu> 附注与说明书", () => {
    // 契约：settle 轮牵涉具体 NPC 时，schema 尾部与 11 号位都要教会模型写 mvu。
    const { phiBlock, phiRules } = mk("settle", false, { settleNpc: "温掌柜" });
    expect(phiBlock.content).toContain("<mvu>");
    expect(phiRules).toContain("_.set('角色.某某.好感度'");
  });

  it("settle 但无 settleNpc → 无人可改，mvu 一字不发", () => {
    // 契约：结算轮没点名 NPC，MVU 段整体灭灯（schema 和规则都没有）。
    const { phiBlock, phiRules } = mk("settle", false);
    expect(phiBlock.content).not.toContain("<mvu>");
    expect(phiRules).not.toContain("_.set('角色");
  });

  it("full+无人（hasNpc:false）→ mvu 灭灯，每轮省掉说明书", () => {
    // 契约：全量档但场上无人，也不发 MVU 说明书。
    const { phiBlock, phiRules } = mk("full", false, { hasNpc: false });
    expect(phiBlock.content).not.toContain("<mvu>");
    expect(phiRules).not.toContain("_.set('角色");
  });

  it("创造模式（gm:true）即使无人也强制挂 mvu——要能凭空设变量", () => {
    // 契约：gm 覆盖 hasNpc:false，MVU 保持挂载。
    const { phiRules } = mk("full", false, { hasNpc: false, gm: true });
    expect(phiRules).toContain("_.set('角色.某某.好感度'");
  });

  it("narrativeOnly（双调用）→ 任何情况下主叙事都不谈 mvu", () => {
    // 契约：提取层模式下主调用只产散文，mvu 说明书与附注全部不出现。
    const { phiBlock, phiRules } = mk("settle", true, { settleNpc: "温掌柜" });
    expect(phiBlock.content).toContain("禁输出JSON、<mvu>块及任何结构化内容");
    expect(phiRules).not.toContain("_.set('角色");
    expect(phiRules).not.toContain("关于下面那条 <mvu>");
  });
});

describe("wantIsolation / wantCatalog 按 scope 亮灭", () => {
  it("认知隔离常驻全部 scope（保 sysBlocks 冰山前缀缓存不被 move/settle 击穿）", () => {
    for (const [scope, opts] of [["move", { hasNpc: true }], ["settle", { settleNpc: "温掌柜" }], ["full", { hasNpc: true }], ["talk", {}]]) {
      expect(worldInfoAfter(mk(scope, false, opts))).toContain("NPC 认知隔离");
    }
  });

  it("物件志只在 full+mayGrantItem 时挂；move/settle 一律不挂", () => {
    // 契约：wantCatalog = full && mayGrantItem!==false——寻常轮灭灯防诱导发物。
    // WO-04：物件志属动态块，一律不进 sysBlocks，由 dynBlocks.catalog 带出。
    expect(mk("full", false, { mayGrantItem: false }).dynBlocks.catalog).not.toContain("曲措乡物件志");
    expect(mk("full", false, { mayGrantItem: true }).dynBlocks.catalog).toContain("曲措乡物件志");
    expect(mk("move", false, { hasNpc: true }).dynBlocks.catalog).not.toContain("曲措乡物件志");
    expect(mk("settle", false, { settleNpc: "温掌柜" }).dynBlocks.catalog).not.toContain("曲措乡物件志");
    // 无论哪一档，sysBlocks 里都不再出现物件志（前缀缓存不因它跳变）。
    for (const r of [mk("full", false, { mayGrantItem: true }), mk("talk", false)]) {
      expect(r.sysBlocks.map((b) => b.content).join("\n")).not.toContain("曲措乡物件志");
    }
  });
});

describe("schema 形状按 scope 分档", () => {
  it("settle：只有 output+memory，禁 room/char/dao/delta", () => {
    // 契约：结算档 schema 缩到最小，并明文禁改状态。
    const { phiBlock } = mk("settle", false, { settleNpc: "温掌柜" });
    expect(phiBlock.content).toContain('"output":["行1","行2"],"memory"');
    expect(phiBlock.content).toContain("禁输出 room/char/dao/delta");
    expect(phiBlock.content).not.toContain('"char":{"hp"');
  });

  it("move：带 room 不含 char/dao/delta", () => {
    // 契约：移动档 schema 只有 output+room，不写角色状态。
    const { phiBlock } = mk("move", false, { hasNpc: true });
    expect(phiBlock.content).toContain('"room":{"name"');
    expect(phiBlock.content).not.toContain('"char":{"hp"');
    expect(phiBlock.content).not.toContain('"dao"');
  });

  it("雪豹赠礼中的 settle：放开 delta.flags_add 唯一例外", () => {
    // 契约：opts.snowLeopardGift 时 settle schema 允许 flags_add:["snow_spirit_meat"]。
    const { phiBlock } = mk("settle", false, { settleNpc: "雪豹", snowLeopardGift: true });
    expect(phiBlock.content).toContain("snow_spirit_meat");
    expect(phiBlock.content).toContain("delta只允许flags_add");
  });
});

describe("budgetInstruction 与 scenario 蓝绿灯", () => {
  it("传了动态字数指令就用它，没传退回全局固定字数", () => {
    // 契约：budgetInstruction 优先于 targetWordCount 生成的默认篇幅句。
    // WO-04：篇幅要求撤出 sysBlocks（authorsNote 已撤），由 dynBlocks.lenNote 带出。
    const dyn = buildSysBase(220, NARRATOR, "x", "本轮只答一两句。", false, "", false, "full", { hasNpc: true });
    expect(dyn.dynBlocks.lenNote).toContain("本轮只答一两句。");
    expect(dyn.dynBlocks.lenNote).not.toContain("约 220 字");
    const def = mk("full", false, { hasNpc: true });
    expect(def.dynBlocks.lenNote).toContain("约 220 字");
    // 任何一档的 sysBlocks 都不含篇幅要求。
    expect(def.sysBlocks.map((b) => b.content).join("\n")).not.toContain("篇幅要求");
    expect(def.sysBlocks.find((b) => b.tavernBlock === "authorsNote")).toBeUndefined();
  });

  it("冰山前缀：同一 scope 下逐轮输入再变，sysBlocks 也一字不动", () => {
    // 契约（WO-04 核心）：sysBlocks 严格收束为不随单轮输入跳变的冰山前缀——
    // scenario 固定，玩家输入分别命中/不命中绿灯关键词，加上字数预算、NPC 人设、
    // 好感档位的差异，sysBlocks 也必须逐字节相同；绿灯差异只能进 dynBlocks。
    const scenario = "世界观头部。\n\n具名人物\n才旦是鱼定村的年轻猎户。\n\n拓扑连通关系\n鱼定村北通天都镇。";
    const build = (budget, npcLore, affection, userInput) => buildSysBase(220, { stage: "NORMAL", affection }, scenario, budget, false, npcLore, false, "full",
      { playerName: "少侠", hasNpc: true, gateCtx: { userInput, lastReply: "" } });
    // a：命中绿灯词「鱼定村」（拓扑）与「才旦」（具名人物）；b：一个绿灯词都不沾；
    // c：换一批命中词（大草甸→规则补充段）+ 不同预算/人设/好感档位。
    const a = build("本轮只答一两句。", "才旦的人设甲", 20, "去鱼定村找才旦");
    const b = build("本轮写长些，写足五百字。", "呼延雪的人设乙", 80, "四下打量");
    const c = build(null, "", 50, "穿过大草甸赶路");
    const dump = (r) => JSON.stringify(r.sysBlocks.map((x) => [x.tavernBlock, x.content]));
    expect(dump(a)).toBe(dump(b));
    expect(dump(a)).toBe(dump(c));
    // 绿灯差异确实发生了（a 点亮拓扑/具名人物，b 全灭），且只落在 dynBlocks.scenarioLit。
    expect(a.dynBlocks.scenarioLit).toContain("拓扑连通关系");
    expect(a.dynBlocks.scenarioLit).toContain("具名人物");
    expect(b.dynBlocks.scenarioLit).not.toContain("拓扑连通关系");
    expect(b.dynBlocks.scenarioLit).not.toContain("具名人物");
    // 蓝灯基底留守 scenario 块，三种输入下一致。
    const scenBlock = (r) => r.sysBlocks.find((x) => x.tavernBlock === "scenario").content;
    expect(scenBlock(a)).toContain("世界观头部");
    expect(scenBlock(a)).not.toContain("拓扑连通关系");
    expect(scenBlock(a)).toBe(scenBlock(b));
  });

  it("绿灯专项世界观段不进 sysBlocks：蓝灯基底留守，专项段走 dynBlocks", () => {
    // 契约：scenario 里被关键词/状态点亮的专项段（如拓扑）属动态内容。
    const scenario = "世界观头部。\n\n拓扑连通关系\n鱼定村北通天都镇。";
    const r = buildSysBase(220, NARRATOR, scenario, null, false, "", false, "move",
      { playerName: "少侠", hasNpc: true, gateCtx: { userInput: "", lastReply: "" } });
    expect(r.sysBlocks.find((x) => x.tavernBlock === "scenario").content).toContain("世界观头部");
    expect(r.sysBlocks.find((x) => x.tavernBlock === "scenario").content).not.toContain("拓扑连通关系");
    expect(r.dynBlocks.scenarioLit).toContain("拓扑连通关系");
  });

  it("gateCtx 存在时 scenario 过蓝绿灯裁剪并回报亮灭", () => {
    // 契约：opts.gateCtx → gateScenario 生效，onGateReport 拿到 lit/dark 清单。
    // WO-04：sysBlocks 的 scenario 块只装蓝灯基底；蓝+绿合起来仍等于 gated.text 全文。
    const onGateReport = vi.fn();
    const { sysBlocks, dynBlocks } = mk("full", false, {
      hasNpc: true,
      gateCtx: { cmd: "赶路" },
      onGateReport,
    });
    expect(onGateReport).toHaveBeenCalledTimes(1);
    const gated = onGateReport.mock.calls[0][0];
    expect(Array.isArray(gated.lit) && Array.isArray(gated.dark)).toBe(true);
    const blueText = sysBlocks.find(b => b.tavernBlock === "scenario").content;
    const reunited = [blueText, dynBlocks.scenarioLit].filter(Boolean).join("\n\n");
    expect(reunited).toBe(gated.text);
  });

  it("dedupIfMvu：MVU 在场时熄掉重复的好感度规则段，散文档保留", () => {
    // 契约：scenario 的「好感度维护规则」默认段与 MVU 说明书重复——MVU 在场（单调用）时熄灯，
    // 散文档（无 MVU）照常保留，保证约束至少有一处承载。
    const scenario = "世界观头部。\n\n好感度维护规则\n- 寻常聊天 +1，用 _.add 微调。\n\n拓扑连通关系\n鱼定村北通天都镇。";
    const build = (narrativeOnly) => buildSysBase(220, NARRATOR, scenario, null, false, "", narrativeOnly, "full",
      { playerName: "少侠", hasNpc: true, gateCtx: { cmd: "" } });
    // WO-04：好感度规则段随 MVU 有无跳变，属动态内容——单调用熄灯（两边都没有），
    // 散文档保留在 dynBlocks.scenarioLit；sysBlocks 的 scenario 块两种情况下都不含它。
    const scen = (r) => r.sysBlocks.find(b => b.tavernBlock === "scenario").content;
    expect(scen(build(false))).not.toContain("好感度维护规则");
    expect(build(false).dynBlocks.scenarioLit).not.toContain("好感度维护规则");
    expect(scen(build(true))).not.toContain("好感度维护规则");
    expect(build(true).dynBlocks.scenarioLit).toContain("好感度维护规则");
  });

  it("dedupIfMvu：剧本自定义的好感度规则（无出厂指纹）MVU 在场也保留", () => {
    // 契约：自定义刻度/条件的好感度规则不属重复——MVU 在场同样点亮，不静默丢弃。
    // WO-04：该段属条目化段落，不随输入跳变——留在 sysBlocks 蓝灯基底（探针下同样保留）。
    const scenario = "好感度维护规则\n- 本剧本好感度以 -100~100 计，敌对开局 -30。";
    const { sysBlocks, dynBlocks } = buildSysBase(220, NARRATOR, scenario, null, false, "", false, "full",
      { playerName: "少侠", hasNpc: true, gateCtx: { cmd: "" } });
    const inSys = sysBlocks.find(b => b.tavernBlock === "scenario").content;
    const inDyn = dynBlocks.scenarioLit;
    expect(inSys + inDyn).toContain("好感度维护规则");
  });

  it("不传 gateCtx 时 scenario 原文直进（lit/dark 为空）", () => {
    // 契约：无 gateCtx → 不裁剪（lit/dark 皆空、原文直进），但仍回报给面板。
    const onGateReport = vi.fn();
    const { sysBlocks } = mk("full", false, { hasNpc: true, onGateReport });
    expect(onGateReport).toHaveBeenCalledWith({ text: "剧本总纲占位", lit: [], dark: [] });
    expect(sysBlocks.find(b => b.tavernBlock === "scenario").content).toBe("剧本总纲占位");
  });
});

describe("settleKind 铁律的其余分支", () => {
  it("gift+weight（双调用）：写成系统已交付，禁重复扣除", () => {
    // 契约：narrativeOnly 下带分量的送礼走 giftWeight 模板——交付是既成事实。
    const { phiRules } = mk("settle", true, {
      settleNpc: "才旦", settleKind: "gift",
      giftInfo: { itemName: "青布", weight: { label: "薄礼", reaction: "礼貌致谢", range: [0, 1] } },
    });
    expect(phiRules).toContain("已由系统交付，禁重复扣除");
    expect(phiRules).toContain("青布");
  });

  it("companion_invite 双调用：必写爽快应下；兽类伙伴不说人话", () => {
    // 契约：叙事侧铁律把结伴写成既成事实，beast 标志决定能不能开口。
    const { phiRules } = mk("settle", true, {
      settleNpc: "墨团", settleKind: "companion_invite", settleBeast: true,
    });
    expect(phiRules).toContain("伙伴入队铁律");
    expect(phiRules).toContain("cannotSpeak");
    expect(phiRules).toContain("禁写犹豫、观望、抗拒");
  });

  it("companion_invite：雪豹、珍珠认主即化为 18 岁以上成年女子，能说话", () => {
    for (const dual of [true, false]) {
      for (const settleNpc of ["雪豹", "珍珠"]) {
        const { phiRules } = mk("settle", dual, { settleNpc, settleKind: "companion_invite", settleBeast: true });
        expect(phiRules).toContain("化为人形");
        expect(phiRules).toContain("年满十八岁以上的成年女子");
        expect(phiRules).toContain("绝不写成未成年");
        expect(phiRules).not.toContain("cannotSpeak");
      }
    }
  });

  it("companion_invite 单调用：好感系统钉账，禁写好感 MVU", () => {
    // 新契约（WO-16B）：伙伴入队初始好感由 feature deterministic 钉账，
    // 提示词不再要求 _.set，反而禁止模型写好感 MVU（防双计）。
    const { phiRules } = mk("settle", false, {
      settleNpc: "才旦", settleKind: "companion_invite",
    });
    expect(phiRules).toContain("禁输出任何好感相关 <mvu>");
    expect(phiRules).not.toContain("_.set('角色.才旦.好感度'");
    expect(phiRules).not.toContain("本轮必须输出 <mvu>");
  });

  it("未注册 settleKind 的通用 settle：仍是软措辞提示", () => {
    // 契约：settleNpc 在场但 settleKind 不在铁律表里 → 提示"确有变化才给 mvu"。
    const { phiRules } = mk("settle", false, { settleNpc: "温掌柜", settleKind: "hire" });
    expect(phiRules).toContain("关于下面那条 <mvu>：如果这一轮牵涉的人物（温掌柜）对玩家的观感确有变化才给出");
  });

  it("narrativeOnly + judgeActive：放行 ---SEAL--- 尾章，只禁其余结构化", () => {
    const textOn = JSON.stringify(mk("full", true, { judgeActive: true }).phiBlock);
    expect(textOn).toContain("---SEAL---");
    const textOff = JSON.stringify(mk("full", true).phiBlock);
    expect(textOff).toContain("写完即止");
    expect(textOff).not.toContain("---SEAL---");
  });
});

describe("V7a 旁观者与同伴写法硬约束（村口复读根治）", () => {
  it("worldInfoAfter 带硬约束：旁观者不点名/禁复读静态习性/非亲密禁发情模板", () => {
    const block = worldInfoAfter(mk("full", false, { hasNpc: true }));
    expect(block).toContain("在场旁观者默认不点名");
    expect(block).toContain("禁止复读近两轮已经写过的静态习性");
    expect(block).toContain("雪豹母鸡蹲发痒");
    expect(block).toContain("珍珠低头啃草");
    expect(block).toContain("大公鸡扑棱啄脚");
    expect(block).toContain("发情模板");
  });
});
