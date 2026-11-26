// ── WO-24B world.prep 后台备料 prompt 注册 + 输入装配（无触发器/不写 store）──
// 手册口径：AI 是幕后的备料人，只交三样素材——npcPlans/tavernRumors/prepItems；
// 不许预测玩家下一步，不许写既定事实，不许给神兵绝学。输入装配是 domain 纯函数，
// 只收在场 NPC、未翻容器、宿敌摘要、近期事实——绝不传完整 varTree 大杂烩。
import { definePrompt } from "../registry.js";
import { flattenNemeses } from "../../nemesis/nemesisLines.js";
import { ITEM_CATEGORY } from "../../economy/equipment.js";
import { prepEligibleContainerNames, resolveContainerContext } from "../../world/containers.js";
import { getInnerRoom, isNpcVisibleInInnerRoom } from "../../map/innerMap.js";

const QUALITY_ENUM = ["白", "绿", "蓝", "紫"]; // 最高紫——不给神兵绝学
const CATEGORY_ENUM = Object.values(ITEM_CATEGORY);

// ── 输入装配纯函数：buildWorldPrepInput(state) ─────────────────────────────
// 只产出 prompt 需要的六个裁剪后文本/变量；输入方自行裁剪脱敏：
//  · 在场 NPC 只给名字+一句 brief（cap 5，隐去好感/账簿等私有账）；
//  · 未翻容器读 varTree.世界.容器（WO-24A 底账，未落地前自然为空，不炸）；
//  · 宿敌摘要只给 active 谱中人物的 名字/势力/tier（cap 3）；
//  · 近期事实只给已补摘要的最近 3 条（varTree.领域.事实）。
export function buildWorldPrepInput(state, { maxQualityHint = "紫" } = {}) {
  const room = state?.room || {};
  const varTree = state?.varTree || {};
  const time = Number(state?.time) || 0;
  const day = Math.floor(time / 24) + 1;

  // A0：串房修——在场名单必须与 buildPresence/内层房同口径：玩家在内层房时，
  // 村口/茶馆等其他房间的人不是「在场」，不能进备料输入（否则备料给不在场的人
  // 编计划，ingest 白名单又会丢——提示与兑现口径不一致）。
  const presentNpcs = (room.npcs || [])
    .filter((n) => n?.name)
    .filter((n) => isNpcVisibleInInnerRoom(room.name, state?.innerRoomName ?? null, n))
    .slice(0, 5)
    .map((n) => `${n.name}${n.brief ? `（${String(n.brief).slice(0, 20)}）` : ""}`);

  // 容器名单（初审裁决口径）：未翻容器不预先写入 varTree，必须结合房间内容表声明——
  // resolveContainerContext 一站解析（containerPlace=据点/内层房），
  // 取 containerView 里 collapsed !== true 的容器名，cap 4。
  const { containerView } = resolveContainerContext({
    districtName: room.name,
    innerRoomName: state?.innerRoomName ?? null,
    varTree,
    roomDefLookup: getInnerRoom,
  });
  // #524 Review：与 ingest/runner 同源——scripted 容器不给模型当候选，
  // 免得模型照名单起草又被 ingest 丢弃（提示与兑现口径必须一致）。
  const unlooted = prepEligibleContainerNames(containerView).slice(0, 4);

  const nemesisLines = flattenNemeses(varTree)
    .filter((e) => e.status === "active")
    .slice(0, 3)
    .map((e) => `${e.faction}·${e.name}（第${e.tier}阶）`);

  const factsObj = varTree?.领域?.事实;
  const recentFacts = factsObj && typeof factsObj === "object"
    ? Object.values(factsObj)
        .filter((f) => f && typeof f === "object" && String(f.摘要 || "").trim())
        .sort((a, b) => (b.诞生回合 || 0) - (a.诞生回合 || 0))
        .slice(0, 3)
        .map((f) => String(f.摘要).slice(0, 40))
    : [];

  return {
    playerName: state?.char?.name || "侠客",
    maxQualityHint,
    place: room.name || "",
    innerRoom: state?.innerRoomName || "",
    day,
    presentNpcsText: presentNpcs.join("、"),
    unlootedContainersText: unlooted.join("、"),
    nemesisSummaryText: nemesisLines.join("、"),
    recentFactsText: recentFacts.join("；"),
  };
}

