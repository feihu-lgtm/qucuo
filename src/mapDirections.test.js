import { describe, it, expect } from "vitest";
import { parseDir, DIRS, DIR_DXY } from "./utils/mudHelpers.js";
import { QUCUO_MAP, findPath, parseDirectionJudgeResponse } from "./qucuoMap.js";

// 【"我离不开锦官城"】锦官城的唯一出口是 ne（东北→鱼定村），但 parseDir 里有一句
// `if (/^…(东南|东北|西北)/) return null` 把东北整个毙掉了。玩家点九宫格东北格 →
// autoTravelTo 把 ne 翻成"东北"交给 act → parseDir 返回 null → 系统压根没判定成
// 移动 → 目的地锁不上 → AI 自由发挥、位置原地不动。而进城走的 sw 另有一条精确
// 别名，进得去出不来，整个据点是个单行陷阱。
//
// 下面的测试刻意**从地图数据反推**，不写死"要支持 ne"——以后地图再加东南/西北的
// 路，这些测试会自动开始检查它们，不需要有人记得回来补。

const ALL_NODES = Object.keys(QUCUO_MAP);
// 非常规拓扑节点：不与任何据点接壤，靠传送/剧情进出，寻路走不到是设计如此。
const UNREACHABLE_BY_DESIGN = new Set(["心灵之海", "第三新东京市"]);

describe("地图上真正用到的每个方向都必须能被解析出来", () => {
  const usedDirs = [...new Set(ALL_NODES.flatMap(n => Object.keys(QUCUO_MAP[n].exits || {})))];

  it("地图确实用到了复合方向（否则这组测试就失去意义了）", () => {
    expect(usedDirs.some(d => d.length === 2 && d !== "ne" ? true : d === "ne")).toBe(true);
    expect(usedDirs).toContain("ne"); // 锦官城 → 鱼定村
    expect(usedDirs).toContain("sw"); // 鱼定村 → 锦官城
  });

  it("每个方向的中文名（autoTravelTo/九宫格实际交给 act 的那个字符串）都能解析回同一个方向码", () => {
    for (const dir of usedDirs) {
      const cn = DIRS[dir];
      expect(cn, `DIRS 缺少方向 ${dir} 的中文名`).toBeTruthy();
      expect(parseDir(cn), `parseDir("${cn}") 应得 ${dir}`).toBe(dir);
    }
  });

  it("带移动前缀的口语说法（往X/向X/去X/到X）也解析成同一个方向码", () => {
    for (const dir of usedDirs) {
      const cn = DIRS[dir];
      for (const p of ["往", "向", "朝", "去", "到"]) {
        expect(parseDir(`${p}${cn}`), `parseDir("${p}${cn}") 应得 ${dir}`).toBe(dir);
      }
      expect(parseDir(`往${cn}走`), `parseDir("往${cn}走") 应得 ${dir}`).toBe(dir);
    }
  });

  it("英文缩写不再被单字母正则吃掉（ne 曾被解析成 n，往北走、方向完全错）", () => {
    expect(parseDir("ne")).toBe("ne");
    expect(parseDir("nw")).toBe("nw");
    expect(parseDir("se")).toBe("se");
    expect(parseDir("sw")).toBe("sw");
    expect(parseDir("n")).toBe("n");
    expect(parseDir("s")).toBe("s");
  });

  it("八向 + 上下都有 DIR_DXY 坐标偏移（少一个就画不出小地图连线）", () => {
    for (const dir of ["n", "s", "e", "w", "ne", "nw", "se", "sw", "u", "d"]) {
      expect(DIR_DXY[dir], `DIR_DXY 缺少 ${dir}`).toBeTruthy();
    }
  });
});

describe("没有单行陷阱：每个据点都走得出去", () => {
  it("每个常规据点都能寻路回到鱼定村（锦官城此前出不来）", () => {
    for (const node of ALL_NODES) {
      if (UNREACHABLE_BY_DESIGN.has(node) || node === "鱼定村") continue;
      const path = findPath(node, "鱼定村");
      expect(path, `从「${node}」寻不到回鱼定村的路`).toBeTruthy();
    }
  });

  it("每个常规据点至少有一个出口，且出口方向全部可解析（不可解析＝走不了）", () => {
    for (const node of ALL_NODES) {
      if (UNREACHABLE_BY_DESIGN.has(node)) continue;
      const dirs = Object.keys(QUCUO_MAP[node].exits || {});
      expect(dirs.length, `「${node}」没有任何出口`).toBeGreaterThan(0);
      const dead = dirs.filter(d => parseDir(DIRS[d] || d) !== d);
      expect(dead, `「${node}」的这些出口方向解析不出来，等于走不了：${dead.join("、")}`).toEqual([]);
    }
  });

  it("出口互为反向的成对关系（拓扑自洽，顺带保证来回都走得通）", () => {
    const OPPOSITE = { n: "s", s: "n", e: "w", w: "e", ne: "sw", sw: "ne", nw: "se", se: "nw" };
    for (const node of ALL_NODES) {
      for (const [dir, dest] of Object.entries(QUCUO_MAP[node].exits || {})) {
        const back = OPPOSITE[dir];
        if (!back) continue; // u/d 不做反向要求
        const destExits = QUCUO_MAP[dest]?.exits || {};
        // 只要目标据点认得回来的路就行（不强求方向码严格互为反向，但本图目前都是）
        const comesBack = Object.values(destExits).includes(node);
        expect(comesBack, `「${node}」往${dir}到「${dest}」，但「${dest}」没有任何出口回「${node}」`).toBe(true);
      }
    }
  });
});

describe("AI 方向兜底（目前闲置）的输出白名单与 parseDir 同步", () => {
  it("八向 + 上下都被接受（此前漏了 ne，等于兜底也出不了锦官城）", () => {
    for (const d of ["n", "s", "e", "w", "ne", "nw", "se", "sw", "u", "d"]) {
      expect(parseDirectionJudgeResponse(d), `方向码 ${d} 被白名单拒了`).toBe(d);
    }
  });

  it("none 与越界输出仍然一律判无效（不做模糊提取）", () => {
    expect(parseDirectionJudgeResponse("none")).toBe(null);
    expect(parseDirectionJudgeResponse("")).toBe(null);
    expect(parseDirectionJudgeResponse("往东北方向走")).toBe(null);
    expect(parseDirectionJudgeResponse("northeast")).toBe(null);
  });
});
