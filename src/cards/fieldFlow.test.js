import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// 字段流转对账
// ============================================================================
// 【为什么需要这个】入册角色进 room.npcs 要过两道转换：
//   toPoolLike（importedRegistry）→ toRoomNpc（npcPool）→ 白名单补回（MudRPG）
// 而 toRoomNpc 只保留 id / name / brief / isPoolNpc / carriedItems 五项，其余
// 一律丢掉——任何想活着到达运行时的字段，都必须出现在 toRoomNpcWithCombat 那份
// 白名单里。这个约束没有任何语法或类型层面的强制，全靠人记得。
//
// 已经栽过五次：special（玩家调的七维被剥）、companionCandidate（雪豹的邀请入队
// 按钮不显示）、carry（偷不到东西）、portrait（入册立绘从未生效）、neigong/waigong
// （玩家调的内外功一律按品阶取默认值）。每次的表现都是"不报错、只是那项设置没用"，
// 测试全绿、构建全绿。前四次都是等玩家反馈才发现，第五次是靠这份对账查出来的。
//
// 这条测试把约束写成机器可检的形式：toPoolLike 产出的每个字段，必须能通过转换链。
const HERE = dirname(fileURLToPath(import.meta.url));
const REG = readFileSync(join(HERE, "importedRegistry.js"), "utf-8");
const POOL = readFileSync(join(HERE, "..", "npcPool.js"), "utf-8");
const MUD = readFileSync(join(HERE, "..", "MudRPG.jsx"), "utf-8");

/** toPoolLike 产出的字段：对象字面量里的 `k:` 与后续的 `o.k =` */
function poolLikeFields() {
  const i = REG.indexOf("function toPoolLike");
  expect(i, "没找到 toPoolLike，指纹可能变了，请同步这条对账").toBeGreaterThan(0);
  // 到函数体结束为止，用花括号平衡而不是"找下一个 function"——第一版就是那么写的，
  // 而 toPoolLike 后面紧跟的是 export function，indexOf("\nfunction ") 找不到，
  // body 一路延伸到文件末尾，把 getImportedNpcLore 里 world 映射的 aliases / entry /
  // isWorld 全抓了进来，报出三个假问题。
  const open = REG.indexOf("{", i);
  let depth = 0, end = REG.length;
  for (let k = open; k < REG.length; k++) {
    if (REG[k] === "{") depth++;
    else if (REG[k] === "}") { depth--; if (depth === 0) { end = k; break; } }
  }
  const body = REG.slice(i, end);
  const out = new Set();
  for (const m of body.matchAll(/^\s{4}([a-zA-Z][\w]*):/gm)) out.add(m[1]);
  for (const m of body.matchAll(/\bo\.([a-zA-Z][\w]*)\s*=/g)) out.add(m[1]);
  return out;
}

/** toRoomNpc 直接保留的字段 */
function toRoomNpcKept() {
  const i = POOL.indexOf("export function toRoomNpc(");
  expect(i).toBeGreaterThan(0);
  const body = POOL.slice(i, POOL.indexOf("\n}", i));
  const out = new Set();
  for (const m of body.matchAll(/^\s{4}([a-zA-Z][\w]*):/gm)) out.add(m[1]);
  return out;
}

/** toRoomNpcWithCombat 的白名单 */
function whitelist() {
  const m = MUD.match(/for \(const k of \[([^\]]+)\]\) \{\s*\n\s*if \(poolNpc\[k\]/);
  expect(m, "没找到 toRoomNpcWithCombat 的白名单，指纹可能变了，请同步这条对账").toBeTruthy();
  return new Set([...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]));
}

describe("入册角色的字段必须能活着到达 room.npcs", () => {
  it("toPoolLike 产出的每个字段，都在 toRoomNpc 保留项或白名单里", () => {
    const produced = poolLikeFields();
    const kept = toRoomNpcKept();
    const wl = whitelist();
    expect(produced.size, "一个字段都没提取到，说明指纹失效了").toBeGreaterThan(5);

    const lost = [...produced].filter(k => !kept.has(k) && !wl.has(k));
    expect(lost,
      `以下字段会在 toRoomNpcWithCombat 转换时被静默剥掉（不报错、只是那项设置没用）：\n`
      + `  ${lost.join("、")}\n`
      + `修法：加进 MudRPG.jsx 里 toRoomNpcWithCombat 的字段白名单。`
    ).toEqual([]);
  });

  it("那五个已经栽过的字段现在都在白名单里", () => {
    const wl = whitelist();
    for (const k of ["special", "companionCandidate", "carry", "portrait", "neigong", "waigong"]) {
      expect(wl, `白名单缺 ${k}——这个字段历史上栽过一次，不能再掉`).toContain(k);
    }
  });

  it("toRoomNpc 仍然只保留那五项（若它变了，上面的对账前提也要跟着改）", () => {
    const kept = toRoomNpcKept();
    expect([...kept].sort()).toEqual(["brief", "carriedItems", "id", "isPoolNpc", "name"]);
  });
});
