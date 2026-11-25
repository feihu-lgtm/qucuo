// WO-24C 接线断言（源码级）：协调会话终审口径——hook 必须真挂进组合链，
// 四处 handler 必须拿得到 maybePrep。本测试钉死这条链，防回归静默断线。
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("WO-24C world.prep 接线", () => {
  it("MudRPG 实例化 useWorldPrep 且 maybePrep 先于两个 handler hook 注入", () => {
    const src = read("../../MudRPG.jsx");
    const instIdx = src.indexOf("useWorldPrep({ apiCfg })");
    expect(instIdx, "MudRPG 必须实例化 useWorldPrep").toBeGreaterThan(-1);
    // 实例化必须先于消费方（TDZ——后声明会在运行期直接炸）
    const progIdx = src.indexOf("useProgressionHandlers({");
    const buildIdx = src.indexOf("useBuildingHandlers({");
    expect(instIdx).toBeLessThan(progIdx);
    expect(instIdx).toBeLessThan(buildIdx);
    // maybePrep 必须真传进两个 handler hook 的参数块
    const progBlock = src.slice(progIdx, progIdx + 300);
    const buildBlock = src.slice(buildIdx, buildIdx + 300);
    expect(progBlock).toContain("maybePrep");
    expect(buildBlock).toContain("maybePrep");
  });

  it("useBuildingHandlers 住店/读书成功触发 lodging/reading", () => {
    const src = read("./useBuildingHandlers.js");
    expect(src).toContain('maybePrep?.("lodging")');
    expect(src).toContain('maybePrep?.("reading")');
    // 成功才触发：住店看 changes、读书看 settle
    expect(src).toMatch(/result\?\.changes\) maybePrep\?\.\("lodging"\)/);
    expect(src).toMatch(/result\?\.settle\) maybePrep\?\.\("reading"\)/);
  });

  it("useProgressionHandlers 打坐成功触发 meditate", () => {
    const src = read("./useProgressionHandlers.js");
    expect(src).toMatch(/result\?\.changes\) maybePrep\?\.\("meditate"\)/);
  });

  it("useWorldPrep 壳内监听 room.name 触发 travel（第四处）", () => {
    const src = read("./useWorldPrep.js");
    expect(src).toContain('maybePrep("travel")');
    expect(src).toContain("useGameStore((s) => s.room?.name)");
  });
});
