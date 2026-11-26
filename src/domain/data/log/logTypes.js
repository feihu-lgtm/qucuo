// 日志条目类型（entry.t）的唯一清单。
//
// 叙事日志靠 t 决定一条日志怎么显示：NarrativeLogFeed 把 room 单列成标题，
// LogEntry 给 desc 缩进和对话高亮，颜色表按 t 取色。t 写错了不会报错，
// 只会悄悄退化成别的样子——e8f6f57 把 "room" 写成 "d.room"、角色卡开场写成 "narr"，
// 都是这样漏到玩家眼前的。所以清单在这里（纯数据，界面、app、features、规则层都会读，放在 domain/data），src/tests/logTypes.test.js 扫全部源码，
// 出现清单外的 t 就失败。新增类型：加在这里，并在 useGameUi.js 的日夜两套颜色表里各配一个颜色。

export const LOG_T = Object.freeze({
  SYS: "sys",            // 系统提示（绿）
  CMD: "cmd",            // 玩家指令行
  DESC: "desc",          // 叙事正文：缩进 2em，「」对话高亮
  ROOM: "room",          // 地名标题，单列居中「— 地名 —」
  ITEM: "item",          // 得物、买卖
  STAT: "stat",          // 数值变化
  SKILL: "skill",        // 武学
  ERR: "err",            // 错误
  CHOICE: "choice",      // 可点选项
  NARRATOR: "narrator",  // 旁白这个角色说的话（粉）
  CRASH: "crash",        // 崩溃提示
  CONFESS: "confess",    // 告白
  AFFECTION: "affection",// 好感变化
  QUEST: "quest",        // 任务
  LOOT: "loot",          // 得物卡，整条换成卡片渲染，不取颜色
});
