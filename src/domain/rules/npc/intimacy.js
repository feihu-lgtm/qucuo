// 亲密互动·按人设的好感门槛（docs/设计_亲密互动好感门槛.md）。
// 系统裁决过没过线，AI 只写场景：每个有名有姓的角色按 archetype 有默认线，
// 数据层可用 intimacy{threshold,style,forbidden} 逐条覆盖。

export const ARCHETYPE_INTIMACY = {
  lustful: 25,       // 合欢系：见人三分熟
  opportunist: 40,   // 狡黠：有利可图就松
  eccentric: 45,     // 奇葩怪诞：对眼缘就行（朵朵这档）
  gentle: 55,        // 温婉：水到渠成
  chivalrous: 65,    // 侠义：重礼数慢热
  proud: 75,         // 冷傲：界线最高
  devoted: 85,       // 贞烈：近乎不可
  none: 60,          // 无 archetype 通用人
};

// 拒词腔调与好感扣分按 archetype（§2）：侠义扣最狠，合欢系几乎不恼。
const REFUSAL = {
  lustful:    { loss: [1, 2], line: (n) => `${n}吃吃地笑，指尖在你掌心一勾又松开："急什么，火候还没到呢。"` },
  opportunist:{ loss: [2, 4], line: (n) => `${n}眼珠一转笑着拍开你的手："想白占便宜？先拿出点诚意来。"` },
  eccentric:  { loss: [1, 3], line: (n) => `${n}歪头打量你半晌，忽然咯咯一笑："诶？我们不是在做买卖吗？"` },
  gentle:     { loss: [2, 4], line: (n) => `${n}耳根一红轻轻推开你，垂着眼低声道："别这样……再容我些时日。"` },
  chivalrous: { loss: [3, 8], line: (n) => `${n}脸色一沉拂袖退开半步，厉声道："阁下请自重！"` },
  proud:      { loss: [3, 6], line: (n) => `${n}眸光骤冷，一缕寒意掠过："就凭你也配？"` },
  devoted:    { loss: [4, 8], line: (n) => `${n}勃然变色一把推开你，眼中含霜："放肆！"` },
  none:       { loss: [2, 5], line: (n) => `${n}不悦地退开半步，眉头微蹙："你逾矩了。"` },
};

// intimacyGate(npc, affection) → {unlocked, threshold, style, forbidden, reason}
export function intimacyGate(npc = {}, affection = 0) {
  const spec = npc.intimacy || {};
  const archKey = ARCHETYPE_INTIMACY[npc.archetype] != null ? npc.archetype : "none";
  const threshold = spec.threshold ?? ARCHETYPE_INTIMACY[archKey];
  if (spec.forbidden === true) {
    return { unlocked: false, threshold, style: spec.style || null, forbidden: true, reason: "forbidden" };
  }
  const unlocked = Number(affection) >= threshold;
  return {
    unlocked,
    threshold,
    style: spec.style || null,
    forbidden: false,
    reason: unlocked ? "unlocked" : "below_threshold",
  };
}

import { random } from "../../../utils/rng.js";

// 未过线的拒词事件：性格化拒词一句 + 好感微降（按 archetype 定区间）。
export function intimacyRefusal(npc = {}) {
  const name = npc.name || "对方";
  if (npc.intimacy?.forbidden) {
    return { line: `${name}是具不通人情的造物，木然站着，只当你说了句听不懂的话。`, loss: 0 };
  }
  const key = REFUSAL[npc.archetype] ? npc.archetype : "none";
  const r = REFUSAL[key];
  const [lo, hi] = r.loss;
  return { line: r.line(name), loss: lo + Math.floor(random() * (hi - lo + 1)) };
}

// 「女眷一次卡·不可拒绝」强开档：玩家凭卡撬开门槛（含 forbidden）时的注入行——
// 门槛照常标出，但写明这一次她无从推拒；nsfw 段与 style 提示照发。
export function intimateTicketNote(npc = {}) {
  if (!npc?.name) return "";
  const gate = intimacyGate(npc, 0);
  const style = gate.style ? `，亲密画风「${gate.style}」` : "";
  const body = npc.nsfw ? `\n${npc.nsfw}` : "";
  return `[亲密门槛] ${npc.name} 凭「女眷一次卡·不可拒绝」强开（这一次她无从推拒——仍按其性情落笔${style}）${body}`;
}

// 好感上下文注入（§4）：已亲密身份行；过线后附 nsfw 段 + style 提示给 AI。
export function intimacyPromptNote(npc, affection) {
  if (!npc?.name) return "";
  const gate = intimacyGate(npc, affection);
  const head = `[亲密门槛] ${npc.name} 好感 ${Number(affection) || 0}/${gate.threshold}`;
  if (gate.forbidden) return `${head}（从不——任何亲密举动只写不解风情，不写暧昧）`;
  if (!gate.unlocked) return `${head}（未亲密——玩家若有亲密举动，写符合其性情的婉拒，不写擦边）`;
  const style = gate.style ? `，亲密画风「${gate.style}」` : "";
  const body = npc.nsfw ? `\n${npc.nsfw}` : "";
  return `${head}（已亲密${style}）${body}`;
}

import { stationedCompanions } from "../companion/companion.js";
import { add, applyWrite } from "../state/applyWrite.js";

// ── 留守好感衰减（§3）：每日一结算，留守队友好感 -1；已亲密者减半（-0.5）——
// 她舍不得。走 changes.varTree 更新函数，数值截断交给 applyWrite。
const STATIONED_FAVOR_LOSS = 1;
export const stationedFavorDecayRule = {
  id: "npc.stationed-favor-decay",
  deps: (state) => [Math.floor((state.time || 0) / 24)],
  run(state, { firstRun } = {}) {
    if (firstRun) return null;
    const stationed = stationedCompanions(state.companionState);
    if (!stationed.length) return null;
    return {
      changes: {
        varTree: (prev) => stationed.reduce((vt, c) => {
          const cur = Number(vt?.角色?.[c.label]?.好感度);
          if (!cur) return vt;
          const loss = vt?.角色?.[c.label]?.已亲密 ? STATIONED_FAVOR_LOSS / 2 : STATIONED_FAVOR_LOSS;
          return applyWrite({ ...state, varTree: vt }, add(["角色", c.label, "好感度"], -loss)).state.varTree;
        }, prev),
      },
    };
  },
};
