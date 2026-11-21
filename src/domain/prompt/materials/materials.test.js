import { describe, it, expect } from "vitest";
import {
  MATERIALS,
  pickMaterials,
  playerLine,
  lastTurn,
  recentTurns,
  presentNpcs,
  targetProfile,
  items,
  venue,
  targetLedger,
  distantView,
  infoDomain,
  recall,
} from "./index.js";

// 内层房间名取自 domain/map/innerMap.js 里鱼定村的真实房间，
// 常驻绑定走 residentNpcs.js 的真实绑定（才旦绑自家院落等）。
const base = () => ({
  cmd: "向才旦赔礼",
  varTree: {
    角色: {
      才旦: {
        好感度: 42,
        态度: "心存芥蒂",
        生气状态: { active: true, reason: "偷窃未遂", turnsLeft: 2 },
        旧账: { lines: ["少侠曾偷她柜台上的银簪，被当场撞破。", "上月替她挡下醉汉纠缠。"], updatedTurn: 88 },
      },
    },
    世界: {
      已认识人物: ["才旦"],
      日总结: [
        { label: "前日", text: "少侠在鱼定村歇脚。" },
        { label: "昨日", text: "少侠随商队去了趟雪山口。" },
      ],
    },
  },
  room: {
    name: "鱼定村",
    desc: "村口立着一块褪色的界石，三条溪流在此交汇。",
    npcs: [
      { name: "才旦", id: "resident_caidan", levelCap: 1, brief: "村长之女，账算得滴水不漏", innerRoom: "才旦家",
        carriedItems: [{ name: "藏银簪", category: "accessory", quality: "绿", desc: "簪头錾着一朵小小的格桑花" }, { name: "旧账本", category: "misc", quality: "白", desc: "密密麻麻记满了村里的进出账" }] },
      { name: "老孙", id: "resident_laosun", levelCap: 1, brief: "老孙饭馆的掌柜", innerRoom: "老孙饭馆" },
      { name: "卓玛", id: "npc_zhuoma", levelCap: 2, brief: "游方行医的女子", innerRoom: "才旦家" },
    ],
    items: [
      { name: "半袋青稞", category: "misc", quality: "白", desc: "袋口松松扎着，散出炒过的谷香" },
      "一把生锈的镰刀",
    ],
  },
  innerRoomName: "才旦家",
  inv: [
    { name: "雪莲", category: "misc", quality: "蓝", desc: "崖上采的，花瓣还凝着霜" },
    { name: "短刀", category: "weapon", quality: "绿", desc: "寻常铁匠打的防身短刃", equipped: true },
  ],
  mainConvo: [
    { role: "user", content: "环顾四周" },
    { role: "assistant", content: "院子里晾着几件浆洗过的衣裳，才旦正坐在廊下打算盘。" },
    { role: "user", content: "看看她的脸色" },
    { role: "assistant", content: "她抬眼瞥见你，算盘珠停了一瞬，又低下头去。" },
    { role: "user", content: "向才旦赔礼" },
  ],
  target: "才旦",
  infoDomainBlock: "\n\n[信息域] 才旦只知道你赔过礼这事，不晓得你袖里的雪莲。",
  recallBlock: "\n\n[想起] 她从前最爱吃你捎的炒面。",
});

