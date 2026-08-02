import { describe, it, expect } from "vitest";
import { SAFE_HOUSES, SAFE_HOUSE_KEYS, invHasItemNamed, isSafeHouseOpen, ownedSafeHouseKeys, makeTusiRobe } from "./safeHouse.js";
import { QUCUO_QUESTS } from "./quests/qucuoQuests.js";
import { QUEST_TYPE } from "./quests/questTypes.js";
import { getInnerRoom, visibleInnerExits, isInnerExitUnlocked, getInnerRoomNames } from "./innerMap.js";
import { tryInnerMove } from "./act/innerMove.js";

// 这套测试钉的是「没钥匙就是进不去」。背景：unlockCondition 字段在 innerMap.js
// 里躺了很久但从没被真正用过（它自己的注释都写着"本轮鱼定村切片没有隐藏房间用到
// 这个函数"），四条读出口的路径里有三条压根不看它——左栏九宫格、放大地图、
// 以及真正决定能不能走的 tryInnerMove 全是裸查表。四栋安全屋上线时若不补这三处，
// 锁就只是到达描述里的一句话，玩家点一下九宫格照样进屋。

const KEYLESS = { questProgress: {}, flags: [], inv: [] };

describe("四栋安全屋都已挂上钥匙锁", () => {
  it.each(SAFE_HOUSES)("$district·$label 存在且锁的是「$keyName」", ({ district, room, keyName }) => {
    const r = getInnerRoom(district, room);
    expect(r, `${district}·${room} 未注册`).toBeTruthy();
    expect(r.unlockCondition).toEqual({ type: "item", itemName: keyName });
  });

  it("四把钥匙的名字与四栋房子的锁一一对上", () => {
    const lockNames = SAFE_HOUSES.map(h => h.keyName).sort();
    const keyNames = SAFE_HOUSE_KEYS.map(k => k.name).sort();
    expect(lockNames).toEqual(keyNames);
  });

  it("钥匙一律 misc 分类 + 中文品阶（equipment.js 没有 quest 类）", () => {
    for (const k of SAFE_HOUSE_KEYS) {
      expect(k.category).toBe("misc");
      expect(["白", "绿", "蓝", "紫", "橙", "红"]).toContain(k.quality);
    }
  });
});

describe("没钥匙：三条路径都必须拦住", () => {
  it.each(SAFE_HOUSES)("$label · 出口列表里不出现", ({ district, room }) => {
    const parentDir = Object.entries(getInnerRoom(district, room).exits)[0];
    const parent = parentDir[1];
    const visible = visibleInnerExits(district, parent, KEYLESS);
    expect(Object.values(visible)).not.toContain(room);
  });

  it.each(SAFE_HOUSES)("$label · 放大地图的房间列表里不出现", ({ district, room }) => {
    const listed = getInnerRoomNames(district).filter(rn => {
      const rr = getInnerRoom(district, rn);
      return !rr?.unlockCondition || isInnerExitUnlocked(rr.unlockCondition, KEYLESS);
    });
    expect(listed).not.toContain(room);
  });

  it.each(SAFE_HOUSES)("$label · 硬走这个方向会被 tryInnerMove 挡下", ({ district, room }) => {
    const [dirIntoParent, parent] = Object.entries(getInnerRoom(district, room).exits)[0];
    // 房子里朝 dirIntoParent 出去是父房间；反过来找父房间朝哪个方向进这栋房子
    const dirIn = Object.entries(getInnerRoom(district, parent).exits).find(([, d]) => d === room)?.[0];
    expect(dirIn, `${parent} 没有通向 ${room} 的出口`).toBeTruthy();
    const res = tryInnerMove({
      _trace: null, isTalk: false, movingDir: dirIn, forceLayer: "inner",
      room: { name: district, npcs: [] }, innerRoomName: parent,
      flags: [], varTree: {}, questProgress: {}, inv: [],
    });
    expect(res?.kind).toBe("blocked");
    expect(res.lockedMsg).toContain("没有");
  });
});

describe("拿到钥匙：门就开了", () => {
  it.each(SAFE_HOUSES)("$label · 出口出现且能走进去", ({ district, room, keyName }) => {
    const withKey = { questProgress: {}, flags: [], inv: [{ name: keyName, category: "misc", quality: "白" }] };
    const [, parent] = Object.entries(getInnerRoom(district, room).exits)[0];
    const dirIn = Object.entries(getInnerRoom(district, parent).exits).find(([, d]) => d === room)[0];

    expect(Object.values(visibleInnerExits(district, parent, withKey))).toContain(room);

    const res = tryInnerMove({
      _trace: null, isTalk: false, movingDir: dirIn, forceLayer: "inner",
      room: { name: district, npcs: [] }, innerRoomName: parent,
      flags: [], varTree: {}, questProgress: {}, inv: withKey.inv,
    });
    expect(res?.kind).toBe("move");
    expect(res.innerDest).toBe(room);
  });
});

