// 心灵之海 · 开启链路（纯函数，不碰 React 状态、不调 AI）
// ============================================================================
// 整条链是：
//   1. 好感度攒到 ≥90（旁白已是「濒临觉醒」档，立绘已显真容）
//   2. 去雪山派后山温泉，跟玄女说话
//   3. 玄女点破 → 写 flag，旁白当场失态
//   4. 旁白引导玩家回任意一栋安全屋
//   5. 在安全屋里可以进心灵之海
//
// 【为什么门槛是"好感≥90 + 跟玄女说过话"这两条】
// 光有好感不够——那只是旁白自己快撑不住了，还缺一个外人点破。光遇见玄女也不够——
// 好感不到位时旁白根本没有"要被看穿"的东西可看。两条都满足，这件事才成立。
//
// 【为什么必须回安全屋才能进】
// 心灵之海是往人心里走，不是往地图上走。得有个能关上门、没人打扰的地方。
// 四栋安全屋正好是玩家自己挣来的私人空间——这条门槛让那四栋房子从"存档点"
// 变成了叙事上真正必要的东西，而不是可有可无的福利。

import { narratorVars } from "./mvu.js";
import { SAFE_HOUSES } from "./safeHouse.js";

export const SEA_OF_MIND = {
  district: "心灵之海",
  anchor: "浅滩",
  guide: "玄女",
  guideRoom: "后山温泉",
  guideDistrict: "雪山派",
  minAffection: 90,
  flag: "心灵之海已开",
};

// 玄女这一幕该不该触发。
// 三个条件：好感到位、已经跟她说过话（认识 = 说过话，见 commitRound 的「对话即认识」）、
// 且还没触发过。
export function shouldTriggerXuannu({ affection = 0, varTree, knownNames = [] } = {}) {
  const v = narratorVars(varTree);
  if (v.metXuannu) return false;
  if (affection < SEA_OF_MIND.minAffection) return false;
  return knownNames.includes(SEA_OF_MIND.guide);
}

// 玄女点破的那几句 + 旁白当场的反应。
// 玄女说话极少，一句是一句，不解释。旁白则是第一次在玩家面前失态——
// 她一直在等人问「你是谁」，现在有人替玩家把这件事挑明了。
export function buildXuannuScene(playerName = "你") {
  return [
    { t: "desc", text: "  白衣女子一直看着水面。你走近时她没有回头，只是把目光从水汽上移开，落到你身侧那片什么都没有的空处。" },
    { t: "desc", text: "  她看了很久。久到你也忍不住跟着扭头去看——那里什么都没有。" },
    { t: "narrator", text: "  「旁白」……你看什么。" },
    { t: "desc", text: "  「你身边的人，」玄女开口，声音很轻，「她不是这里的人。」" },
    { t: "narrator", text: "  「旁白」……" },
    { t: "desc", text: "  「她在等。」玄女说。" },
    { t: "narrator", text: "  「旁白」我没有。你别听她胡说。" },
    { t: "desc", text: "  玄女终于看向你。那双眼睛是红的，看人的时候不带评判，也不闪躲。" },
    { t: "desc", text: "  「去她心里看看。」她说，「找个没人的地方——你自己的地方。关上门，静下来，就进得去。」" },
    { t: "desc", text: "  说完她便转回去看水了，像是刚才那几句话跟她毫无干系。" },
    { t: "narrator", text: "  「旁白」……走了。这儿没什么好待的。" },
    { t: "sys", text: "  ⟡ 心灵之海已开。回到你自己的屋子里去——四栋安全屋，哪一栋都行。" },
  ];
}

// 旁白在安全屋里的催促（进过一次之后就不再念了）。
export function seaEntryHint(houseLabel) {
  return `  「旁白」……你真要进来？这儿是${houseLabel}，门关上了，也没别人。……随你吧。`;
}

// 此刻能不能进心灵之海。
// 必须：已解锁 + 人正站在某栋安全屋的那个房间里。
export function canEnterSea({ flags = [], varTree, districtName, innerRoomName } = {}) {
  const v = narratorVars(varTree);
  const unlocked = v.seaUnlocked || (flags || []).includes(SEA_OF_MIND.flag);
  if (!unlocked) return { ok: false, reason: "locked" };
  const house = SAFE_HOUSES.find(h => h.district === districtName && h.room === innerRoomName);
  if (!house) return { ok: false, reason: "notInSafeHouse" };
  return { ok: true, house };
}

// 进不去时给玩家的话。分清"还没解锁"和"地方不对"两种——
// 前者不该剧透还差什么，后者要说清去哪。
export function describeSeaGate(reason) {
  if (reason === "locked") {
    return "你感觉到某个方向有呼唤，却找不到入口。";
  }
  if (reason === "notInSafeHouse") {
    const names = SAFE_HOUSES.map(h => h.label).join("、");
    return `这里人来人往，静不下来。得回你自己的屋子——${names}，哪一栋都行。`;
  }
  return "此刻进不去。";
}