export function registerPrepCalls() {
  definePrompt("block", "world.prep.sys", {
    label: "后台备料系统指令",
    slot: "sys",
    text: (ctx) => {
      const p = ctx.prep || {};
      return `你是《天都·曲措》幕后的备料人。${p.playerName || "侠客"} 歇脚、打坐或赶路的空当，你替此地先把暗里的账理好，只交三样素材：

一、在场一位要紧人物今天心里盘算的一件具体的事，以及他接下来真正要去做的事。最多一条。
二、茶馆或巷口正在传的一条风声，要和眼前的势力或宿敌有牵连。最多一条。
三、此处还没被翻过的容器里，可能压着的旧物，零到两件。品阶最高不超过「${p.maxQualityHint || "紫"}」，不许是神兵或绝学。每件附一句翻找之前就能察觉的微弱线索，比如积灰、油纸角、暗格里的空响。

不许预测或代写 ${p.playerName || "侠客"} 接下来的举动，不许写出名单之外的人和容器。这些只是素材，用不用、怎么用，由之后的回合决定。

只输出 schema 规定的 JSON。`;
    },
  });

  definePrompt("block", "world.prep.user", {
    label: "后台备料输入",
    slot: "user",
    text: (ctx) => {
      const p = ctx.prep || {};
      return `当前据点：${p.place || "未知"}（内层：${p.innerRoom || "外街"}）｜时间：第${p.day || 1}日
在场要紧人物：${p.presentNpcsText || "无"}
尚未翻过的容器：${p.unlootedContainersText || "无"}
活跃的宿敌与门派动向：${p.nemesisSummaryText || "平稳无波"}
最近发生的事：${p.recentFactsText || "暂无新事"}
请按 schema 输出 npcPlans（最多 1 条）、tavernRumors（最多 1 条）、prepItems（0 到 2 条）。`;
    },
  });

  definePrompt("call", "world.prep", {
    group: "async",
    label: "休整期后台备料",
    execution: "async_background",
    route: "primary",
    reviewDesc: "备料素材只进 prepSeeds 底账（WO-24A 消费）；不预测玩家、不写既定事实、品阶封顶紫",
    tokenLimitKey: "prep",
    defaultMaxTokens: 3000,
    join: "",
    blocks: ["world.prep.sys", "world.prep.user"],
    schema: {
      name: "world_prep",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["npcPlans", "tavernRumors", "prepItems"],
        properties: {
          npcPlans: {
            type: "array",
            maxItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["npcName", "plan", "nextAction"],
              properties: {
                npcName: { type: "string", description: "在场要紧人物名，必须从输入名单里选" },
                plan: { type: "string", description: "他今天心里盘算的一件具体的事" },
                nextAction: { type: "string", description: "他接下来真正要去做的事" },
              },
            },
          },
          tavernRumors: {
            type: "array",
            maxItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text", "faction", "nemesisId"],
              properties: {
                text: { type: "string", description: "茶馆或巷口正在传的一条风声" },
                faction: { type: "string", description: "关联势力名，无则填空串" },
                nemesisId: { type: "string", description: "关联宿敌编号，无则填空串" },
              },
            },
          },
          prepItems: {
            type: "array",
            maxItems: 2,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["containerId", "name", "category", "quality", "clue"],
              properties: {
                containerId: { type: "string", description: "未翻容器编号，必须从输入名单里选" },
                name: { type: "string", description: "旧物名，不许是神兵或绝学" },
                category: { type: "string", enum: CATEGORY_ENUM },
                quality: { type: "string", enum: QUALITY_ENUM, description: "品阶最高紫" },
                clue: { type: "string", description: "翻找之前就能察觉的微弱线索（积灰/油纸角/空响等）" },
              },
            },
          },
        },
      },
    },
  });
}

registerPrepCalls();
