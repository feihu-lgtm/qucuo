// 任务类型编码表
// 归纳自：Fallout联合创始人Tim Cain提出的9类基础任务分类（murder/kill/fetch/
// collect/delivery/escort/talk/puzzle/timed），加上上古卷轴5实际任务案例
// 补充的行业常见变体（defend/conquest/dungeon/join_faction等）。
//
// 每个任务实例（quest instance）应该声明自己是哪个编码，方便系统统一判断
// 完成条件的类型（比如KILL类任务的完成条件天然是"击杀数量"，FETCH类天然是
// "背包里有没有这件物品"），不需要每个任务都手写一套独立的完成判定逻辑。

export const QUEST_TYPE = {
  MURDER: "QT_MURDER",             // 刺杀：击杀一个特定具名目标
  KILL: "QT_KILL",                 // 清剿：消灭一定数量的泛用敌人
  FETCH: "QT_FETCH",               // 拿取：取回一件指定物品并交还
  COLLECT: "QT_COLLECT",           // 收集：采集一定数量的同类资源
  DELIVERY: "QT_DELIVERY",         // 传信/递物：把物品从A送到B
  ESCORT: "QT_ESCORT",             // 护送：陪同NPC安全抵达目的地
  RESCUE: "QT_RESCUE",             // 营救：突破据点把人救出来
  TALK: "QT_TALK",                 // 说服/传话：对话达成社交结果
  PUZZLE: "QT_PUZZLE",             // 解谜：需要线索/机关而非战斗
  TIMED: "QT_TIMED",               // 限时：规定时限内完成
  DEFEND: "QT_DEFEND",             // 防守：据守抵挡来犯
  CONQUEST: "QT_CONQUEST",         // 攻占：夺取并控制一个据点
  DUNGEON: "QT_DUNGEON",           // 地牢探索：多层秘境逐步清理
  JOIN_FACTION: "QT_JOIN_FACTION", // 加入势力：试炼/宣誓解锁任务链
  LEARN_SKILL: "QT_LEARN_SKILL",   // 拜师学艺：习得NPC的技能
  BOSS_LOOT: "QT_BOSS_LOOT",       // 击杀掉落：击败首领获取独有掉落
  UNLOCK_MAP: "QT_UNLOCK_MAP",     // 解锁地图：解锁新可探索区域
  ARTIFACT: "QT_ARTIFACT",         // 神器寻访：多阶段连锁获得传说道具
  MYSTERY: "QT_MYSTERY",           // 谜团调查：逐步揭开隐藏事件真相
  ROMANCE: "QT_ROMANCE",           // 情感纠葛：介入NPC感情线
  BOUNTY: "QT_BOUNTY",             // 悬赏：随机刷新的通缉/清剿目标
  CHAIN: "QT_CHAIN",               // 连锁委托：完成后自动解锁下一个
};

export const QUEST_TYPE_LABEL = {
  [QUEST_TYPE.MURDER]: "刺杀",
  [QUEST_TYPE.KILL]: "清剿",
  [QUEST_TYPE.FETCH]: "拿取",
  [QUEST_TYPE.COLLECT]: "收集",
  [QUEST_TYPE.DELIVERY]: "传信",
  [QUEST_TYPE.ESCORT]: "护送",
  [QUEST_TYPE.RESCUE]: "营救",
  [QUEST_TYPE.TALK]: "说服",
  [QUEST_TYPE.PUZZLE]: "解谜",
  [QUEST_TYPE.TIMED]: "限时",
  [QUEST_TYPE.DEFEND]: "防守",
  [QUEST_TYPE.CONQUEST]: "攻占",
  [QUEST_TYPE.DUNGEON]: "探秘",
  [QUEST_TYPE.JOIN_FACTION]: "入门",
  [QUEST_TYPE.LEARN_SKILL]: "拜师",
  [QUEST_TYPE.BOSS_LOOT]: "夺宝",
  [QUEST_TYPE.UNLOCK_MAP]: "开图",
  [QUEST_TYPE.ARTIFACT]: "寻宝",
  [QUEST_TYPE.MYSTERY]: "查案",
  [QUEST_TYPE.ROMANCE]: "情缘",
  [QUEST_TYPE.BOUNTY]: "悬赏",
  [QUEST_TYPE.CHAIN]: "委托",
};

// 每种类型天然对应的完成条件字段——这不是强制约束，只是给任务作者一个默认参照，
// 具体任务的 completionCheck 函数可以自己写更复杂的逻辑。
export const QUEST_TYPE_DEFAULT_FIELDS = {
  [QUEST_TYPE.MURDER]: ["targetNpcId"],
  [QUEST_TYPE.KILL]: ["targetTag", "requiredCount"],
  [QUEST_TYPE.FETCH]: ["itemId", "returnToNpcId"],
  [QUEST_TYPE.COLLECT]: ["itemId", "requiredCount"],
  [QUEST_TYPE.DELIVERY]: ["itemId", "fromNpcId", "toNpcId"],
  [QUEST_TYPE.ESCORT]: ["npcId", "destinationRoomId"],
  [QUEST_TYPE.RESCUE]: ["npcId", "fromRoomId"],
  [QUEST_TYPE.TALK]: ["npcId", "topicFlag"],
  [QUEST_TYPE.PUZZLE]: ["puzzleFlag"],
  [QUEST_TYPE.TIMED]: ["deadlineTurn"],
  [QUEST_TYPE.DEFEND]: ["roomId", "waveCount"],
  [QUEST_TYPE.CONQUEST]: ["roomId"],
  [QUEST_TYPE.DUNGEON]: ["dungeonRoomIds"],
  [QUEST_TYPE.JOIN_FACTION]: ["factionId"],
  [QUEST_TYPE.LEARN_SKILL]: ["npcId", "skillId", "minFavorability"],
  [QUEST_TYPE.BOSS_LOOT]: ["bossNpcId", "itemId"],
  [QUEST_TYPE.UNLOCK_MAP]: ["roomId"],
  [QUEST_TYPE.ARTIFACT]: ["stageFlags"],
  [QUEST_TYPE.MYSTERY]: ["clueFlags"],
  [QUEST_TYPE.ROMANCE]: ["npcId", "choiceFlag"],
  [QUEST_TYPE.BOUNTY]: ["targetTag"],
  [QUEST_TYPE.CHAIN]: ["nextQuestId"],
};
