// ── 信息领域·memory 登记为可传播事实（原 commitRound 内嵌块）──
// 路线甲纯函数化：返回 { changes, refWrites } 由 commitRound 统一落盘。
import { registerFact } from "../../../domain/rules/prompt/knowledge.js";
import { isNpcVisibleInInnerRoom } from "../../../domain/rules/map/innerMap.js";

// 单调用 JSON 可能把 memory 吐成数组/对象——所有消费口（writeMemoryNote/
// appendDayMaterial/registerMemoryFact）共用这一归一，否则数组逐字哈希/拼接
// 流程会在叙事上屏后抛错，整轮回滚。commitRound 在进 postCommit 链前统一调用。
export function normalizeMemoryText(memory) {
  if (!memory) return memory;
  if (typeof memory === "string") return memory;
  if (Array.isArray(memory)) return memory.filter(Boolean).join("；");
  if (typeof memory === "object") {
    // 对象形态：优先取常见文本字段，否则 JSON 序列化——裸 String() 只会得到
    // "[object Object]"，事实摘要全丢且不同内容哈希相同互相撞键。
    // 逐字段取第一个非空白字符串——空白/非字符串的 text 不能掩盖后面的有效 summary
    for (const key of ["text", "摘要", "summary", "content"]) {
      const v = memory[key];
      if (typeof v === "string" && v.trim()) return v;
    }
    try { return JSON.stringify(memory); } catch { return String(memory); }
  }
  return String(memory);
}

export function registerMemoryFact({ p, room, activeTarget, isTalk, talkTarget, time, appendDayMaterial, innerRoomName = null, refIds = [], postRouteRoom = null, postRouteInnerRoom = null, emergedNpcName = "" }) {
  if (!p.memory) return null;
  if (typeof p.memory !== "string") {
    p = { ...p, memory: normalizeMemoryText(p.memory) };
    if (!p.memory) return null;
  }
  let factRoom = p.room && Array.isArray(p.room.npcs) ? p.room : room;
  // 移动+翻箱/密行复合指令：玩家实际在目的地房间里行动——路由后实况是 ground truth，
  // 优先于模型回显的 p.room：目击者池=目的地在场者，房间作用域=目的地。
  if (postRouteRoom) {
    factRoom = postRouteRoom;
    innerRoomName = postRouteInnerRoom ?? null;
  }
  const districtName = factRoom?.name || "";
  const allNpcs = factRoom?.npcs || [];
  // V4 核心根因修：目击者池不再取整座据点 room.npcs（22-28 人全员知情），
  // 改用 isNpcVisibleInInnerRoom（与 partitionPeople.present 同源口径）收窄到
  // 本房真实在场者——在老孙饭馆翻酒坛，目击者绝无隔壁房间的人。
  const roomNpcs = innerRoomName
    ? allNpcs.filter(n => isNpcVisibleInInnerRoom(districtName, innerRoomName, n))
    : [...allNpcs];
  // Review 修：本轮刚涌现登场的新人不在回合前的 room.npcs 里——他既已登场便是
  // 现场目击者，补进在场池（人就是在这房登场的，不再过可见性过滤）。否则空房登场
  // 唯一见证者时 witnesses 为空，事实整条丢失。
  if (emergedNpcName && !roomNpcs.some((n) => n?.name === emergedNpcName)) {
    roomNpcs.push({ name: emergedNpcName });
  }
  // F9+V4 知情隔离修：未点选但本房真实在场仅一名非随行 NPC 时，私语/密行对象
  // 就是这位唯一在场者——V4 起不再要求 isTalk（翻箱、偷盗等非搭话密行同理），
  // 否则「压低声音只对老孙说」的密告按全员目击者记账，秘密当场漏给所有知情人，
  // 换房间后不知情者也能接茬（真机 T22 穿透实证）。
  // 随行同伴不计入「唯一在场者」判定——他们恒随玩家，不构成密告对象。
  const nonCompanion = roomNpcs.filter(n => !n.companion);
  const soleWitness = !activeTarget && !talkTarget && nonCompanion.length === 1 ? nonCompanion[0]?.name : "";
  const directTarget = activeTarget || (isTalk && talkTarget);
  const witnessTarget = directTarget || soleWitness;
  // 途径区分：玩家明确交互的对象算「亲历」；soleWitness 在搭话回合就是私语对象
  // 同样「亲历」；非搭话密行（翻箱偷盗）时他只是唯一在场看到行为的人——记「目击」。
  // V8 Review 修：判官事实自带 witnesses 收窄名单时（闺房密事/密行只主角+对象），
  // 以事实级名单为准——屋里再多人也不得算目击。「主角」是玩家本人不入 NPC 知情账。
  const factNames = Array.isArray(p.memoryFactWitnesses)
    ? p.memoryFactWitnesses.filter((nm) => typeof nm === "string" && nm && nm !== "主角")
    : [];
  const witnesses = factNames.length
    ? factNames.map((nm) => ({ name: nm, 途径: "亲历" }))
    : witnessTarget
      ? [{ name: witnessTarget, 途径: (directTarget || isTalk) ? "亲历" : "目击" }]
      : roomNpcs.map(n => ({ name: n.name, 途径: "目击" }));
  // 同一回合对同一对象可能有多条记忆（连聊两次时间不前进时 time 相同），
  // id 只按 time+对象 命名会让 registerFact 静默丢弃后一条——把摘要文本
  // 哈希进 id，内容不同即不同键；内容完全相同的重复条目被去重是正确的。
  let hash = 0;
  for (let i = 0; i < p.memory.length; i += 1) hash = (hash * 31 + p.memory.charCodeAt(i)) >>> 0;
  return {
    // 主叙事/对话的事实也进当日原料（日总结用）——经 io 注入回调推送，不出 app 层
    effects: appendDayMaterial ? [() => appendDayMaterial({ turn: time, text: p.memory })] : undefined,
    changes: witnesses.length ? {
      // V4 密告入账：玩家援引场记板条目（refIds）向特定对象透露情报时，
      // 标签落「密告」并带房间作用域——跨房组装上下文时据此对非目击者硬隔离。
      varTree: (prev) => registerFact(prev, {
        id: `turn_${time}_${witnesses[0].name}_${hash.toString(36)}`,
        摘要: p.memory,
        标签: witnessTarget && Array.isArray(refIds) && refIds.length ? "密告" : isTalk ? "私语" : "见闻",
        ...(districtName ? { 房间: { district: districtName, inner: innerRoomName ?? null } } : {}),
        知晓者: witnesses,
      }, time),
    } : undefined,
  };
}
