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
  // 存储不可用（对象缺失或 getItem/setItem 抛错——隐私模式常见表现是方法抛而不是
  // 访问 sessionStorage 本身抛）统一走 manualNotice：不自动刷新，只提示手动刷新。
  const manualNotice = () => {
    if (typeof document !== "undefined" && !document.getElementById("qucuo-preload-notice")) {
      const div = document.createElement("div");
      div.id = "qucuo-preload-notice";
      div.style.cssText = "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.72);color:#f5f0e6;font-size:18px;z-index:99999;text-align:center;padding:2em;";
      div.textContent = "版本已更新，请手动刷新页面";
      document.body?.appendChild(div);
    }
  };
  const handler = (event) => {
    event.preventDefault();
    // Review 修：手动刷新路径也要先尽力存档——autosave 走 IDB/LS 不依赖 sessionStorage，
    // 玩家手动刷新前不存会丢未存档进度（错误边界卸载后连关页兜底都没了）。
    const saveThenNotice = () => {
      try { saveSnapshot?.(); } catch { /* 尽力 */ }
      manualNotice();
    };
    if (!st) { saveThenNotice(); return; }
    let last = 0;
    try { last = Number(st.getItem(KEY) || 0); } catch { saveThenNotice(); return; } // getItem 抛=不可用
    if (now() - last < 30_000) return; // 30 秒内只刷新一次——防刷新死循环
    try { st.setItem(KEY, String(now())); } catch { saveThenNotice(); return; } // setItem 抛=不可用
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
