// 建筑动作汇总壳——对外 API 不变。
// ---------------------------------------------------------------------------
// 原 logic.js 是个杂物间：住店、坐车、押注、读书、下厨全挤在一个文件里。现
// 按动作分组成六个文件，本文件只做 re-export，调用方 import 路径不变：
//   lodging.js    住店 / 疗伤
//   transport.js  马车定价 / 出行
//   study.js      读书 / 买书 / 听传闻
//   gambling.js   赌坊押注
//   skills.js     武馆购秘籍
//   venue.js      点单 / 下厨 / 祈祷
// （helpers.js 是目录内部共享小工具，不经本壳导出。）
export * from "./lodging.js";
export * from "./transport.js";
export * from "./study.js";
export * from "./gambling.js";
export * from "./skills.js";
export * from "./venue.js";
