// 托管部署免配置引导（argon-config.json）
// ─────────────────────────────────────────────────────────────
// 托管站点（如 argonmeow.online/qucuo/）在部署时往构建产物根目录放一份
// argon-config.json（部署脚本写、不进仓库），形如：
//   {"provider":"custom","apiType":"openai",
//    "endpoint":"https://argonmeow.online/api/qucuo/v1/chat/completions",
//    "model":"gemini-3.8-flash"}
// 启动时如果玩家还没自己存过 api 配置（wuxia_mud_api_config 不存在），
// 就把这份托管配置经 defaultConfig 合并 + migrateProvider 后写入配置键，
// 玩家打开就是配好端点和模型的状态，不用从零填。
//
// apiKey 的运行时来源：主站登录态存的口令 meow_key——bootstrap 时读到
// 就填进 apiKey，没有就留空。json 里不写 apiKey：endpoint 是服务器上的
// 口令鉴权代理，没口令会 401（预期行为，走现有"缺凭据"提示即可）；
// 玩家后续在设置页填口令或换 provider 都行。
//
// 边界（全部是"静默跳过"，绝不阻塞启动）：
//   · 文件 404 / 网络错 / JSON 坏 / 缺 endpoint 或 model → 什么都不写；
//   · localStorage 已有玩家配置 → 绝不覆盖（托管值只当出厂默认，玩家改过就是玩家的）。
import { defaultConfig, migrateProvider, saveConfig } from "./apiConfig.js";

const CONFIG_KEY = "wuxia_mud_api_config";

export async function bootstrapArgonConfig() {
  try {
    // 已有玩家配置 → 直接放行，托管配置不覆盖玩家自己的选择。
    if (localStorage.getItem(CONFIG_KEY)) return;
  } catch {
    return;
  }
  let cfg;
  // 请求挂起不能卡住启动：3.5s 还没回来就放弃，本次静默跳过。
  const ctrl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 3500) : null;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}argon-config.json`, {
      cache: "no-store",
      signal: ctrl?.signal,
    });
    if (!res || !res.ok) return;                                  // 404 / 服务器错：静默
    cfg = await res.json();
  } catch {
    return;                                                       // 网络错 / JSON 坏 / 超时：静默
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!cfg || typeof cfg !== "object") return;
  // endpoint 和 model 是托管给的硬条件，缺了这份 json 就不算"配好了"；
  // apiKey 允许空——口令代理没口令会 401，玩家再去设置页填。
  if (!String(cfg.endpoint || "").trim() || !String(cfg.model || "").trim()) return;
  // 口令运行时从主站登录态取的 meow_key；json 里没有 apiKey 字段。
  let meowKey = "";
  try { meowKey = localStorage.getItem("meow_key") || ""; } catch { /* ignore */ }
  const merged = { ...cfg, apiKey: cfg.apiKey || meowKey };
  // 先 migrateProvider 托管 json（把 provider/apiType 规整成一致的一对——比如
  // provider:"custom" 而没写 apiType 时推出 openai），再叠在 defaultConfig 上；
  // 顺序不能反：先叠默认值会让出厂 apiType("anthropic") 把托管 provider 顶掉。
  // saveConfig 内部再跑一遍 migrateProvider（幂等）。
  saveConfig({ ...defaultConfig(), ...migrateProvider(merged) });
}
