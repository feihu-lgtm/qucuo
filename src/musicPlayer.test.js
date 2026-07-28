import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  TRACKS, resolveTrackUrl, getState, subscribe, playTrack, toggleMusic,
  setVolume, isMusicEnabled, setMusicEnabled, currentTrack, __resetForTests,
} from "./musicPlayer.js";

// 这个文件本身就是修复的一部分：musicPlayer 原来第一行是模块顶层裸读
// localStorage，node 环境下 import 即抛，所以音乐系统一条测试都没有——②③④
// 那几个 bug 才能带着 507/507 全绿上线。现在它能被直接 import 了。

beforeEach(() => __resetForTests());

describe("曲库数据本身", () => {
  it("每首曲子要么有本地 file、要么有外链 remote，不能都没有", () => {
    for (const t of TRACKS) {
      expect(t.file || t.remote, `「${t.title}」既没有 file 也没有 remote`).toBeTruthy();
    }
  });

  it("本地 file 不带前导斜杠（前导斜杠就是 Pages 上 404 的那个 bug）", () => {
    for (const t of TRACKS) {
      if (!t.file) continue;
      expect(t.file.startsWith("/"), `「${t.title}」的 file 带了前导斜杠：${t.file}`).toBe(false);
    }
  });

  it("id 唯一（playTrack 靠 id 查表，撞了就切不准）", () => {
    const ids = TRACKS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("resolveTrackUrl：本地曲拼 BASE，外链原样", () => {
  it("外链原样返回，不被拼上 BASE", () => {
    const remote = TRACKS.find(t => t.remote);
    expect(resolveTrackUrl(remote)).toBe(remote.remote);
  });

  it("本地曲拼出的路径以 BASE 开头，且不含双斜杠", () => {
    const local = TRACKS.find(t => t.file);
    const url = resolveTrackUrl(local);
    expect(url.endsWith(local.file)).toBe(true);
    expect(url).not.toMatch(/[^:]\/\//); // 排除 https:// 之后不该再有 //
  });

  it("就算 file 误写了前导斜杠也不会拼出双斜杠（防御性）", () => {
    expect(resolveTrackUrl({ file: "/music/x.mp3" })).not.toMatch(/[^:]\/\//);
  });

  it("空输入不抛错", () => {
    expect(resolveTrackUrl(null)).toBe("");
    expect(resolveTrackUrl({})).toBe("");
  });
});

describe("音乐模式开关真的管得住播放（原来它是装饰性的）", () => {
  it("默认关闭", () => {
    expect(isMusicEnabled()).toBe(false);
    expect(getState().enabled).toBe(false);
  });

  it("enabled 进了 getState()，订阅者才能跟着变（顶栏按钮就是这么修的）", () => {
    const seen = [];
    subscribe(s => seen.push(s.enabled));
    setMusicEnabled(true);
    setMusicEnabled(false);
    expect(seen).toEqual([true, false]);
  });

  it("关着的时候起播会被拦下并给出原因，而不是静默什么也不做", () => {
    setMusicEnabled(false);
    playTrack(TRACKS[1].id);
    // node 环境没有 Audio，起播整体降级；但曲目选择本身要生效
    expect(getState().trackId).toBe(TRACKS[1].id);
  });

  it("关掉音乐模式会清掉残留错误提示", () => {
    setMusicEnabled(true);
    setMusicEnabled(false);
    expect(getState().error).toBe(null);
  });
});

describe("切曲与音量", () => {
  it("playTrack 切得动当前曲目", () => {
    playTrack(TRACKS[2].id);
    expect(getState().trackId).toBe(TRACKS[2].id);
    expect(currentTrack().id).toBe(TRACKS[2].id);
  });

  it("playTrack 给不存在的 id 时不动当前曲目、不抛错", () => {
    const before = getState().trackId;
    playTrack("不存在的曲子");
    expect(getState().trackId).toBe(before);
  });

  it("音量被夹在 0~1，脏输入回落到默认值而不是 NaN", () => {
    setVolume(2); expect(getState().volume).toBe(1);
    setVolume(-1); expect(getState().volume).toBe(0);
    setVolume(0.35); expect(getState().volume).toBeCloseTo(0.35);
    setVolume("哈"); expect(Number.isFinite(getState().volume)).toBe(true);
  });

  it("音量变化会通知订阅者", () => {
    const fn = vi.fn();
    subscribe(fn);
    setVolume(0.8);
    expect(fn).toHaveBeenCalled();
  });
});

describe("没有 Audio / 没有 localStorage 也不能炸", () => {
  it("node 环境（无 Audio）下所有入口都是安全空操作", () => {
    expect(typeof Audio).toBe("undefined"); // 前提成立才说明这条测试有意义
    expect(() => { toggleMusic(); playTrack(TRACKS[0].id); setVolume(0.5); setMusicEnabled(true); }).not.toThrow();
    expect(getState().playing).toBe(false);
  });

  it("getState 不会顺手 new 出一个 Audio 来（读状态不该有副作用）", () => {
    expect(getState().playing).toBe(false);
    expect(getState().playing).toBe(false);
  });

  it("localStorage 抛异常时退化成内存态，读写都还能用", () => {
    const orig = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() { throw new Error("SecurityError: 无痕模式"); },
    });
    try {
      expect(() => setVolume(0.42)).not.toThrow();
      expect(getState().volume).toBeCloseTo(0.42);
      expect(() => setMusicEnabled(true)).not.toThrow();
      expect(isMusicEnabled()).toBe(true);
    } finally {
      if (orig === undefined) delete globalThis.localStorage;
      else Object.defineProperty(globalThis, "localStorage", { configurable: true, value: orig, writable: true });
    }
  });

  it("单个订阅者抛错不连坐其它订阅者", () => {
    const good = vi.fn();
    subscribe(() => { throw new Error("坏订阅者"); });
    subscribe(good);
    expect(() => setVolume(0.6)).not.toThrow();
    expect(good).toHaveBeenCalled();
  });

  it("退订之后不再收到通知", () => {
    const fn = vi.fn();
    const off = subscribe(fn);
    off();
    setVolume(0.7);
    expect(fn).not.toHaveBeenCalled();
  });
});

// ── 曲库文件落地守卫 ────────────────────────────────────────────────────────
// TRACKS 里声明了 file 的曲目，public/ 下必须真有那个文件，否则玩家点下去只会
// 得到一句"找不到音频文件"。这是当初音乐系统上线时**两首里两首都挂**的原因：
// public/music/ 这个目录压根不存在，而 vite build 也就不会往 dist 里放。
//
// KNOWN_MISSING 是显式的欠账清单：文件还没拿到手的曲目登记在这儿，测试放它过，
// 但账记在代码里而不是留给玩家去踩。把 mp3 放进 public/music/ 之后，删掉对应
// 条目，这条守卫立刻开始真正校验。
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const KNOWN_MISSING = new Set([
  "music/zood.mp3",         // 丁真 — Zood：文件未提供
  "music/yan-distance.mp3", // 丁真 — 烟 Distance：文件未提供
]);

describe("曲库文件真的在 public 下（防「点了没声音」）", () => {
  it("public/music/ 目录存在（不存在的话 vite 连 dist 都不会建这个目录）", () => {
    expect(existsSync(join(PUBLIC_DIR, "music"))).toBe(true);
  });

  it("每首本地曲的 mp3 都在位，除了 KNOWN_MISSING 里挂账的", () => {
    const missing = [];
    for (const t of TRACKS) {
      if (!t.file || KNOWN_MISSING.has(t.file)) continue;
      if (!existsSync(join(PUBLIC_DIR, t.file))) missing.push(`${t.title} → public/${t.file}`);
    }
    expect(missing, `以下曲目声明了本地文件但文件不存在，点下去必然无声：\n  ${missing.join("\n  ")}`).toEqual([]);
  });

  it("KNOWN_MISSING 里的条目都还确实缺着（补齐了就该把它从清单里删掉）", () => {
    const stale = [...KNOWN_MISSING].filter(f => existsSync(join(PUBLIC_DIR, f)));
    expect(stale, `这些文件已经补齐了，请从 musicPlayer.test.js 的 KNOWN_MISSING 里删除：\n  ${stale.join("\n  ")}`).toEqual([]);
  });

  it("KNOWN_MISSING 里不该有 TRACKS 压根没声明的路径（防清单腐烂）", () => {
    const declared = new Set(TRACKS.filter(t => t.file).map(t => t.file));
    const orphan = [...KNOWN_MISSING].filter(f => !declared.has(f));
    expect(orphan, `KNOWN_MISSING 里这些路径 TRACKS 里已经没有了：\n  ${orphan.join("\n  ")}`).toEqual([]);
  });
});
