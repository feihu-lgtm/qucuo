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

  // 曾经这里硬性要求地图用到 ne/sw——那是「鱼定村-sw->锦官城」那版布局的遗留。
  // 后来查出三城东西颠倒（雅江写着「出西门行三日便是曲措乡界」却把曲措乡放在东北），
  // 订正成 曲措乡(0,0)→雅江(1,0)→锦官城(2,0) 的正东走向后，外层就不再用复合方向了。
  // 所以这条改成「不写死用了哪些方向，只要求用到的都能解析」，下面几条本来就是这么做的。
  it("地图至少有一个方向在用（否则这组测试失去意义）", () => {
    expect(usedDirs.length).toBeGreaterThan(0);
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

// ── 地图拓扑与坐标必须自洽（本轮五个 bug 里有三个是这类）────────────────────
import { INNER_MAP } from "./innerMap.js";
const DXY = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0], ne: [1, -1], nw: [-1, -1], se: [1, 1], sw: [-1, 1] };

describe("坐标与方向必须自洽（画出来的图不能跟走出来的路相反）", () => {
  it("外层：每条出口的实际位移方向与它声明的方向一致", () => {
    const bad = [];
    for (const [n, d] of Object.entries(QUCUO_MAP)) {
      for (const [dir, dest] of Object.entries(d.exits || {})) {
        const v = DXY[dir], t = QUCUO_MAP[dest];
        if (!v || !t) continue;
        const dx = t.x - d.x, dy = t.y - d.y;
        if (Math.sign(dx) !== Math.sign(v[0]) || Math.sign(dy) !== Math.sign(v[1]))
          bad.push(`${n} -${dir}-> ${dest} 实际位移(${dx},${dy})`);
      }
    }
    expect(bad, `外层方向与坐标矛盾：\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  it("内层：每条出口的实际位移方向与它声明的方向一致", () => {
    const bad = [];
    for (const [dist, m] of Object.entries(INNER_MAP)) {
      const R = m.rooms || {};
      for (const [n, r] of Object.entries(R)) {
        for (const [dir, dest] of Object.entries(r.exits || {})) {
          const v = DXY[dir]; if (!v || !R[dest]) continue;
          const dx = R[dest].x - r.x, dy = R[dest].y - r.y;
          if (Math.sign(dx) !== Math.sign(v[0]) || Math.sign(dy) !== Math.sign(v[1]))
            bad.push(`${dist}·${n} -${dir}-> ${dest} 实际位移(${dx},${dy})`);
        }
      }
    }
    expect(bad, `内层方向与坐标矛盾（此前 45 处，多为 n 到底是 y+1 还是 y-1 各据点各说各的）：\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  it("同一据点内不得有两间房挤在同一坐标", () => {
    const bad = [];
    for (const [dist, m] of Object.entries(INNER_MAP)) {
      const seen = {};
      for (const [n, r] of Object.entries(m.rooms || {})) {
        const k = `${r.x},${r.y}`;
        if (seen[k]) bad.push(`${dist} (${k}): ${seen[k]} ⟂ ${n}`); else seen[k] = n;
      }
    }
    expect(bad, `内层坐标撞位：\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  it("外层也不得撞位", () => {
    const seen = {}, bad = [];
    for (const [n, d] of Object.entries(QUCUO_MAP)) {
      if (!Number.isFinite(d.x)) continue;
      const k = `${d.x},${d.y}`;
      if (seen[k]) bad.push(`(${k}): ${seen[k]} ⟂ ${n}`); else seen[k] = n;
    }
    expect(bad, `外层坐标撞位：\n  ${bad.join("\n  ")}`).toEqual([]);
  });
});
