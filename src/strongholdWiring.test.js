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
import { EFFECT_CN } from "./itemEffectText.js";

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
  // 先挂账，别让它掩盖新的漏登记。修好一处就从这里删一条。
  const LEGACY_DANGLING_ROOM_NPC = new Set(["杂货商人", "老猎户", "兰姐"]); // 都事·柳青鸢 已修

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
  // （玄女缺武器、赫连铸缺饰品这两笔欠账已补齐，白名单清空。）
  const LEGACY_MISSING_CATEGORY = new Set([]);

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
  const LEGACY_OVERCAP = new Set(); // 四件已修：持有者提档，物品本就该在他们身上

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

  // carry 写了名字、catalog 却没有这一条时，makeItemSmart 会退回公式生成——
  // 那些明明是为某个角色专门写的随身物（玄女的青石子、赫连铸的半张欠条）掉出来
  // 会变成没有词条、没有来历的白板货，也进不了物件志给 AI 引用。
  it("carry 里每件具名物都能在 catalog 查到", () => {
    const bad = [];
    for (const n of residents) {
      for (const c of n.carry || []) {
        if (!CATALOG_INDEX[c.name]) bad.push(`${n.district}·${n.name}: ${c.name}`);
      }
    }
    expect(bad, `以下 carry 物件 catalog 里没有，会退化成公式生成的白板货：\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  it("carry 声明的品类/品质与 catalog 一致（两边打架时以 catalog 为准，容易看走眼）", () => {
    const bad = [];
    for (const n of residents) {
      for (const c of n.carry || []) {
        const e = CATALOG_INDEX[c.name];
        if (!e) continue;
        if (e.category !== c.category) bad.push(`${n.name}·${c.name} carry写${c.category}，catalog是${e.category}`);
        if (e.quality !== c.quality) bad.push(`${n.name}·${c.name} carry写${c.quality}，catalog是${e.quality}`);
      }
    }
    expect(bad, `carry 与 catalog 声明不一致：\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  it("同一人不重复携带同名物件", () => {
    const bad = [];
    for (const n of residents) {
      const seen = new Set();
      for (const c of n.carry || []) {
        if (seen.has(c.name)) bad.push(`${n.district}·${n.name}: ${c.name}`);
        seen.add(c.name);
      }
    }
    expect(bad, `同一人重复携带：\n  ${bad.join("\n  ")}`).toEqual([]);
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

// ── 游走NPC不得落进上锁房间 ────────────────────────────────────────────────
// 「乞丐与老7滚勿入」——溪边小屋篱笆上钉着的木牌是契诃夫之枪，游戏答应过他进不来。
// 但游走池NPC的落点是从 getInnerRoomNames（全集）里随机抽的，玩家自己那间上锁的
// 小屋也在里头，于是老七天天在玩家家里。四栋安全屋全中招。
import { getPublicInnerRoomNames, getInnerRoomNames } from "./innerMap.js";
import { SAFE_HOUSES } from "./safeHouse.js";

describe("游走NPC的落点只能是公共房间", () => {
  it("公共房间列表剔掉了所有带 unlockCondition 的房间", () => {
    for (const [d, m] of Object.entries(INNER_MAP)) {
      const pub = new Set(getPublicInnerRoomNames(d));
      for (const [name, room] of Object.entries(m.rooms || {})) {
        if (room.unlockCondition) {
          expect(pub.has(name), `「${d}·${name}」上着锁却还在公共落点池里`).toBe(false);
        }
      }
    }
  });

  it("四栋安全屋一间都不在落点池里（玩家的私宅）", () => {
    for (const house of SAFE_HOUSES) {
      const d = house.district || house.location;
      if (!d || !INNER_MAP[d]) continue;
      const pub = getPublicInnerRoomNames(d);
      expect(pub, `安全屋「${house.room || house.name}」仍可能被随机丢进游走NPC`).not.toContain(house.room || house.name);
    }
  });

  it("溪边小屋（老七那块牌子）确实被排除", () => {
    expect(getPublicInnerRoomNames("鱼定村")).not.toContain("溪边小屋");
    expect(getInnerRoomNames("鱼定村")).toContain("溪边小屋"); // 全集里还在，只是不当落点
  });

  it("公共房间不为空——排除得太狠会让游走NPC无处可去", () => {
    for (const d of Object.keys(INNER_MAP)) {
      expect(getPublicInnerRoomNames(d).length, `「${d}」把房间全排除了，游走NPC无处落脚`).toBeGreaterThan(0);
    }
  });
});

// ── 本轮五个 bug 的回归钉子 ────────────────────────────────────────────────
import { getCompanionDescForm, classifyDescForm, COMPANION_LORE } from "./companion.js";
import { getCompanionForm, setCompanionForm, SNOW_LEOPARD_FORMS, PEARL_FORMS } from "./portraits.js";
import { parseDir } from "./utils/mudHelpers.js";
import { QUCUO_MAP } from "./qucuoMap.js";
import { HOMESTEAD_FEATURES, getHomestead } from "./homestead.js";

describe("BUG1 形态：右栏选什么，发给AI的就是什么（曾经是两套状态各走各的）", () => {
  it("分类器把三档立绘收敛成两档描述：非 beast 一律算人形", () => {
    expect(classifyDescForm("beast")).toBe("beast");
    expect(classifyDescForm("form1")).toBe("human");
    expect(classifyDescForm("form2")).toBe("human");
    expect(classifyDescForm("以后新加的形态")).toBe("human");
  });

  it("切到人形立绘之后，注入用的描述形态跟着变（此前永远停在 beast）", () => {
    // node 环境没有 localStorage，portraits.js 的读写会走 catch 分支永远吐默认值，
    // 测不出联动。这里装一个最小 shim——它同时也证明了「只有一个真值源」：
    // 下面全程只调 setCompanionForm（立绘那套），从没碰过描述形态的存储。
    const mem = new Map();
    const orig = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) },
    });
    try {
    for (const key of ["snowLeopard", "pearl"]) {
      setCompanionForm(key, "beast");
      expect(getCompanionDescForm(key)).toBe("beast");
      setCompanionForm(key, "form1");
      expect(getCompanionDescForm(key), `${key} 切人形后描述形态没跟上`).toBe("human");
    }
    } finally {
      if (orig) Object.defineProperty(globalThis, "localStorage", orig);
      else delete globalThis.localStorage;
    }
  });

  it("立绘形态表里每个非 beast 的 key 都能被归成人形（防新增形态漏归类）", () => {
    for (const forms of [SNOW_LEOPARD_FORMS, PEARL_FORMS]) {
      for (const f of forms) {
        expect(classifyDescForm(f.key)).toBe(f.key === "beast" ? "beast" : "human");
      }
    }
  });

  it("有立绘人形档的伙伴，人设里也必须有对应的人形文案", () => {
    for (const key of ["snowLeopard", "pearl"]) {
      const lore = COMPANION_LORE[key];
      if (!lore) continue;
      expect(lore.human, `${key} 有人形立绘却没有人形人设`).toBeTruthy();
      expect(lore.beast, `${key} 缺兽形人设`).toBeTruthy();
    }
  });
});

describe("BUG3 地名别名过期：打「去锦官城」不能走到雅江去", () => {
  it("parseDir 不再把锦官城当成一个方向", () => {
    expect(parseDir("去锦官城")).toBe(null);
    expect(parseDir("锦官城")).toBe(null);
  });

  it("出乡是一路向东：曲措乡 → 雅江 → 锦官城（地名别名当年就是这么过期的）", () => {
    expect(QUCUO_MAP["鱼定村"].exits.e).toBe("雅江");
    expect(QUCUO_MAP["雅江"].exits.e).toBe("锦官城");
    expect(QUCUO_MAP["雅江"].exits.w).toBe("鱼定村");
    // 雅江的描述写着「出西门行三日便是曲措乡界」，西边必须真的是曲措乡
    expect(QUCUO_MAP["雅江"].desc).toContain("出西门");
  });

  it("纯方向词照常解析，没被误伤", () => {
    expect(parseDir("西南")).toBe("sw");
    expect(parseDir("往西南")).toBe("sw");
  });
});

describe("BUG4 都事府：柳青鸢的名字要与常驻表对得上", () => {
  it("房间要的人名能在常驻表里查到（精确匹配，差一个前缀她就不出现）", () => {
    const want = INNER_MAP["锦官城"].rooms["都事府"].residentNpcName;
    const names = (RESIDENT_NPCS["锦官城"] || []).map(n => n.name);
    expect(names, `都事府要「${want}」，常驻表里没有`).toContain(want);
  });
});

describe("BUG5 家园设施不能有够不到的孤儿条目", () => {
  const HOME_ROOMS = ["溪边小屋", "起居室", "灶房", "菜园子", "弟子别院", "东厢卧房", "西厢书房",
    "山间别墅", "一楼客厅", "二楼主卧", "蜀王庄", "正堂佛堂", "后院书房", "银杏后院"];

  it("每栋声明的设施都至少有一间房够得到", () => {
    const orphan = [];
    for (const [house, def] of Object.entries(HOMESTEAD_FEATURES)) {
      const reachable = new Set();
      for (const room of HOME_ROOMS) {
        const h = getHomestead(room);
        if (h && (h.house || room) === house) h.features.forEach(f => reachable.add(f.id));
      }
      for (const f of def.features) {
        if (!reachable.has(f.id)) orphan.push(`${house}·${f.name}(${f.id})`);
      }
    }
    expect(orphan, `以下设施声明了但没有任何房间能用到：\n  ${orphan.join("\n  ")}`).toEqual([]);
  });
});

// ── 饰品必须像武器护甲一样，有自己的真字段并且显示得出来 ──────────────────
// 饰品原来靠 bonus（白0.3→红6）撑场面，界面打印成「+3.3」——但战斗里没有任何
// 一处读它，是纯粹的装饰性数值。现已从全项目删除；饰品的战力改由 sixDim/effect
// 承担，跟武器的 atk、护甲的 def 平级。
describe("饰品的战力字段", () => {
  const acc = () => Object.values(CATALOG_INDEX).filter(e => e.category === "accessory");

  it("bonus 字段已从 catalog 里彻底消失（不许再冒充战力）", () => {
    const left = Object.values(CATALOG_INDEX).filter(e => e.bonus != null).map(e => e.name);
    expect(left, `这些物品还带着已废弃的 bonus：${left.join("、")}`).toEqual([]);
  });

  it("每件饰品至少有 sixDim 或 effect 之一——不能一无所有", () => {
    const blank = acc().filter(e => !e.sixDim && !e.effect).map(e => `${e.name}(${e.quality})`);
    expect(blank, `以下饰品没有任何战力字段，戴上等于没戴：\n  ${blank.join("、")}`).toEqual([]);
  });

  it("饰品的 sixDim 属性名都是合法七维（写错就是静默失效）", () => {
    const SEVEN = new Set(["根骨", "悟性", "体魄", "魅力", "智谋", "身法", "气运"]);
    const bad = [];
    for (const e of acc()) for (const k of Object.keys(e.sixDim || {})) if (!SEVEN.has(k)) bad.push(`${e.name} → ${k}`);
    expect(bad, `非法七维属性名：\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  it("饰品的 effect 标志位都能被词典翻成人话（翻不出来玩家就看不懂）", () => {
    const PARAM = new Set(["applyMarkChance", "applyMarkOnHit", "statusChance", "confuseChance"]);
    const bad = [];
    for (const e of acc()) {
      for (const k of Object.keys(e.effect || {})) {
        if (PARAM.has(k)) continue;
        if (!EFFECT_CN[k]) bad.push(`${e.name} → ${k}`);
      }
    }
    expect(bad, `以下特效标志位不在 itemEffectText 的词典里，界面上会是空白：\n  ${bad.join("\n  ")}`).toEqual([]);
  });
});

// ── 豁免名单不许腐烂 ────────────────────────────────────────────────────────
// 【第五个 bug 就是这个】LEGACY_MISSING_CATEGORY 里挂着「玄女缺武器、赫连铸缺饰品」，
// 但这两人早就被补齐了（carry 全表体检那轮），名单却没跟着删。
// 一份过期的豁免名单比没有更糟：它不再掩盖任何现存问题，却会**静默吞掉未来的回归**
// ——哪天谁把玄女的剑删了，守卫照样绿灯放行。
// 所以豁免名单本身也要被守：登记在册的欠账必须真的还欠着，还清了就得删条目。
describe("历史欠账名单不得腐烂（还清了就要从名单里删掉）", () => {
  const residents = Object.entries(RESIDENT_NPCS).flatMap(([d, a]) => (a || []).map(n => ({ ...n, district: d })));
  const QR = { 白: 0, 绿: 1, 蓝: 2, 紫: 3, 橙: 4, 红: 5 };

  it("LEGACY_MISSING_CATEGORY 空着——三类必备已全员达标", () => {
    const stillBad = residents.filter(n => {
      if (NPC_SIGNATURE_MOVES[n.name]?.unlearnable) return false;
      const cats = new Set((n.carry || []).map(c => c.category));
      return ["weapon", "armor", "accessory"].some(c => !cats.has(c));
    }).map(n => n.name);
    expect(stillBad, `这些人仍缺类别，名单不该是空的：${stillBad.join("、")}`).toEqual([]);
  });

  it("LEGACY_OVERCAP 空着——超档已全部消除", () => {
    const over = [];
    for (const n of residents) {
      const cap = typeof n.levelCap === "number" ? n.levelCap : 5;
      for (const c of n.carry || []) if (QR[c.quality] != null && QR[c.quality] > cap) over.push(`${n.name}「${c.name}」`);
    }
    expect(over, `仍有超档，名单不该是空的：${over.join("、")}`).toEqual([]);
  });

  it("同一人不重复携带同名物件（补 carry 时最容易手滑加重）", () => {
    const dup = [];
    for (const n of residents) {
      const names = (n.carry || []).map(c => c.name);
      const d = [...new Set(names.filter((v, i) => names.indexOf(v) !== i))];
      if (d.length) dup.push(`${n.district}·${n.name}: ${d.join("、")}`);
    }
    expect(dup, `同一人重复携带：\n  ${dup.join("\n  ")}`).toEqual([]);
  });
});

// ── 地上物必须是房间级 ──────────────────────────────────────────────────────
// 此前 GROUND_ITEMS 是据点级的：锦官城 3 件会在它 31 间房每一间都躺着，
// 鱼定村 2 件铺满 19 间，雅江 3 件铺满 15 间——同一块碎石你在城门看见一次、
// 进当铺又看见一次、上钱庄还看见一次。此地之物本该属于某一间屋子。
import { GROUND_ITEMS, GROUND_ITEMS_INNER } from "./groundItems.js";

describe("地上物是房间级，不是据点级", () => {
  it("据点级表已清空——新增地上物写不出据点级", () => {
    expect(Object.keys(GROUND_ITEMS), "GROUND_ITEMS 还有据点级条目").toEqual([]);
  });

  it("每个键都是「据点·房间」，且两截都真实存在", () => {
    const bad = [];
    for (const key of Object.keys(GROUND_ITEMS_INNER)) {
      const [dist, room] = key.split("·");
      if (!dist || !room) { bad.push(`${key} 不是「据点·房间」形状`); continue; }
      if (!INNER_MAP[dist]) { bad.push(`${key} 的据点不存在`); continue; }
      if (!INNER_MAP[dist].rooms?.[room]) bad.push(`${key} 的房间不存在`);
    }
    expect(bad, `地上物的键有问题：\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  it("每条地上物都有名字与描述（左栏那行不能是空白）", () => {
    const bad = [];
    for (const [key, arr] of Object.entries(GROUND_ITEMS_INNER))
      for (const g of arr || []) if (!g?.name || !g?.desc) bad.push(`${key}: ${g?.name || "(无名)"}`);
    expect(bad, `以下地上物缺名字或描述：${bad.join("、")}`).toEqual([]);
  });
});
