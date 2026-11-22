// NPC 动作汇总壳——对外 API 不变。
// ---------------------------------------------------------------------------
// 原 logic.js 是个杂物间：搭话、送礼、偷窃、拜师全挤在一个文件里。现按动作
// 分组成三个文件，本文件只做 re-export，调用方 import 路径不变：
//   social.js   认出 / 端详 / 搭话
//   exchange.js 赠礼 / 送银 / 交易
//   learn.js    偷窃 / 拜师
export { settleNpcDuel } from "./settleDuel.js";
export * from "./social.js";
export * from "./exchange.js";
export * from "./learn.js";
