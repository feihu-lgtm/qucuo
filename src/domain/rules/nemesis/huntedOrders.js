// ── WO-23C6 追杀令后果纯函数层（只读消费追杀令账，无 AI）────────────────────
// 追杀令账（WO-23C4 落账）：varTree.世界.追杀令 = [{faction, entryId, name, turn, note}]
// 本层只做 deterministic 查询：谁是随行叛徒、哪个 NPC 该冷脸、入地盘该不该提点。
import { unlockedCompanions } from "../companion/companion.js";
import { nemesisFactionOf } from "./nemesisEngine.js";
import { factionOfDistrict } from "../economy/factionRep.js";

export function huntedOrdersOf(varTree) {
  const list = varTree?.世界?.追杀令;
  if (!Array.isArray(list)) return [];
  return list.filter((o) => o && typeof o === "object" && o.faction && o.name);
}

// 随行（未留守）的已解锁同伴里，哪些是被通缉的叛徒。
// 返回 [{order, companionName}]——companion 按名字唯一惯例匹配追杀令。
export function followingTraitors(companionState, varTree) {
  const orders = huntedOrdersOf(varTree);
  if (!orders.length) return [];
  const out = [];
  for (const meta of unlockedCompanions(companionState || {})) {
    const slot = companionState?.[meta.key];
    if (!slot || slot.stationed) continue; // 留守在外的不算「带在身边出现」
    const name = slot.data?.name || meta.label;
    const order = orders.find((o) => o.name === name);
    if (order) out.push({ order, companionName: name });
  }
  return out;
}

// 交易/打交道冷遇判定：npc 所属势力正在追杀玩家随行的叛徒 → 返回对应 order，否则 null。
export function huntedConflictWithNpc(state, npc) {
  if (!npc?.name) return null;
  const faction = nemesisFactionOf(npc);
  if (!faction) return null;
  return followingTraitors(state.companionState, state.varTree)
    .find((t) => t.order.faction === faction) || null;
}

// 入地盘提点判定：当前房间所属势力追杀随行叛徒且该令尚未提点过 → 返回 order 列表。
export function pendingHuntedNotices(state) {
  const faction = factionOfDistrict(state.room?.name);
  if (!faction) return [];
  return followingTraitors(state.companionState, state.varTree)
    .filter((t) => t.order.faction === faction && !t.order.noticedTurn)
    .map((t) => t.order);
}

// 世界规则：带叛徒踏入原势力地盘，给一次 deterministic 提点（sys 日志+账上 noticedTurn），
// 不重复刷屏——noticedTurn 已记者不再出。firstRun 不补历史账。
export const huntedNoticeRule = {
  id: "nemesis.huntedNotice",
  deps: (state) => [state.room?.name, state.companionState, state.varTree?.世界?.追杀令],
  run(state, { firstRun } = {}) {
    if (firstRun) return null;
    const pending = pendingHuntedNotices(state);
    if (!pending.length) return null;
    const turn = state.time || 0;
    return {
      changes: {
        varTree: (prev) => {
          const orders = (prev?.世界?.追杀令 || []).map((o) => (
            o && pending.some((p) => p.entryId === o.entryId) ? { ...o, noticedTurn: turn } : o
          ));
          return { ...(prev || {}), 世界: { ...(prev?.世界 || {}), 追杀令: orders } };
        },
      },
      logs: pending.map((o) => ({
        t: "sys",
        text: `  茶寮里有人压低声音：${o.faction}的追杀令贴满了墙——${o.name}还敢露头，连带护着他的人也被盯上了。`,
      })),
    };
  },
};
