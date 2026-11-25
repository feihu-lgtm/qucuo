// OC 冒险者入队判定层（docs/设计_OC入队与留守.md 二节）。
// 四座桥同一个归宿：unlockImportedCompanion —— AI 负责演议价对话，系统只做门槛裁决：
//   hire      出价 ≥ levelCap×HIRE_PRICE_PER_CAP（tradeStyle 不收钱的免谈）
//   quest     轻量人情完成旗 oc_favor_done_<id>（giver/objective 名单标记，走 flags 通道）
//   favor     好感度 ≥ OC_FAVOR_THRESHOLD（varTree.角色[名].好感度）
//   childhood 开局青梅竹马旗 oc_childhood_<id>（角色创建时钉死）
// 附带撞车防护 npcBusyInQuest：NPC 出现在进行中任务链的 giver/打手名单即拒邀——
// OC 是动态散人天然通过，导入的具名 NPC 会撞上。

import { allContent } from "../../domain/rules/content/registry.js";
import { unlockImportedCompanion, unlockFollowerCompanion } from "../../domain/rules/companion/companion.js";
import { ocSignatureMoves } from "../../domain/rules/companion/ocKungfu.js";
import { markNpcAsKnown } from "../../domain/rules/npc/npcAwareness.js";
import { removeNpc } from "../../domain/rules/npc/roomNpcs.js";
import { isNpcAngry } from "../../domain/rules/combat/stealSystem.js";

export const OC_FAVOR_THRESHOLD = 60;
export const HIRE_PRICE_PER_CAP = 80;
export const OC_QUEST_DONE_PREFIX = "oc_favor_done_";
export const OC_CHILDHOOD_PREFIX = "oc_childhood_";

export function hirePriceFor(adv) {
  return Math.max(1, Math.floor(Number(adv?.levelCap) || 1)) * HIRE_PRICE_PER_CAP;
}

// 「不收金银/对钱没概念」的 OC：雇佣路从设定上就不通
// 「不要寻常金银，只收罕见金属」这类变相拒银也要认——普通银两雇不动他。
function refusesMoney(adv) {
  const s = String(adv?.tradeStyle || "");
  return /(不收|不要|不取)[^，。]{0,8}(金银|钱|银两)|分文不取|对钱币毫无概念|不懂金钱/.test(s);
}

// 撞车守卫：npcName 出现在进行中任务链的 giver/stage.giver/combatNpc.name 里 → 返回任务题名，否则 null
export function npcBusyInQuest(state, npcName) {
  if (!npcName) return null;
  const progress = state?.questProgress || {};
  for (const q of allContent("quest")) {
    const p = progress[q.id];
    if (!p || p.status !== "active") continue;
    const names = new Set();
    if (q.giver) names.add(q.giver);
    for (const st of q.stages || []) {
      if (st.giver) names.add(st.giver);
      for (const ch of st.choices || []) {
        if (ch.combatNpc?.name) names.add(ch.combatNpc.name);
      }
    }
    if (names.has(npcName)) return q.title || q.id;
  }
  return null;
}

// 已入队/已在槽判定：imported_<name> 槽位已有数据即不可重复招募
function alreadyCompanion(state, name) {
  return !!state?.companionState?.[`imported_${name}`]?.unlocked;
}

/**
 * 动作菜单可用的招募路线清单：每路给一个 {route,label,desc}。
 * hire/favor 常驻；quest 只在挂过人情（完成旗或待办旗 oc_favor_pending_<id>）时出现；
 * childhood 只在开局旗在时出现——「合稿没写不硬加」的菜单版。
 */
export function ocMenuRoutes(state, adventurer) {
  if (!adventurer?.id || alreadyCompanion(state, adventurer.name)) return [];
  const flags = state?.flags || [];
  const favor = Number(state?.varTree?.角色?.[adventurer.name]?.好感度) || 0;
  const routes = [];
  if (!refusesMoney(adventurer)) {
    routes.push({ route: "hire", label: "雇佣", desc: `出价${hirePriceFor(adventurer)}两邀他同行` });
  }
  routes.push({ route: "favor", label: "邀请入队", desc: `凭交情结伴（好感${favor}/${OC_FAVOR_THRESHOLD}）` });
  if (flags.includes(`${OC_QUEST_DONE_PREFIX}${adventurer.id}`) || flags.includes(`oc_favor_pending_${adventurer.id}`)) {
    routes.push({ route: "quest", label: "人情两讫", desc: "事了同行，恩怨两清" });
  }
  if (flags.includes(`${OC_CHILDHOOD_PREFIX}${adventurer.id}`)) {
    routes.push({ route: "childhood", label: "青梅同行", desc: "同乡旧谊，零门槛结伴" });
  }
  return routes;
}

/**
 * 四路招募判定。
 * @returns {{ok:boolean, reason?:string, effect?:object}} effect 供 applyRecruit 展开：
 *   { companionState, moneyDelta, flagsAdd, npc }
 */
