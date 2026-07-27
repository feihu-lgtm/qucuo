import { describe, it, expect } from "vitest";
import {
  COMBAT_FIELDS, pickCombatData, injectNpcs, patchCombatData,
  markCarriedLost, materializeNpc, removeNpc, respawnNpc,
} from "./roomNpcs.js";

// room.npcs 此前有 15 个写入方，连着两个 bug 都是"谁都能改、改的时候顺手把别人
// 写进去的东西冲掉"。这套测试是那两个 bug 的回归，也是这份状态的行为契约。

describe("注入：已在名单里的也要补设定（bug② 的修法）", () => {
  const ai = { name: "才旦", id: "n1", brief: "村口少年", innerRoom: "村口·广场" };
  const resident = {
    name: "才旦", id: "resident_caidan", brief: "鱼定村少年猎户", levelCap: 1,
    carriedItems: [{ name: "鱼定猎刀" }, { name: "止血散" }],
    moveset: ["x"], fullBio: "长长的设定",
  };

  it("名字已在 → 补上驻场设定（此前是整个跳过，carry 永远进不来）", () => {
    const out = injectNpcs([ai], [resident]);
    expect(out).toHaveLength(1);
    expect(out[0].carriedItems.map(i => i.name)).toEqual(["鱼定猎刀", "止血散"]);
    expect(out[0].levelCap).toBe(1);
    expect(out[0].fullBio).toBe("长长的设定");
  });

  it("目标自己有值的字段一律保留（AI 的 brief、当天的 innerRoom 不被覆盖）", () => {
    const out = injectNpcs([ai], [resident]);
    expect(out[0].brief).toBe("村口少年");
    expect(out[0].innerRoom).toBe("村口·广场");
  });

  it("名字不在 → 整个加进来", () => {
    const out = injectNpcs([{ name: "张三" }], [resident]);
    expect(out.map(n => n.name)).toEqual(["张三", "才旦"]);
  });

  it("已有 carriedItems 的一律不动（那份可能带 stolen/dropped）", () => {
    const looted = { name: "才旦", carriedItems: [{ name: "鱼定猎刀", stolen: true }] };
    const out = injectNpcs([looted], [resident]);
    expect(out[0]).toBe(looted);
  });

  it("incoming 里同名的只取第一个（去重）", () => {
    const out = injectNpcs([], [{ name: "甲", carriedItems: [] }, { name: "甲", carriedItems: [{ name: "x" }] }]);
    expect(out).toHaveLength(1);
  });

  it("无事可做时返回同一个引用（避免无谓重渲染）", () => {
    const list = [{ name: "张三", carriedItems: [] }];
    expect(injectNpcs(list, [])).toBe(list);
    expect(injectNpcs(list, [{ name: "张三", carriedItems: [{ name: "y" }] }])).toBe(list);
  });

  it("脏输入不炸", () => {
    for (const v of [null, undefined, "abc", 1]) {
      expect(() => injectNpcs(v, [resident])).not.toThrow();
      expect(() => injectNpcs([resident], v)).not.toThrow();
    }
    expect(() => injectNpcs([null, {}, { name: "" }], [resident])).not.toThrow();
  });
});