describe("材料库", () => {
  it("playerLine 原样带上玩家输入，无输入为空", () => {
    expect(playerLine(base())).toBe("【玩家这句话】向才旦赔礼");
    expect(playerLine({ ...base(), cmd: "" })).toBe("");
    expect(playerLine({})).toBe("");
  });

  it("lastTurn 取最后一轮玩家句+引擎回复并截短", () => {
    const block = lastTurn(base());
    expect(block).toContain("【上一轮】");
    expect(block).toContain("玩家：向才旦赔礼");
    expect(block).toContain("引擎：她抬眼瞥见你");
    const longCmd = { ...base(), mainConvo: [{ role: "user", content: "长".repeat(200) }] };
    expect(lastTurn(longCmd)).toContain("…");
    expect(lastTurn({})).toBe("");
  });

  it("recentTurns 默认取最近 3 轮，可自定义轮数", () => {
    const block = recentTurns()(base());
    expect(block).toContain("【最近3轮】");
    expect(block).toContain("玩家：环顾四周");
    expect(block.match(/玩家：/g).length).toBe(3);
    const one = recentTurns(1)(base());
    expect(one).toContain("【最近1轮】");
    expect(one).toContain("玩家：向才旦赔礼");
    expect(one).not.toContain("玩家：环顾四周");
    expect(recentTurns()({})).toBe("");
  });

  it("presentNpcs 只列当前内层房间可见的人", () => {
    const block = presentNpcs(base());
    expect(block).toContain("才旦");
    expect(block).toContain("卓玛");
    expect(block).not.toContain("老孙"); // 老孙绑在饭馆，不在才旦家
    const empty = { ...base(), room: { ...base().room, npcs: [base().room.npcs[1]] } };
    expect(presentNpcs(empty)).toBe("");
  });

  it("targetProfile 拼名字/简介/品阶/关系/生气状态", () => {
    const block = targetProfile(base());
    expect(block).toContain("名字：才旦");
    expect(block).toContain("简介：村长之女");
    expect(block).toContain("品阶：绿档");
    expect(block).toContain("好感度42");
    expect(block).toContain("心存芥蒂");
    expect(block).toContain("正在生气");
    expect(block).toContain("偷窃未遂");
  });

  it("targetProfile 对不相识的人写尚不相识，无目标为空", () => {
    const stranger = {
      ...base(),
      target: { name: "卓玛", brief: "游方行医的女子", levelCap: 2 },
    };
    const block = targetProfile(stranger);
    expect(block).toContain("尚不相识");
    expect(block).toContain("品阶：蓝档");
    expect(targetProfile({ ...base(), target: null, settleNpc: null })).toBe("");
  });

  it("items 分三组，每件只有名字/归属/类别品阶/外观四样", () => {
    const block = items(base());
    expect(block).toContain("对方身上：");
    expect(block).toContain("我身上：");
    expect(block).toContain("地上：");
    expect(block).toContain("藏银簪（对方，饰品·绿档，簪头錾着一朵小小的格桑花）");
    expect(block).toContain("雪莲（我，杂物·蓝档，崖上采的，花瓣还凝着霜）");
    expect(block).toContain("半袋青稞（地上，杂物·白档");
    expect(block).toContain("一把生锈的镰刀（地上，杂物）");
    expect(block).not.toMatch(/\d+两|atk|def/); // 不许有数值
  });

  it("items 空空如也返回空串；被偷的不列", () => {
    expect(items({})).toBe("");
    const s = base();
    s.target = { name: "才旦", carriedItems: [{ name: "赃物", stolen: true }] };
    s.inv = [];
    s.room.items = [];
    expect(items(s)).toBe("");
  });

  it("venue 用据点·内层名并保留房间描述原文", () => {
    const block = venue(base());
    expect(block).toContain("【场地】鱼定村·才旦家");
    expect(block).toContain("村口立着一块褪色的界石");
    expect(venue({})).toBe("");
    const noInner = { ...base(), innerRoomName: "" };
    expect(venue(noInner)).toContain("【场地】鱼定村");
    expect(venue(noInner)).not.toContain("鱼定村·");
  });

  it("targetLedger 读 旧账.lines，缺字段/无目标都安全为空", () => {
    const block = targetLedger(base());
    expect(block).toContain("【和对方的旧账】");
    expect(block).toContain("银簪");
    const noLedger = { ...base(), varTree: { 角色: { 才旦: {} } } };
    expect(targetLedger(noLedger)).toBe("");
    expect(targetLedger({ ...base(), target: null, settleNpc: null })).toBe("");
    expect(targetLedger({ varTree: {} })).toBe("");
  });

  it("distantView 复用日总结块，无日总结为空", () => {
    const block = distantView(base());
    expect(block).toContain("远景");
    expect(block).toContain("前日");
    expect(block).toContain("雪山口");
    expect(distantView({ varTree: { 世界: {} } })).toBe("");
    expect(distantView({})).toBe("");
  });

  it("infoDomain / recall 原样透传快照里算好的块", () => {
    expect(infoDomain(base())).toContain("信息域");
    expect(recall(base())).toContain("想起");
    expect(infoDomain({})).toBe("");
    expect(recall({})).toBe("");
  });

  it("pickMaterials 按声明顺序拼接并跳过空块", () => {
    const snap = base();
    snap.infoDomainBlock = "";
    const out = pickMaterials(["playerLine", "presentNpcs", "infoDomain", "venue"], snap);
    expect(out.indexOf("玩家这句话")).toBeLessThan(out.indexOf("在场"));
    expect(out.indexOf("在场")).toBeLessThan(out.indexOf("场地"));
    expect(out).not.toContain("信息域");
    expect(pickMaterials([], snap)).toBe("");
    expect(pickMaterials(["presentNpcs"], { room: { name: "鱼定村", npcs: [] } })).toBe("");
  });

  it("pickMaterials 支持函数项（自定义参数的 recentTurns）", () => {
    const out = pickMaterials([recentTurns(1)], base());
    expect(out).toContain("【最近1轮】");
  });

  it("MATERIALS 登记表每个 id 都能产出字符串", () => {
    const snap = base();
    for (const [id, fn] of Object.entries(MATERIALS)) {
      expect(typeof fn(snap), `${id} 应返回字符串`).toBe("string");
      expect(fn(snap).length, `${id} 在本夹具里不该为空`).toBeGreaterThan(0);
    }
    expect(() => pickMaterials(["不存在的"], snap)).toThrow();
  });
});
