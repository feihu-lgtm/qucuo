import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const MUD = readFileSync(join(HERE, "MudRPG.jsx"), "utf-8");
const REG = readFileSync(join(HERE, "cards", "importedRegistry.js"), "utf-8");
const OVL = readFileSync(join(HERE, "panels", "GlobalOverlays.jsx"), "utf-8");
const SCREEN = readFileSync(join(HERE, "CardImportScreen.jsx"), "utf-8");

// 【为什么要守这几条】三条都是"不报错、只是什么都没发生"：
//   · 落册后 room.npcs 不重算：registerImported 改的是模块级 let，React 依赖系统
//     看不见，组装 effect 的依赖数组里没有一项会变，人得等玩家走出据点再回来才出现。
//   · onImportWorld 断在 GlobalOverlays 没解构 props 那一层：finish 里
//     `if (world.length && onImportWorld)` 短路，世界观条目从来没入过库。
//     propsCheck 抓不到这类——它查的是"用了作用域里不存在的标识符"，而这里
//     onImportWorld 压根没在 GlobalOverlays 里出现过。
describe("落册之后 room 必须重算", () => {
  it("用 useSyncExternalStore 订阅入册库，且 revision 进了依赖数组", () => {
    // 【为什么验订阅而不是验手动计数】第一版是在 MudRPG 加个 state、落册回调里 +1，
    // 当场就漏了 handleImportWorld 那个写入点。订阅挂在 registry 的 persist 上，
    // 那是四个写操作的唯一出口，不会漏。
    expect(MUD).toContain("useSyncExternalStore");
    expect(MUD).toContain("importedRegistry.subscribeImported");
    expect(MUD).toContain("importedRegistry.getImportedRevision");
    // 用 "}, [" 开头做指纹——importedVer 的声明注释里复述了这个依赖数组，
    // 只按内容找会先撞上那条注释（第一版这条守卫就是这么误报的）
    const line = MUD.split("\n").find(l => l.trim().startsWith("}, [room.name, dayIdx"));
    expect(line, "没找到组装 room.npcs 的依赖数组，指纹可能变了，请同步这条守卫").toBeTruthy();
    expect(line, "依赖数组没有 importedVer——落册后 effect 不会重跑，人不出现")
      .toContain("importedVer");
  });

  it("通知挂在 persist 上——那是所有写操作的唯一出口", () => {
    expect(REG).toContain("export function subscribeImported");
    expect(REG).toContain("export function getImportedRevision");
    // persist 里必须既推 revision 又通知订阅者
    const i = REG.indexOf("function persist()");
    expect(i).toBeGreaterThan(0);
    const body = REG.slice(i, REG.indexOf("\n}", i));
    expect(body, "persist 没推 revision——写了库但没人知道").toContain("_rev++");
    expect(body, "persist 没通知订阅者").toMatch(/_subs/);
  });

  it("四个写操作都以 persist 为出口（新增写操作若绕过它，通知就漏了）", () => {
    // registerImported / registerImportedWorld / removeImported / clearImported
    const calls = (REG.match(/^\s*persist\(\);/gm) || []).length;
    expect(calls, "persist 调用点少于四个，可能有写操作绕过了通知").toBeGreaterThanOrEqual(4);
    // 反过来：改 _registry 的地方不该多于调 persist 的地方 + 初始化
    const writes = (REG.match(/_registry\.(chars|world) = /g) || []).length;
    expect(writes).toBeLessThanOrEqual(calls);
  });
});

describe("入册的三个落地回调都要接到底", () => {
  it("GlobalOverlays 解构了 onImportWorld 并往下传", () => {
    expect(OVL, "props 里没解构 onImportWorld——MudRPG 传了但断在这一层")
      .toMatch(/onImportNpcs,\s*onImportPlayer,\s*onImportWorld/);
    expect(OVL).toContain("onImportWorld={onImportWorld}");
  });

  it("当前据点传到了入册界面", () => {
    expect(OVL).toContain("currentDistrict={room.name}");
    expect(SCREEN).toContain("currentDistrict");
  });
});

describe("勾选式加入", () => {
  it("默认全勾、有全选钮、按勾选数落册", () => {
    expect(SCREEN).toContain("new Set(result.npcs.map((_, i) => i))");
    expect(SCREEN).toContain("toggleAll");
    expect(SCREEN).toContain("onFinish(pickedNpcs)");
  });

  it("finish 接收名单参数，不传则按全部（老行为不破）", () => {
    expect(SCREEN).toMatch(/const finish = \(npcsToImport\)/);
    expect(SCREEN).toContain("Array.isArray(npcsToImport) ? npcsToImport : (result?.npcs || [])");
  });

  it("勾掉的人不算进「会真的出现」", () => {
    expect(SCREEN).toContain("pickedNpcs.filter(x => normalizePlacement(x.placement).mode");
  });
});
