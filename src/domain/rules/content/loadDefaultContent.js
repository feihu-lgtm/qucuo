// 内容包装载入口：content 层只出纯数据包（DEFAULT_CONTENT_PACKS），
// 注册动作收在 domain 侧，保证 content 不反向依赖 domain/rules（分层守卫）。
// 保持原 content/index.js 的语义：模块加载即注册一次（幂等），数据文件靠
// 副作用 import 拿到装配好的内容注册表。

import { loadContent } from "./registry.js";
import { DEFAULT_CONTENT_PACKS } from "../../../content/index.js";

let loaded = false;
export function loadDefaultContent() {
  if (loaded) return;
  DEFAULT_CONTENT_PACKS.forEach(loadContent);
  loaded = true;
}

loadDefaultContent();
