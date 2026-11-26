// A2：vite 分块加载失败兜底（从 main.jsx 抽出——入口模块副作用重不可单测）。
// A2：发版只增不删后，旧页面仍可能捏着已不存在的动态分块（7 天清理/手动清缓存/
// 回滚等边界）。vite 分块加载失败时抛 vite:preloadError——兜底：
// 先 preventDefault 阻止 vite 默认行为，30 秒内最多自动刷新一次（sessionStorage 记时），
// 刷新前尽力触发一次自动存档；存储不可用（隐私模式等）不自动刷新，只提示手动刷新。
export function installPreloadErrorFallback({
  saveSnapshot = null, storage = null, reload = null, now = () => Date.now(),
} = {}) {
  const st = storage ?? (() => { try { return window.sessionStorage; } catch { return null; } })();
  const doReload = reload ?? (() => window.location.reload());
  const KEY = "qucuo_preload_reload_at";
  const handler = (event) => {
    event.preventDefault();
    if (!st) {
      try { /* 存储不可用仅提示，不记错误缓冲避免循环依赖 */ } catch { /* 静默 */ }
      // 存储不可用：不自动刷新，提示手动刷新。
      if (typeof document !== "undefined" && !document.getElementById("qucuo-preload-notice")) {
        const div = document.createElement("div");
        div.id = "qucuo-preload-notice";
        div.style.cssText = "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.72);color:#f5f0e6;font-size:18px;z-index:99999;text-align:center;padding:2em;";
        div.textContent = "版本已更新，请手动刷新页面";
        document.body?.appendChild(div);
      }
      return;
    }
    let last = 0;
    try { last = Number(st.getItem(KEY) || 0); } catch { last = 0; }
    if (now() - last < 30_000) return; // 30 秒内只刷新一次——防刷新死循环
    try { st.setItem(KEY, String(now())); } catch { /* 写不进也继续刷——下次仍会拦 */ }
    try { saveSnapshot?.(); } catch { /* 存档失败不阻塞刷新 */ }
    doReload();
  };
  if (typeof window !== "undefined") window.addEventListener("vite:preloadError", handler);
  return handler;
}

// 刷新前的自动存档尽力而为：走 useAutosave 挂载时注册的 window bridge。
// 游戏未挂载（开始界面/卡片导入等）即无进行中的回合状态可存，bridge 缺省直接跳过——
// 这使本模块零 import store/domain/infra，不占用跨层直连存量上限。
export function bestEffortAutoSave() {
  try {
    const mod = typeof window !== "undefined" ? window.__qucuoAutosaveBridge : null;
    if (typeof mod === "function") mod();
  } catch { /* 尽力而为 */ }
}
