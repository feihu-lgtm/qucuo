// ── WO-22B-P4a 契约来信视图组装（纯函数，无 AI）────────────────────────────
// 把 pactMeta + 契约账 + NPC 品阶/性情映射成「这封信是为一桩约定而写」块所需的
// 全部展示字段。事由目前只有「逾期催问」一条产线（P1 值守扫描器），
// 「立诺留凭/如约致谢」结构预留——reason 直通，新增产线时只需在压信处带 reason。
import { getNpcFaction } from "../../domain/data/factions/npcFactions.js";

export const PACT_REASONS = Object.freeze(["立诺留凭", "如约致谢", "逾期催问"]);

export function isFierceNpc(npc) {
  return /刚烈|烈性|火暴|暴躁|性烈/.test(`${npc?.personality || ""}${npc?.brief || ""}`);
}

// 品阶口吻梯：levelCap 即品阶，0-5 对应白绿蓝紫橙红（npcStats.getTierPower：
// 白5 绿23 蓝41 紫59 橙77 红95）——紫袍=3、橙红袍>=4，其余按底层弟子论。
export function severityGuideOf(npc) {
  const tier = Number.isFinite(npc?.levelCap) ? npc.levelCap : 0;
  let guide = tier >= 4 ? "可以宣告断交或追究"
    : tier >= 3 ? "冷峻，给出最后期限"
    : "以试探为主，话留三分";
  if (isFierceNpc(npc)) guide += "；此人刚烈，话说得直，后果写明";
  return guide;
}

// 口吻取材：底稿 2.3.2 的五大势力取材清单在现有资料里不存在——不编设定，
// 最小实现只确定性地带出势力身份本身，让模型按势力名自拟分寸；散人/未知给空串。
export function factionToneHintOf(npc) {
  const faction = getNpcFaction(npc) || (typeof npc?.faction === "string" && npc.faction !== "散人" ? npc.faction : null);
  return faction ? `写信人出自「${faction}」，措辞带该势力的身份与分寸` : "";
}

// 期限文案：立诺时「限 N 个时辰为期」，逾期时「已逾 N 个时辰」。
// 1 时辰 = 2 小时 = 2 格；逾期时长按契约账 bindTurn+deadlineHours 与当前时间差推。
function deadlineTextOf(reason, meta, pactRecord, now) {
  const shichen = Number.isFinite(meta?.deadlineHours) ? Math.max(1, Math.round(meta.deadlineHours / 2)) : null;
  if (reason === "逾期催问") {
    if (Number.isFinite(pactRecord?.bindTurn) && Number.isFinite(meta?.deadlineHours) && Number.isFinite(now)) {
      const overdue = Math.max(1, Math.round((now - pactRecord.bindTurn - meta.deadlineHours) / 2));
      return `已逾 ${overdue} 个时辰`;
    }
    return "期限已过";
  }
  if (shichen != null) return `限 ${shichen} 个时辰为期`;
  return "未明期限";
}

// 一站组装：缺 pactMeta 返回 null（非契约信），缺字段安全降级不炸。
export function pactLetterView(state, letter, npc) {
  const meta = letter?.pactMeta;
  if (!meta || typeof meta !== "object") return null;
  const reason = PACT_REASONS.includes(meta.reason) ? meta.reason : "逾期催问";
  const pactRecord = state?.varTree?.世界?.契约?.[meta.npcName || letter.npcName]?.[meta.pactKey] || null;
  const now = Number.isFinite(state?.time) ? state.time : null;
  return {
    reasonLabel: reason,
    // 裁决：只有契约账真记了立约地才写地点——老档无 place 时给空串，
    // prompt 层用中性「说定」，绝不 fallback 玩家当前房间（人会走动，房会错）。
    place: pactRecord?.place || "",
    promise: String(meta.promise || "").trim() || "（原话未录）",
    deadlineText: deadlineTextOf(reason, meta, pactRecord, now),
    rewardText: String(meta.rewardHint || "").trim() || "当时未明说",
    npcName: letter.npcName || "",
    factionName: getNpcFaction(npc) || (typeof npc?.faction === "string" ? npc.faction : "") || "",
    factionToneHint: factionToneHintOf(npc),
    severityGuide: severityGuideOf(npc),
  };
}
