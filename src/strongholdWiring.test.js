import { describe, it, expect } from "vitest";
import { RESIDENT_NPCS } from "./residentNpcs.js";
import { QUCUO_MAP } from "./qucuoMap.js";
import { INNER_MAP } from "./innerMap.js";
import { BUILDINGS_BY_LOCATION } from "./buildings/qucuoBuildings.js";
import { SERVICE_MENUS } from "./buildings/menuData.js";
import { QUCUO_SHOPS } from "./shops/qucuoShops.js";
import { SKILL_CATALOG } from "./kungfu/qucuoKungfu.js";
import { NPC_SIGNATURE_MOVES } from "./npcSignatureMoves.js";
import { CATALOG_INDEX } from "./items/catalog.js";

// 【这一整份测试是「雅江据点半接线」逼出来的】
// 雅江落地时写了：外层节点、内层14房、6建筑、青城武学4门、NPC专属招式、特产食品、
// 主题配色、地上陈设物 —— 八项齐活，**只有常驻NPC表被跳过**，于是整座城一个人都没有：
//   · innerMap 七个房间都指名道姓写了 residentNpcName，但那字段只管「显示在哪间房」，
//     不负责把人加载出来；房间要人，NPC表却没人可给。
//   · npcSignatureMoves 里一清道长/松鹤道长/玉真子的四招专属招式全挂在空气上。
//   · 建筑的 menuKey "冷锅鱼" 与 shopKey "雅纸铺" 两个键在对应表里都不存在
//     —— 进青衣楼是空菜单，进雅纸铺是空货架。
// 这些全都通不过任何现有测试，因为没人检查「跨表引用是否接得上」。补上。

const ALL_DISTRICTS = Object.keys(QUCUO_MAP);
// 无人区：按设计就不该有常驻NPC（纯景观/传送/剧情场景）
const UNPEOPLED_BY_DESIGN = new Set([
  "白塔", "后山平台", "第三新东京市", "心灵之海", "山洞", "贡措海",
]);
const QUALITY_RANK = { 白: 0, 绿: 1, 蓝: 2, 紫: 3, 橙: 4, 红: 5 };

function allResidents() {
  return Object.entries(RESIDENT_NPCS).flatMap(([d, arr]) =>
    (Array.isArray(arr) ? arr : []).map(n => ({ ...n, district: d })));
}

describe("有内层箱庭的据点必须有常驻NPC（防「盖了城没放人」）", () => {
  it("每个有内层地图的据点都登记了至少一位常驻NPC", () => {
    const empty = [];
    for (const d of Object.keys(INNER_MAP)) {
      if (UNPEOPLED_BY_DESIGN.has(d)) continue;
      const arr = RESIDENT_NPCS[d] || [];
      const rooms = Object.keys(INNER_MAP[d].rooms || {}).length;
      if (!arr.length) empty.push(`${d}（内层 ${rooms} 房，常驻NPC 0 人）`);
    }
    expect(empty, `以下据点有内层箱庭却没有任何常驻NPC：\n  ${empty.join("\n  ")}`).toEqual([]);
  });

  // 历史欠账：这四处在雅江之前就悬空，各有各的成因，都不在本次范围内：
  //   杂货商人 / 老猎户 —— 走 npcPool 游走池，不进常驻表；
  //   兰姐 —— 只有专属招式与任务 giver 身份，常驻表里一直没登记；
  //   都事·柳青鸢 —— 房间写的是带官职前缀的「都事·柳青鸢」，常驻表里叫「柳青鸢」，
  //     两边字符串对不上（房间过滤是精确匹配，所以她在都事府里其实显示不出来）。
  // 先挂账，别让它掩盖新的漏登记。修好一处就从这里删一条。
  const LEGACY_DANGLING_ROOM_NPC = new Set(["杂货商人", "老猎户", "兰姐", "都事·柳青鸢"]);

  it("innerMap 里每个 residentNpcName 都能在常驻NPC表里找到本人", () => {
    const known = new Set(allResidents().map(n => n.name));
    const dangling = [];
    for (const [d, m] of Object.entries(INNER_MAP)) {
      for (const [roomName, room] of Object.entries(m.rooms || {})) {
        const who = room.residentNpcName;
        if (who && !known.has(who) && !LEGACY_DANGLING_ROOM_NPC.has(who)) dangling.push(`${d}·${roomName} 要「${who}」，但常驻NPC表里没有此人`);
      }
    }
    expect(dangling, `内层房间指名要人，但 residentNpcs.js 里查无此人：\n  ${dangling.join("\n  ")}`).toEqual([]);
  });
});

