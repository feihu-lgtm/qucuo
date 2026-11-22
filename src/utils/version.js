// 版本历史：每次迭代给一个代号 + 时间戳，方便区分不同版本的构建
// 数据本体在 version-history.json（485KB 纯数据，不当代码）；这里只做加载和导出。
//
// 加载策略：
// - CURRENT_VERSION 走 version-current.json（只有最新一条的 codename/time），静态打进主包，
//   供 TopBar/StartScreen/存档头等处直接引用；
// - 完整 VERSION_HISTORY 走 loadVersionHistory() 动态 import，点开版本历史弹窗时才下载，
//   485KB 不进首屏主包。
// 发新版本时：新条目加在 version-history.json 数组最前面，同时把它的 codename/time 抄进
// version-current.json（docsTree.test.js 有两者一致性断言，漏抄测试会挂）。
//
// time 字段一律为东八区（UTC+8）时间，手写字符串，组件不做任何时区换算。
//
// notes 写法：可以是一个字符串，也可以是字符串数组。数组的每一项渲染成
// 独立一行，版本历史弹窗里会逐条列出——长条目请写成数组，别再堆成一整行
// 两千字的字符串（那样弹窗里是一堵墙，编辑器里也没法读 diff）。
// 惯例：第一项写一句话说清这版干了什么，后面用 ①②③ 分条，一条一件事。
import CURRENT_VERSION from "./version-current.json" with { type: "json" };

export { CURRENT_VERSION };

// 完整版本历史：点开版本历史弹窗时再加载，避免 485KB JSON 静态打进主包。
export async function loadVersionHistory() {
  const mod = await import("./version-history.json");
  return mod.default;
}
