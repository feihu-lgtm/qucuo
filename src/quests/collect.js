// ============================================================================
// 采集系统 —— 声明式 collect 字段 + 纯函数裁决
// ----------------------------------------------------------------------------
// 用户拍板的铁律：「地上得真有那个东西能捡，不能凭空。」
// 因此采集不是"AI 叙事说你采到了就算"，而是：
//   ① 系统在玩家进入 at 据点时，把 item 真的放进 room.items（地上真实存在）；
//   ② 玩家表达采集意图（采/挖/捡/取…）且指向该物时，由【系统】把物搬进背包、
//      从地上抹去，再判断该 stage 声明的所有 collect 是否都已到手——齐了才推进；
//   ③ 全程系统裁决"采没采到"与"推没推进"，AI 只负责把这次采集叙述得好看。
// 这与项目总纲「AI 提议内容，系统裁定数字/拓扑」一脉相承。
//
// stage 上的 collect 字段两种写法：
//   collect: { item: "燕羊胎", at: "大草甸", quality: "绿" }            // 单件
//   collect: [                                                          // 多件（全采齐才推进）
//     { item: "野山羊筋", at: "大草甸" },
//     { item: "铜箍圈",   at: "天都镇", hint: "向孟记铁铺讨要" },
//     { item: "桐油",     at: "鱼定村", hint: "找杂货商赵掌柜" },
//   ]
// 可选字段：
//   quality —— 采到物的品质（默认「白」）；hint —— 给 AI 的取物方式提示（进 prompt）。
// ============================================================================

// 把 collect 归一成数组，空则返回 []
export function normalizeCollect(collect) {
  if (!collect) return [];
  return Array.isArray(collect) ? collect : [collect];
}

// 背包里是否已有某物。容忍三种情况：
//   · 结构化对象 {name} 与纯字符串混存
//   · "修好的马鞭" ⊇ "马鞭" 这类前后缀包裹（与送物判定同一套宽松匹配）
export function invHasItem(inv, itemName) {
  if (!itemName) return false;
  return (inv || []).some((i) => {
    const n = typeof i === "string" ? i : i && i.name;
    if (!n) return false;
    return n === itemName || n.includes(itemName) || itemName.includes(n);
  });
}

// 地上（room.items）里是否已有某物
function groundHasItem(roomItems, itemName) {
  return (roomItems || []).some((i) => {
    const n = typeof i === "string" ? i : i && i.name;
    return n === itemName;
  });
}

// 该 stage 声明的所有采集目标，是否都已进背包
export function allCollected(stage, inv) {
  const entries = normalizeCollect(stage && stage.collect);
  if (!entries.length) return false;
  return entries.every((c) => invHasItem(inv, c.item));
}

// 取 stage 的首个 completionFlag（数组则取第一个）
export function firstFlag(stage) {
  const f = stage && stage.completionFlag;
  return Array.isArray(f) ? f[0] : f;
}

// 计算此刻应该注入到某据点地上的采集物：
//   遍历所有 active 任务的当前 stage，其 collect 里 at 命中本据点、
//   且背包尚无、地上尚无 的那些条目 → 生成 room.items 元素。
// 返回 [{ name, id }]。id 带任务/物名前缀，便于识别是系统注入的采集物。
export function pendingGroundItems(roomName, ctx) {
  const { questProgress, quests, getCurrentStage, inv, roomItems } = ctx;
  const out = [];
  const seen = new Set(); // 同一据点多任务共用一件物，只注入一次
  for (const quest of quests) {
    const prog = questProgress[quest.id];
    if (!prog || prog.status !== "active") continue;
    const stage = getCurrentStage(quest, prog);
    for (const c of normalizeCollect(stage && stage.collect)) {
      if (c.at !== roomName) continue;
      if (invHasItem(inv, c.item)) continue; // 已采过：不再刷新到地上
      if (groundHasItem(roomItems, c.item)) continue; // 地上已有：别重复
      if (seen.has(c.item)) continue;
      seen.add(c.item);
      out.push({ name: c.item, id: `collect_${c.item}` });
    }
  }
  return out;
}

// 检测玩家这句话是否是在采一件"此刻地上真有、且属于当前采集任务"的物。
// 命中返回 { quest, stage, item }，否则 null。
// 规则：
//   · 必须含采集类动词；
//   · 该物必须此刻真在 room.items 里（系统已注入）——呼应「不凭空」；
//   · 点名匹配（提到物名）即命中；若地上只有这一件本任务采集物，动词明确亦放行。
const PICK_VERB = /(采|摘|挖|掘|捡|拾|取|收|割|掐|拔|收集|拿|割取|挖取|摘取)/;

export function detectCollectPickup(cmd, roomName, roomItems, ctx) {
  const s = (cmd || "").trim();
  if (!s || !PICK_VERB.test(s)) return null;
  const { questProgress, quests, getCurrentStage, inv } = ctx;

  const candidates = []; // 本据点、地上真有、未采过的采集条目
  for (const quest of quests) {
    const prog = questProgress[quest.id];
    if (!prog || prog.status !== "active") continue;
    const stage = getCurrentStage(quest, prog);
    for (const c of normalizeCollect(stage && stage.collect)) {
      if (c.at !== roomName) continue;
      if (invHasItem(inv, c.item)) continue;
      if (!groundHasItem(roomItems, c.item)) continue;
      candidates.push({ quest, stage, item: c.item });
    }
  }
  if (!candidates.length) return null;

  // 优先：玩家点名了某件物
  const named = candidates.find((c) => s.includes(c.item) || s.includes(shortName(c.item)));
  if (named) return named;

  // 兜底：地上只有一件本任务采集物时，明确的采集动词即认定采它
  if (candidates.length === 1) return candidates[0];

  return null; // 多件且未点名：让 AI 追问采哪件，不擅自替玩家决定
}

// 物名简称：取后两字（"熊山雪莲"→"雪莲"），提高口语点名的命中率
function shortName(name) {
  if (!name || name.length <= 2) return name || "";
  return name.slice(-2);
}

// 找出当前所有 active 且"所需物已全在背包"的采集 stage —— 用于共用采集节点的
// "跳过跑腿"：比如燕羊胎已在兰姐线采过，欢喜教线同一节点应直接算完成。
// 返回 [{ quest, stage, flag }]。
export function alreadySatisfiedCollectStages(ctx) {
  const { questProgress, quests, getCurrentStage, inv } = ctx;
  const out = [];
  for (const quest of quests) {
    const prog = questProgress[quest.id];
    if (!prog || prog.status !== "active") continue;
    const stage = getCurrentStage(quest, prog);
    if (!stage || !stage.collect) continue;
    if (allCollected(stage, inv)) {
      out.push({ quest, stage, flag: firstFlag(stage) });
    }
  }
  return out;
}

// 给 prompt 用：当前据点有哪些采集物在地上等着采（附取物提示），供 AI 叙述参考。
export function collectPromptLines(roomName, ctx) {
  const { questProgress, quests, getCurrentStage, inv } = ctx;
  const lines = [];
  for (const quest of quests) {
    const prog = questProgress[quest.id];
    if (!prog || prog.status !== "active") continue;
    const stage = getCurrentStage(quest, prog);
    for (const c of normalizeCollect(stage && stage.collect)) {
      if (c.at !== roomName) continue;
      if (invHasItem(inv, c.item)) continue;
      const way = c.hint ? `（${c.hint}）` : "";
      lines.push(`此处可采集《${quest.title}》所需的「${c.item}」${way}`);
    }
  }
  return lines;
}