describe("常驻NPC 的 carry 符合文件头写的设计原则", () => {
  const residents = allResidents();
  // 野兽不背包（虎王/狼王/白猿/雪豹这类），按现状豁免
  const isBeast = n => NPC_SIGNATURE_MOVES[n.name]?.unlearnable === true;

  it("每人 carry ≥7 件", () => {
    const bad = residents.filter(n => !isBeast(n) && (n.carry || []).length < 7)
      .map(n => `${n.district}·${n.name}（${(n.carry || []).length} 件）`);
    expect(bad, `carry 不足 7 件：\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  // 历史欠账：这两位在雅江之前就缺类别，属既有状态，先挂账不阻塞。
  // 补齐后请从这里删掉对应条目。
  const LEGACY_MISSING_CATEGORY = new Set(["玄女", "赫连铸"]);

  it("每人至少各有 1 件武器 / 护甲 / 饰品", () => {
    const bad = [];
    for (const n of residents) {
      if (isBeast(n) || LEGACY_MISSING_CATEGORY.has(n.name)) continue;
      const cats = new Set((n.carry || []).map(c => c.category));
      const miss = ["weapon", "armor", "accessory"].filter(c => !cats.has(c));
      if (miss.length) bad.push(`${n.district}·${n.name} 缺 ${miss.join("、")}`);
    }
    expect(bad, `carry 缺少必备类别：\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  // 历史欠账：这几件在雅江之前就超档（多为剧情信物/食品，不影响战力平衡），先挂账。
  const LEGACY_OVERCAP = new Set(["金蛋", "锦官验讫牙牌", "核桃糕", "卓玛的狼骨糖"]);

  it("carry 品质不超过本人 levelCap 对应档（白0/绿1/蓝2/紫3/橙4/红5）", () => {
    const bad = [];
    for (const n of residents) {
      const cap = typeof n.levelCap === "number" ? n.levelCap : 5;
      for (const c of n.carry || []) {
        if (LEGACY_OVERCAP.has(c.name)) continue;
        const rank = QUALITY_RANK[c.quality];
        if (rank != null && rank > cap) {
          bad.push(`${n.district}·${n.name}(lv${cap}) 带了 ${c.quality} 档「${c.name}」`);
        }
      }
    }
    expect(bad, `carry 品质超过 levelCap：\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  it("NPC id 不重复（重复会让强制注入互相顶掉）", () => {
    const ids = residents.map(n => n.id).filter(Boolean);
    const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
    expect([...new Set(dup)], `重复的 NPC id：${[...new Set(dup)].join("、")}`).toEqual([]);
  });
});

describe("建筑的跨表引用都接得上（防悬空 key）", () => {
  const buildings = Object.entries(BUILDINGS_BY_LOCATION).flatMap(([d, arr]) =>
    (Array.isArray(arr) ? arr : []).map(b => ({ ...b, district: d })));

  it("menuKey 都能在 SERVICE_MENUS 里查到（查不到＝空菜单）", () => {
    const bad = buildings.filter(b => b.menuKey && !SERVICE_MENUS[b.menuKey])
      .map(b => `${b.district}·${b.name} 的 menuKey "${b.menuKey}"`);
    expect(bad, `以下 menuKey 在 SERVICE_MENUS 里不存在：\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  it("shopKey 都能在 QUCUO_SHOPS 里查到（查不到＝空货架）", () => {
    const bad = buildings.filter(b => b.shopKey && !QUCUO_SHOPS[b.shopKey])
      .map(b => `${b.district}·${b.name} 的 shopKey "${b.shopKey}"`);
    expect(bad, `以下 shopKey 在 QUCUO_SHOPS 里不存在：\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  it("skillSet 都能在 SKILL_CATALOG 里查到（查不到＝武馆教不了武）", () => {
    const bad = buildings.filter(b => b.skillSet && !SKILL_CATALOG[b.skillSet])
      .map(b => `${b.district}·${b.name} 的 skillSet "${b.skillSet}"`);
    expect(bad, `以下 skillSet 在 SKILL_CATALOG 里不存在：\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  it("建筑所属据点都在外层地图上", () => {
    const bad = Object.keys(BUILDINGS_BY_LOCATION).filter(d => !QUCUO_MAP[d]);
    expect(bad, `这些据点有建筑但不在 QUCUO_MAP 上：${bad.join("、")}`).toEqual([]);
  });
});

describe("专属招式不能挂在空气上", () => {
  it("每个配了专属招的人，要么是常驻NPC、要么是野兽/伙伴", () => {
    // 历史欠账：这五位在雅江之前就只有招式没有常驻登记（多为游走/事件型出场，
    // 走的是 npcPool 或剧情注入，不一定要进常驻表）。先挂账，别让它掩盖新的漏登记。
    const LEGACY_ORPHAN = new Set(["明日香", "行脚僧", "兰姐", "来访武者", "老猎户"]);
    const known = new Set(allResidents().map(n => n.name));
    const orphan = Object.keys(NPC_SIGNATURE_MOVES).filter(name => {
      if (known.has(name) || LEGACY_ORPHAN.has(name)) return false;
      return NPC_SIGNATURE_MOVES[name]?.unlearnable !== true; // 野兽另有出场路径
    });
    expect(orphan, `以下人配了专属招式，但常驻NPC表里查无此人（招式是死数据）：\n  ${orphan.join("\n  ")}`).toEqual([]);
  });
});

describe("食品的 consumable 字段不能漏（漏了就是吃下去没反应）", () => {
  it("凡带「食品」或「酒」标签的都有 consumable", () => {
    const bad = [];
    for (const [name, e] of Object.entries(CATALOG_INDEX)) {
      const tags = e.tags || [];
      if (!tags.includes("食品") && !tags.includes("酒")) continue;
      if (!e.consumable || !Object.keys(e.consumable).length) bad.push(name);
    }
    expect(bad, `以下食品/酒没有 consumable：\n  ${bad.join("、")}`).toEqual([]);
  });

  // 注：这里刻意**不**要求食品都带 sixDimTemp。全 catalog 有 23 样食品/酒只回血不给
  // 属性（青稞饼、酥油茶、青稞酒这些主食都是），所以「食品必给临时属性」并不是本项目
  // 的惯例，只是高档菜色的常见写法。设计稿审核清单里「食品 consumable 数值」也还没
  // 勾选——数值平衡该由作者自己定，测试不该替他定。

  it("consumable 里的 sixDimTemp 属性名都是合法七维", () => {
    const SEVEN = new Set(["根骨", "悟性", "体魄", "魅力", "智谋", "身法", "气运"]);
    const bad = [];
    for (const [name, e] of Object.entries(CATALOG_INDEX)) {
      for (const attr of Object.keys(e.consumable?.sixDimTemp || {})) {
        if (!SEVEN.has(attr)) bad.push(`${name} → ${attr}`);
      }
    }
    expect(bad, `sixDimTemp 里出现了非七维属性名（写错就是静默失效）：\n  ${bad.join("\n  ")}`).toEqual([]);
  });
});
