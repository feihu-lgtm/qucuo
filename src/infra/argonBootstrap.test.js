// 契约：argon-config.json 免配置引导——有托管配置且玩家无存档配置时写入；
// 玩家已有配置绝不覆盖；文件缺失/网络错/JSON坏/缺字段一律静默不写。
import { describe, it, expect, vi, beforeEach } from "vitest";
import { bootstrapArgonConfig } from "./argonBootstrap.js";
import { loadConfig } from "./apiConfig.js";

const CONFIG_KEY = "wuxia_mud_api_config";
const HOSTED = {
  provider: "custom",
  apiType: "openai",
  endpoint: "https://argonmeow.online/v1/chat/completions",
  apiKey: "sk-hosted",
  model: "gemini-3.8-flash",
};

function stubStore(initial = {}) {
  const store = { ...initial };
  vi.stubGlobal("localStorage", {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  });
  return store;
}

function stubFetchOk(body) {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => body,
  })));
}

function stubFetchFail() {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 })));
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("bootstrapArgonConfig", () => {
  it("拉到托管配置且玩家无存档 → 经 defaultConfig 合并写入 CONFIG_KEY", async () => {
    // 契约：托管 json 生效后，loadConfig 读到 endpoint/apiKey/model，
    // 且出厂默认值（targetWordCount 等）仍在。
    const store = stubStore();
    stubFetchOk(HOSTED);
    await bootstrapArgonConfig();
    expect(store[CONFIG_KEY]).toBeTruthy();
    const saved = JSON.parse(store[CONFIG_KEY]);
    expect(saved.apiKey).toBe("sk-hosted");
    expect(saved.endpoint).toBe(HOSTED.endpoint);
    expect(saved.model).toBe("gemini-3.8-flash");
    expect(saved.targetWordCount).toBe(900);
    expect(loadConfig()).toBeTruthy();
    // 请求打向 BASE_URL 下的 argon-config.json
    const url = vi.mocked(fetch).mock.calls[0][0];
    expect(url).toContain("argon-config.json");
  });

  it("托管只写 provider:custom 不写 apiType → 存为 openai 协议而非 anthropic", async () => {
    // 契约：defaultConfig 的出厂 apiType("anthropic") 不许顶掉托管 provider——
    // 先 migrateProvider 托管 json 再合并，保证 provider/apiType 一致。
    const store = stubStore();
    stubFetchOk({ provider: "custom", endpoint: HOSTED.endpoint, apiKey: "sk-hosted", model: "m" });
    await bootstrapArgonConfig();
    const saved = JSON.parse(store[CONFIG_KEY]);
    expect(saved.provider).toBe("custom");
    expect(saved.apiType).toBe("openai");
  });

  it("fetch 挂起超时 → 静默返回、不卡启动、不写配置", async () => {
    // 契约：请求永不 resolve 时 3.5s 后自动放弃，bootstrap 照常结束。
    vi.useFakeTimers();
    try {
      const store = stubStore();
      vi.stubGlobal("fetch", vi.fn((_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new Error("aborted")));
      })));
      const p = bootstrapArgonConfig();
      await vi.advanceTimersByTimeAsync(4000);
      await p;
      expect(store[CONFIG_KEY]).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("玩家已有配置 → 托管配置绝不覆盖", async () => {
    // 契约：CONFIG_KEY 已存在时连字段都不碰。
    const mine = JSON.stringify({ apiKey: "sk-mine", endpoint: "https://me.example/v1" });
    const store = stubStore({ [CONFIG_KEY]: mine });
    stubFetchOk(HOSTED);
    await bootstrapArgonConfig();
    expect(store[CONFIG_KEY]).toBe(mine);
  });

  it("fetch 404 → 不写且正常返回", async () => {
    // 契约：非托管部署（没有 argon-config.json）启动不受影响。
    const store = stubStore();
    stubFetchFail();
    await bootstrapArgonConfig();
    expect(store[CONFIG_KEY]).toBeUndefined();
  });

  it("fetch 抛网络错 → 不写且正常返回", async () => {
    const store = stubStore();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    await bootstrapArgonConfig();
    expect(store[CONFIG_KEY]).toBeUndefined();
  });

  it("JSON 坏 → 不写且正常返回", async () => {
    const store = stubStore();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => { throw new Error("bad json"); },
    })));
    await bootstrapArgonConfig();
    expect(store[CONFIG_KEY]).toBeUndefined();
  });

  it("缺 apiKey / endpoint → 不写", async () => {
    // 契约：半份配置不许落盘——缺关键字段视为部署方没配好。
    const store = stubStore();
    stubFetchOk({ provider: "custom", apiType: "openai", model: "m" });
    await bootstrapArgonConfig();
    expect(store[CONFIG_KEY]).toBeUndefined();
    stubFetchOk({ ...HOSTED, apiKey: "  " });
    await bootstrapArgonConfig();
    expect(store[CONFIG_KEY]).toBeUndefined();
  });
});