export function recruitOC(state, adventurer, route, ctx = {}) {
  if (!adventurer?.name || !adventurer?.id) return { ok: false, reason: "没有这位江湖散人。" };
  if (alreadyCompanion(state, adventurer.name)) return { ok: false, reason: `${adventurer.name}已在队中。` };
  if (isNpcAngry(state?.varTree, adventurer.name)) return { ok: false, reason: `${adventurer.name}还在气头上，不肯理你。` };
  const busy = npcBusyInQuest(state, adventurer.name);
  if (busy) return { ok: false, reason: `${adventurer.name}眼下有事缠身（${busy}），不便同行。` };

  // 兼任驻场任务发布人的 OC（姬无双/樊未离）：名下任务链没走完就收编，
  // 驻场壳随入队撤掉、任务永远找不到 giver——事了再来。
  const flags = state?.flags || [];
  const giverQuest = allContent("quest").find((q) =>
    (q.giver === adventurer.name || q.stages?.some((st) => st.giver === adventurer.name))
    && !flags.includes(`quest_done_${q.id}`)
    && !["done", "completed"].includes(state?.questProgress?.[q.id]?.status));
  if (giverQuest) {
    return { ok: false, reason: `${adventurer.name}还有未了的事（${giverQuest.title || giverQuest.id}），事了再来。` };
  }

  let moneyDelta = 0;
  switch (route) {
    case "hire": {
      if (refusesMoney(adventurer)) return { ok: false, reason: `${adventurer.name}不收金银，这套行不通。` };
      const price = hirePriceFor(adventurer);
      const offer = Math.floor(Number(ctx.offer) || 0);
      if (offer < price) return { ok: false, reason: `${adventurer.name}开价${price}两，${offer ? `${offer}两不够。` : "先谈个价。"}` };
      if ((state?.char?.money ?? 0) < offer) return { ok: false, reason: "囊中没有这么多银两。" };
      moneyDelta = -offer;
      break;
    }
    case "quest": {
      if (!flags.includes(`${OC_QUEST_DONE_PREFIX}${adventurer.id}`)) {
        return { ok: false, reason: `${adventurer.name}托你办的事还没了结。` };
      }
      break;
    }
    case "favor": {
      const favor = Number(state?.varTree?.角色?.[adventurer.name]?.好感度) || 0;
      if (favor < OC_FAVOR_THRESHOLD) {
        return { ok: false, reason: `与${adventurer.name}交情尚浅（好感${favor}/${OC_FAVOR_THRESHOLD}）。` };
      }
      break;
    }
    case "childhood": {
      if (!flags.includes(`${OC_CHILDHOOD_PREFIX}${adventurer.id}`)) {
        return { ok: false, reason: `${adventurer.name}与你并无同乡愁谊。` };
      }
      break;
    }
    default:
      return { ok: false, reason: "这条路走不通。" };
  }

  const npc = {
    name: adventurer.name,
    levelCap: adventurer.levelCap,
    brief: adventurer.brief || adventurer.fullBio || adventurer.title,
    signatureMoves: ocSignatureMoves(adventurer),
  };
  // 主人的随从（铁伯、阿财、醉花……）作为另一个伙伴一并入队，主人仍是出战位
  const withOwner = unlockImportedCompanion(state?.companionState || {}, npc);
  const companionState = unlockFollowerCompanion(withOwner, adventurer);
  const followerName = companionState !== withOwner ? adventurer.follower.name : null;
  return {
    ok: true,
    effect: {
      npc,
      moneyDelta,
      companionState,
      followerName,
      bondRoute: route, // 情谊绑定标记：quest/favor/childhood 不可解雇，hire 可遣回
    },
  };
}

/**
 * 招募成功后的落盘件：形状与 inviteCompanion 的 {changes,logs} 一致，走 applyResult 通道。
 * 入队即把该 NPC 从当前房间移除（被玩家带走）。
 */
export function applyRecruit(state, adventurer, effect) {
  return {
    changes: {
      companionState: effect.companionState,
      ...(effect.moneyDelta ? { char: (c) => ({ ...c, money: Math.max(0, (c.money || 0) + effect.moneyDelta) }) } : {}),
      varTree: (prev) => markNpcAsKnown(prev || {}, adventurer.name),
      room: (prev) => ({
        ...prev,
        npcs: removeNpc(prev.npcs, (entry) => entry.name === adventurer.name || (!!effect.followerName && entry.name === effect.followerName)),
      }),
    },
    // 随从一并入队不写固定句：把随从是谁、什么来历交给结算叙事，由 AI 写这一幕
    settle: `与${adventurer.name}击掌为誓，自此结伴同行${followerSettleNote(effect.followerName && adventurer.follower)}`,
    settleOptions: { settleNpc: adventurer.name, settleKind: "companion_invite", settleBeast: false },
  };
}

// 结算里只交代事实（随从是谁、什么来历），这一幕怎么写交给 AI
function followerSettleNote(follower) {
  if (!follower) return "";
  const kind = follower.type ? `随从${follower.type}` : "随从";
  return `；${kind}${follower.name}（${follower.desc || follower.type}）也随主人一并入队，从此同在队中`;
}