describe("背包读取兼容字符串与对象两种形态", () => {
  it("字符串条目也能认出钥匙", () => {
    expect(invHasItemNamed(["溪边小屋钥匙"], "溪边小屋钥匙")).toBe(true);
  });
  it("对象条目同样认得", () => {
    expect(invHasItemNamed([{ name: "溪边小屋钥匙" }], "溪边小屋钥匙")).toBe(true);
  });
  it("空背包/脏数据不炸", () => {
    expect(invHasItemNamed(null, "溪边小屋钥匙")).toBe(false);
    expect(invHasItemNamed([null, undefined, 0], "溪边小屋钥匙")).toBe(false);
    expect(invHasItemNamed([{ name: "溪边小屋钥匙" }], "")).toBe(false);
  });
  it("isSafeHouseOpen 按据点判定", () => {
    expect(isSafeHouseOpen("鱼定村", [{ name: "溪边小屋钥匙" }])).toBe(true);
    expect(isSafeHouseOpen("鱼定村", [{ name: "衔尾蛇门环" }])).toBe(false);
    expect(isSafeHouseOpen("不存在的地方", [])).toBe(false);
  });
});

// ── 四种获取方式 × 四把锁 的对账 ─────────────────────────────────────────
// 这四条是整套安全屋最脆的地方：钥匙名字在五个文件里各写了一遍（锁在
// innerMap、发放在 presets/residentNpcs/sectEntry/auction），任何一处错一个字，
// 玩家就会拿到一把"看起来对但开不了门"的钥匙，而且不报错、无从排查。
import { QUCUO_PRESET } from "./presets/qucuo.js";
import { getResidentNpcs } from "./residentNpcs.js";
import { SECT_ENTRY } from "./sectEntry.js";
import { AUCTION_LOT } from "./auction.js";

const lockOf = (district) => SAFE_HOUSES.find(h => h.district === district).keyName;

describe("获取方式产出的钥匙名 必须与锁逐字一致", () => {
  it("鱼定村：开局背包里就有溪边小屋钥匙", () => {
    const names = QUCUO_PRESET.inv.map(i => (typeof i === "string" ? i : i.name));
    expect(names).toContain(lockOf("鱼定村"));
  });

  it("天都镇：赫连铸必掉的正是银灰色钥匙", () => {
    const hz = getResidentNpcs("天都镇").find(n => n.name === "赫连铸");
    expect(hz, "赫连铸未注册为天都镇驻场NPC").toBeTruthy();
    expect(hz.guaranteedDrop?.name).toBe(lockOf("天都镇"));
    expect(hz.guaranteedDrop.category).toBe("misc");
  });

  it("雪山派：拜入门派发的令牌正是别院钥匙", () => {
    expect(SECT_ENTRY.keyName).toBe(lockOf("雪山派"));
  });

  it("锦官城：拍卖拍品正是蜀王庄的门环", () => {
    expect(AUCTION_LOT.name).toBe(lockOf("锦官城"));
  });

  it("开局只带第一把钥匙，另外三把必须自己挣", () => {
    const names = QUCUO_PRESET.inv.map(i => (typeof i === "string" ? i : i.name));
    for (const d of ["天都镇", "雪山派", "锦官城"]) {
      expect(names).not.toContain(lockOf(d));
    }
  });
});

describe("ownedSafeHouseKeys：按背包持有数计数", () => {
  it("空背包 0 把；开局只有溪边小屋钥匙 1 把", () => {
    expect(ownedSafeHouseKeys([])).toHaveLength(0);
    expect(ownedSafeHouseKeys([{ name: "溪边小屋钥匙", category: "misc" }])).toHaveLength(1);
  });

  it("集齐四把为 4（任意顺序都认，字符串物品也认）", () => {
    const inv = ["溪边小屋钥匙", "银灰色钥匙", "雪山派令牌钥匙", "衔尾蛇门环"];
    expect(ownedSafeHouseKeys(inv)).toHaveLength(4);
  });
});

describe("土司礼服 makeTusiRobe：四宅家产任务的收官奖励", () => {
  const robe = makeTusiRobe();
  it("橙档护甲，七维各 +1", () => {
    expect(robe.category).toBe("armor");
    expect(robe.quality).toBe("橙");
    expect(robe.sixDim).toEqual({ 根骨: 1, 悟性: 1, 体魄: 1, 魅力: 1, 智谋: 1, 身法: 1, 气运: 1 });
  });

  it("护甲数值按橙档走（有 def），且是独立实例（两次调用不共享 id）", () => {
    expect(robe.def).toBeGreaterThan(0);
    expect(makeTusiRobe().id).not.toBe(robe.id);
  });

  it("描述点出「四份家产」的来由", () => {
    expect(robe.desc).toContain("四份家产");
  });
});

describe("教程任务「四宅家产」定义自洽", () => {
  const quest = QUCUO_QUESTS.find(q => q.id === "tutorial_four_estates");
  it("存在且是 COLLECT 四把钥匙", () => {
    expect(quest).toBeTruthy();
    expect(quest.type).toBe(QUEST_TYPE.COLLECT);
    expect(quest.requiredCount).toBe(4);
    expect(quest.giver).toBeNull(); // 自驱寻宝，没有委托人
  });

  it("四阶段与四把钥匙一一对应，且不靠 completionFlag 推进（由 watcher 按持有数驱动）", () => {
    expect(quest.stages).toHaveLength(4);
    for (const s of quest.stages) expect(s.completionFlag).toBeUndefined();
  });

  it("奖励文案点出土司礼服", () => {
    expect(quest.rewardText).toContain("土司礼服");
  });
});
