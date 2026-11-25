// 存档驱动配置存取（WO-19）——独立成模块以断 storageDriver↔proseUplink 循环依赖。
// 真相源是 localStorage `wuxia_mud_storage_config`；deviceId 首读生成即持久化。
const CONFIG_KEY = "wuxia_mud_storage_config";

export function loadStorageConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    const cfg = raw ? JSON.parse(raw) : {};
    return {
      driver: ["local", "cloud", "file"].includes(cfg.driver) ? cfg.driver : "local",
      cloudUrl: typeof cfg.cloudUrl === "string" ? cfg.cloudUrl : "",
      spaceId: typeof cfg.spaceId === "string" ? cfg.spaceId : "",
      hubToken: typeof cfg.hubToken === "string" ? cfg.hubToken : "",
      deviceId: typeof cfg.deviceId === "string" && cfg.deviceId
        ? cfg.deviceId
        : (() => {
          // 设备 id 一旦生成立即持久化——每次现造随机 id 等于每次都换设备，
          // 服务端按设备判冲突会全乱（二审必修 1）。
          const id = `dev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
          try { localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...cfg, deviceId: id })); } catch { /* */ }
          return id;
        })(),
      boundAt: cfg.boundAt || null,
    };
  } catch {
    return { driver: "local", cloudUrl: "", spaceId: "", hubToken: "", deviceId: "dev_fallback", boundAt: null };
  }
}

export function saveStorageConfig(cfg) {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); return true; } catch { return false; }
}