describe("回填固化数据：名单不动、只补战斗字段（bug① 的修法）", () => {
  const fresh = new Map([["王铁匠", {
    name: "王铁匠", carriedItems: [{ name: "铁锤" }], moveset: ["a"],
    combatStats: { hp: [10, 10] }, levelCap: 2, brief: "不该被用到的brief",
  }]]);

  it("缺数据的被补上", () => {
    const out = patchCombatData([{ name: "王铁匠", brief: "AI给的" }], fresh);
    expect(out[0].carriedItems).toHaveLength(1);
    expect(out[0].combatStats).toBeTruthy();
  });

  it("只补战斗字段，不碰 brief 之类（白名单外的一概不动）", () => {
    const out = patchCombatData([{ name: "王铁匠", brief: "AI给的" }], fresh);
    expect(out[0].brief).toBe("AI给的");
  });

  it("名单不新增不删除（这是不能碰的红线）", () => {
    const out = patchCombatData([{ name: "王铁匠" }, { name: "张三" }], fresh);
    expect(out.map(n => n.name)).toEqual(["王铁匠", "张三"]);
  });

  it("已固化的原样跳过，不重新随机随身物", () => {
    const already = { name: "王铁匠", carriedItems: [{ name: "旧物" }] };
    expect(patchCombatData([already], fresh)[0]).toBe(already);
  });

  it("空表/脏输入时返回原引用", () => {
    const list = [{ name: "王铁匠" }];
    expect(patchCombatData(list, new Map())).toBe(list);
    expect(patchCombatData(list, null)).toBe(list);
  });

  it("pickCombatData 白名单包含掉落与偷窃都要用的 carriedItems", () => {
    expect(COMBAT_FIELDS).toContain("carriedItems");
    expect(Object.keys(pickCombatData({ carriedItems: [], brief: "x" }))).toEqual(["carriedItems"]);
  });
});

describe("标记随身物已失去", () => {
  const npcs = [{ name: "甲", carriedItems: [{ id: "i1", name: "刀" }, { id: "i2", name: "药" }] }];

  it("按 id 标 stolen", () => {
    const out = markCarriedLost(npcs, "甲", { id: "i1" }, "stolen");
    expect(out[0].carriedItems[0].stolen).toBe(true);
    expect(out[0].carriedItems[1].stolen).toBeUndefined();
  });

  it("按 name 标 dropped（切磋掉落只有名字）", () => {
    const out = markCarriedLost(npcs, "甲", { name: "药" }, "dropped");
    expect(out[0].carriedItems[1].dropped).toBe(true);
  });

  it("stolen 与 dropped 是两个独立标记，不互相覆盖", () => {
    let out = markCarriedLost(npcs, "甲", { id: "i1" }, "stolen");
    out = markCarriedLost(out, "甲", { id: "i1" }, "dropped");
    expect(out[0].carriedItems[0].stolen).toBe(true);
    expect(out[0].carriedItems[0].dropped).toBe(true);
  });

  it("不动其他人", () => {
    const two = [...npcs, { name: "乙", carriedItems: [{ id: "i1", name: "刀" }] }];
    const out = markCarriedLost(two, "甲", { id: "i1" });
    expect(out[1].carriedItems[0].stolen).toBeUndefined();
  });

  it("已经标过的不重复标（返回原引用）", () => {
    const done = [{ name: "甲", carriedItems: [{ id: "i1", stolen: true }] }];
    expect(markCarriedLost(done, "甲", { id: "i1" }, "stolen")).toBe(done);
  });

  it("找不到人/没随身物/脏输入都不炸", () => {
    expect(markCarriedLost(npcs, "不存在", { id: "i1" })).toBe(npcs);
    expect(markCarriedLost([{ name: "甲" }], "甲", { id: "i1" })[0].name).toBe("甲");
    expect(markCarriedLost(null, "甲", { id: "i1" })).toEqual([]);
    expect(markCarriedLost(npcs, "甲", null)).toBe(npcs);
  });
});

