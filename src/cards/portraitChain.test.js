import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fitSize, dataUrlBytes, fmtBytes, isCustomPortrait } from "./portraitCompress.js";

// 【这条链断了三处，每处都独立地让立绘失效】
//   ① 选择器指错目录：十张内置立绘在 src/assets/portraits/ 走 Vite import，而
//      PORTRAIT() 拼的是 public/portraits/ —— 全 404，onError 又把破图隐藏，
//      表现成"这一节只有一个不设按钮"。
//   ② 字段语义不一致：入册存英文文件名，快速战斗那边拼 bidders/full/中文名.webp。
//   ③ 白名单剥掉：MudRPG 的 toRoomNpcWithCombat 那份字段白名单没有 portrait，
//      importedRegistry 里 o.portrait = c.portrait 传不到运行时。
// 三条全是"不报错、只是没图"，所以都得盯源码。
const HERE = dirname(fileURLToPath(import.meta.url));
const NPC = readFileSync(join(HERE, "ReviewNpc.jsx"), "utf-8");
const PARTS = readFileSync(join(HERE, "ReviewParts.jsx"), "utf-8");
const MUD = readFileSync(join(HERE, "..", "MudRPG.jsx"), "utf-8");
const QB = readFileSync(join(HERE, "..", "quickBattle", "QuickBattleScreen.jsx"), "utf-8");
const PORTRAITS = readFileSync(join(HERE, "..", "portraits.js"), "utf-8");

describe("立绘链路不能再断", () => {
  it("选择器读 DEFAULT_PORTRAITS，不再自己拼 public 路径", () => {
    expect(NPC).toContain("Object.keys(DEFAULT_PORTRAITS)");
    expect(NPC, "又出现英文文件名数组了——那批文件不在 public/portraits/ 下，会全部 404")
      .not.toMatch(/const PORTRAITS = \[\s*"caidan\.webp"/);
  });

  it("ReviewParts 不再导出那个指错目录的 PORTRAIT", () => {
    expect(PARTS, "PORTRAIT 拼的是 public/portraits/，那十张不在那儿")
      .not.toMatch(/^export const PORTRAIT = /m);
  });

  it("room.npcs 的字段白名单含 portrait", () => {
    const line = MUD.split("\n").find(l => l.includes('"levelCap", "special"') && l.includes("for (const k of"));
    expect(line, "没找到 toRoomNpcWithCombat 的白名单，指纹可能变了，请同步这条守卫").toBeTruthy();
    expect(line, "白名单漏了 portrait——入册角色的立绘会在转换时被剥掉，传不到运行时")
      .toContain('"portrait"');
  });

  it("快速战斗的 PORTRAIT 先解析再拼，不会拼出 bidders/full/data:image", () => {
    expect(QB).toContain("resolveCardPortrait");
    const i = QB.indexOf("const PORTRAIT = ");
    expect(i).toBeGreaterThan(0);
    const block = QB.slice(i, i + 300);
    // 解析必须发生在拼接之前
    expect(block.indexOf("resolveCardPortrait")).toBeLessThan(block.indexOf("bidders/full"));
  });

  it("内置立绘存的是键名而不是打包 URL", () => {
    // 打包 URL 带 content hash，存进入册库下次构建就失效
    expect(PORTRAITS).toContain("export function resolveCardPortrait");
    expect(PORTRAITS).toContain("PORTRAIT_BY_FILE");
    // 既有的两参数 resolvePortrait 必须还在（LeftPanel / PortraitManager 在用）
    expect(PORTRAITS).toMatch(/export function resolvePortrait\(uploadedPortraits, name\)/);
  });
});

describe("立绘压缩的尺寸计算", () => {
  it("等比缩进框内", () => {
    expect(fitSize(1024, 1536, 360, 540)).toEqual({ w: 360, h: 540, scaled: true });
    expect(fitSize(2000, 1000, 360, 540)).toEqual({ w: 360, h: 180, scaled: true });
  });

  it("原图已在框内时不放大", () => {
    expect(fitSize(100, 120, 360, 540)).toEqual({ w: 100, h: 120, scaled: false });
  });

  it("方图按较小的那一边约束", () => {
    // 360/800 = 0.45，540/800 = 0.675，取小的
    expect(fitSize(800, 800, 360, 540)).toEqual({ w: 360, h: 360, scaled: true });
  });

  it("坏尺寸不抛错", () => {
    expect(fitSize(0, 100)).toEqual({ w: 0, h: 0, scaled: false });
    expect(fitSize(NaN, NaN)).toEqual({ w: 0, h: 0, scaled: false });
    expect(fitSize(undefined, undefined)).toEqual({ w: 0, h: 0, scaled: false });
  });

  it("dataURL 体积算得准（含 padding）", () => {
    // "AAAA" → 3 字节，无 padding
    expect(dataUrlBytes("data:image/webp;base64,AAAA")).toBe(3);
    // 一个 = 少一字节，两个 = 少两字节
    expect(dataUrlBytes("data:image/webp;base64,AAA=")).toBe(2);
    expect(dataUrlBytes("data:image/webp;base64,AA==")).toBe(1);
    expect(dataUrlBytes("不是 dataURL")).toBe(0);
    expect(dataUrlBytes(null)).toBe(0);
  });

  it("体积文案分档", () => {
    expect(fmtBytes(0)).toBe("0B");
    expect(fmtBytes(512)).toBe("512B");
    expect(fmtBytes(2048)).toBe("2KB");
    expect(fmtBytes(3 * 1024 * 1024)).toBe("3.0MB");
  });

  it("认得出哪些是自备图", () => {
    expect(isCustomPortrait("data:image/webp;base64,AAAA")).toBe(true);
    expect(isCustomPortrait("blob:http://x/y")).toBe(true);
    expect(isCustomPortrait("才旦")).toBe(false);
    expect(isCustomPortrait("caidan.webp")).toBe(false);
    expect(isCustomPortrait("")).toBe(false);
    expect(isCustomPortrait(null)).toBe(false);
  });
});
