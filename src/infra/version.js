// 版本历史：每次迭代给一个代号 + 时间戳，方便区分不同版本的构建
// 数据本体在 version-history.json（纯数据不当代码）；这里只做加载和导出。
// 新版本加在数组最前面，CURRENT 始终指向最新一条。
// time 字段一律为东八区（UTC+8）时间，手写字符串，组件不做任何时区换算。
//
// notes 写法：可以是一个字符串，也可以是字符串数组。数组的每一项渲染成
// 独立一行，版本历史弹窗里会逐条列出——长条目请写成数组，别再堆成一整行
// 两千字的字符串（那样弹窗里是一堵墙，编辑器里也没法读 diff）。
// 惯例：第一项写一句话说清这版干了什么，后面用 ①②③ 分条，一条一件事。
import VERSION_HISTORY from "./version-history.json" with { type: "json" };

export { VERSION_HISTORY };
export const CURRENT_VERSION = VERSION_HISTORY[0];
