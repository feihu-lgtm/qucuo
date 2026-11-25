// PR-B2：GM/创造模式有意例外——即使 extractionEnabled 默认 true，
// gm=true 回合单点派生 extractionEnabled:false，判官不激活、走单调用 JSON 老路。
import { describe, expect, it, vi } from "vitest";
import { createTurnContext } from "./turnContext.js";

const noop = () => {};
function makeEnv(gm) {
  return {
    plan: {},
    env: {
      state: {
        room: { name: "鱼定村", npcs: [] }, char: {}, inv: [], skills: [], dao: {},
        flags: [], mapData: {}, time: 1, preset: { scenario: "测" }, narrator: {},
        convo: [], nsfwOn: false, companionState: {}, questProgress: {},
      },
      refs: {},
      io: new Proxy({}, { get: () => noop }),
      opts: {},
      apiCfg: { extractionEnabled: true, judgePipelineEnabled: true },
      gm,
      cmd: "测试",
    },
  };
}

describe("PR-B2 GM/创造模式判官例外", () => {
  it("gm=true：effectiveApiCfg.extractionEnabled 被压 false（判官自然不激活）", () => {
    const ctx = createTurnContext(makeEnv(true));
    expect(ctx.apiCfg.extractionEnabled).toBe(false);
    expect(ctx.apiCfg.judgePipelineEnabled).toBe(true); // 开关本身不动，靠 extraction 分岔熄火
    expect(ctx.callDeps().apiCfg.extractionEnabled).toBe(false);
  });
  it("gm=true：不改写原对象（非变异）", () => {
    const env = makeEnv(true);
    createTurnContext(env);
    expect(env.env.apiCfg.extractionEnabled).toBe(true);
  });
  it("gm=false：默认双调用不受影响", () => {
    const ctx = createTurnContext(makeEnv(false));
    expect(ctx.apiCfg.extractionEnabled).toBe(true);
  });
});
