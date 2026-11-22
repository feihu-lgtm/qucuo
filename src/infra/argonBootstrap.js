// 托管部署免配置引导（argon-config.json）
// ─────────────────────────────────────────────────────────────
// 托管站点（如 argonmeow.online/qucuo/）在部署时往构建产物根目录放一份
// argon-config.json（部署脚本写、不进仓库），形如：
//   {"provider":"custom","apiType":"openai",
//    "endpoint":"https://argonmeow.online/v1/chat/completions",
//    "apiKey":"sk-xxx","model":"gemini-3.8-flash"}
// 启动时如果玩家还没自己存过 api 配置（wuxia_mud_api_config 不存在），
// 就把这份托管配置经 defaultConfig 合并 + migrateProvider 后写入配置键，
// 玩家打开就能玩、不用填 API key。
//
// 边界（全部是"静默跳过"，绝不阻塞启动）：
//   · 文件 404 / 网络错 / JSON 坏 / 缺 apiKey 或 endpoint → 什么都不写；
//   · localStorage 已有玩家配置 → 绝不覆盖（托管值只当出厂默认，玩家改过就是玩家的）。
import { defaultConfig, saveConfig } from "./apiConfig.js";

const CONFIG_KEY = "wuxia_mud_api_config";

export async function bootstrapArgonConfig() {
  try {
    // 已有玩家配置 → 直接放行，托管配置不覆盖玩家自己的选择。
    if (localStorage.getItem(CONFIG_KEY)) return;
  } catch {
    return;
  }
  let cfg;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}argon-config.json`, { cache: "no-store" });
    if (!res || !res.ok) return;                                  // 404 / 服务器错：静默
    cfg = await res.json();
  } catch {
    return;                                                       // 网络错 / JSON 坏：静默
  }
  if (!cfg || typeof cfg !== "object") return;
  if (!String(cfg.apiKey || "").trim() || !String(cfg.endpoint || "").trim()) return;
  // defaultConfig 兜底全字段（托管 json 只列它想覆盖的几项），
  // saveConfig 内部再跑一遍 migrateProvider 规整供应商字段。
  saveConfig({ ...defaultConfig(), ...cfg });
}