describe("涌现 / 移除 / 重生", () => {
  it("涌现：就地换成带战斗数据的版本", () => {
    const fixed = { name: "阿福", carriedItems: [], moveset: ["a"] };
    const out = materializeNpc([{ name: "阿福" }, { name: "乙" }], "阿福", fixed);
    expect(out[0]).toBe(fixed);
    expect(out[1].name).toBe("乙");
  });

  it("移除：按谓词删（雪豹入队后不再作为驻场兽在场）", () => {
    const out = removeNpc(
      [{ name: "雪豹", companionCandidate: true }, { name: "甲" }],
      n => n.name === "雪豹" && n.companionCandidate,
    );
    expect(out.map(n => n.name)).toEqual(["甲"]);
  });

  it("移除：没命中时返回原引用", () => {
    const list = [{ name: "甲" }];
    expect(removeNpc(list, n => n.name === "乙")).toBe(list);
  });

  it("重生：先移同名再放新的（不会变成两只）", () => {
    const fresh = { name: "大公鸡", combatStats: { hp: [9, 9] } };
    const out = respawnNpc([{ name: "大公鸡", combatStats: { hp: [0, 9] } }, { name: "甲" }], fresh);
    expect(out.filter(n => n.name === "大公鸡")).toHaveLength(1);
    expect(out.find(n => n.name === "大公鸡").combatStats.hp[0]).toBe(9);
  });

  it("重生：脏输入不炸", () => {
    const list = [{ name: "甲" }];
    expect(respawnNpc(list, null)).toBe(list);
    expect(respawnNpc(null, { name: "x" })).toEqual([{ name: "x" }]);
  });
});

// ── 架构守卫：不许绕过这层直接改名单 ──────────────────────────────────
// 【为什么值得写一条测试来管代码风格】
// 这次收拢的起因是连着两个 bug，根因都是"15 个写入方各写一遍、谁都能顺手把别人
// 写进去的东西冲掉"。收拢本身只是把当下这 8 处改干净了——真正的风险是**下一个人
// （包括以后的我）加功能时又图省事直接写一句 npcs: r.npcs.map(...)**，
// 然后同一类 bug 再来一次，而且照样测不出来。
// 所以钉一条：源码里不许再出现裸操作。加不了的形状就往 roomNpcs.js 里加个操作。
import { readFileSync } from "node:fs";

describe("不许绕过 roomNpcs 直接改名单", () => {
  const FILES = ["src/MudRPG.jsx", "src/act/commitRound.js"];

  it.each(FILES)("%s 里没有裸 npcs: r.npcs.map/filter", (f) => {
    const src = readFileSync(f, "utf-8");
    const lines = src.split("\n");
    const bad = [];
    lines.forEach((l, i) => {
      if (!l.includes("setRoom") || l.trim().startsWith("//")) return;
      const blk = lines.slice(i, i + 7).join("\n");
      if (/npcs:\s*r\.npcs\.(map|filter)|npcs:\s*\[\.\.\.r\.npcs/.test(blk)) bad.push(i + 1);
    });
    expect(bad, `第 ${bad.join(",")} 行在裸操作 room.npcs——请改用 roomNpcs.js 里的具名操作，或往那儿加一个`).toEqual([]);
  });

  it("整体换房间那几处不受此限（npcs: [] / 缓存名单 是换 room 不是改名单）", () => {
    const src = readFileSync("src/MudRPG.jsx", "utf-8");
    // 传送/进出心灵之海确实还在直接给 npcs: []，这是有意的
    expect(src).toMatch(/npcs:\s*\[\]/);
  });
});

// ── 快照过期：UI 持有的 NPC 对象引用会跟 room.npcs 脱钩 ─────────────────
// 【实测反馈】"偷窃还是偷不到装备"。逻辑层其实是好的——才旦的池子里 3 件装备、
// 4 件杂物，模拟偷 500 次能偷到装备 112 次。问题在 UI 那一层：
// activeNpcMenu 存的是**点开菜单那一刻的对象引用**，而菜单开着的这段时间里
// room.npcs 可能被驻场注入 effect 补上 carriedItems（那个 effect 按据点/换天触发）。
// 于是玩家点"偷窃"时，handleNpcSteal 拿到的是那份还没被补数据的旧快照，
// carriedItems 仍是 undefined → 池子空 → 偷不到东西。
// 修法：菜单一律按名字从 room.npcs 重新取当前对象，取不到才退回快照
// （队友走 RightPanel 那条入口，其对象本就不在 room.npcs 里）。
describe("UI 持有的 NPC 引用必须能取到当前真值", () => {
  const live = (roster, snapshot) =>
    (snapshot ? roster.find(n => n.name === snapshot.name) || snapshot : null);

  it("名单里那份已被补数据 → 取到的是补过的（而不是旧快照）", () => {
    const stale = { name: "才旦", brief: "村口少年" };                    // 点菜单时的快照
    const patched = { name: "才旦", brief: "村口少年", carriedItems: [{ name: "鱼定猎刀", category: "weapon" }] };
    const got = live([patched], stale);
    expect(got.carriedItems).toHaveLength(1);
    expect(got).toBe(patched);
  });

  it("名单里没有这个人 → 退回快照（队友走的是另一条入口）", () => {
    const companion = { name: "明日香", carriedItems: [{ name: "朗基努斯" }] };
    expect(live([{ name: "才旦" }], companion)).toBe(companion);
  });

  it("没开菜单时为 null", () => {
    expect(live([{ name: "才旦" }], null)).toBeNull();
  });

  it("装备类能进偷窃池（category 在固化时被保留）", async () => {
    const { getResidentNpcs } = await import("./residentNpcs.js");
    const { ensureNpcCombatData } = await import("./npcGeneration.js");
    const caidan = getResidentNpcs("鱼定村").find(n => n.name === "才旦");
    const fixed = ensureNpcCombatData({ ...caidan }, { luck: 5, levelCap: caidan.levelCap ?? 1 });
    const equip = fixed.carriedItems.filter(i => ["weapon", "armor", "accessory"].includes(i.category));
    expect(equip.length, "随身物里应有装备类，否则永远只偷得到杂物").toBeGreaterThan(0);
  });
});

// ── 偷窃的 owner 语义（最容易被后人"顺手补全"改坏的一处）─────────────
// 得手 = 对方**完全没察觉**。若把他挂成 jotNote 的 owner，这条就成了他
// "亲历/目击"的事实，之后他会在对话里提起自己被偷——而他根本不知道，等于
// 系统替他泄露了玩家的秘密。被发现则相反：他确实知道，必须挂上，否则日后
// 他提起这事、别人问起来都对不上。
// 这两条是同一套 owner 语义的两面，也是很容易被"看到没写 owner 就顺手补上"
// 改坏的地方，所以扫源码钉死。
describe("偷窃的 owner 语义：得手不挂、被发现要挂", () => {
  const src = readFileSyncSafe("src/MudRPG.jsx");

  it("四个结局都写了起居注", () => {
    const n = (src.match(/noteAction\("steal(Fail)?"\)/g) || []).length;
    expect(n, "被发现/得手拿物/得手偷招/一无所有，应各有一笔").toBe(4);
  });

  it("被发现那条挂了对方为 owner（亲历）", () => {
    const seg = src.slice(src.indexOf('noteAction("stealFail")'), src.indexOf('noteAction("stealFail")') + 600);
    expect(seg).toMatch(/owner:\s*\[\{\s*name:\s*npc\.name/);
    expect(seg).toMatch(/VIA\.FIRSTHAND/);
  });

  it("得手那几条都没挂 owner（他不知道）", () => {
    for (const anchor of ["他毫无察觉", "他没有察觉", "他身上已经一无所有"]) {
      const i = src.indexOf(anchor);
      expect(i, `找不到 ${anchor} 那条 jotNote`).toBeGreaterThan(0);
      // 往前找这条 jotNote 的开头，检查其中没有 owner
      const start = src.lastIndexOf("jotNote({", i);
      const seg = src.slice(start, src.indexOf("});", i) + 3);
      expect(seg, `${anchor} 那条不该挂 owner——他没察觉`).not.toMatch(/owner:/);
    }
  });
});

function readFileSyncSafe(p) {
  return readFileSync(p, "utf-8");
}
