import { describe, expect, it } from "vitest";
import { getInnerRoom, getPublicInnerRoomNames, isNpcVisibleInInnerRoom } from "../map/innerMap.js";
import { COMPANION_SLOTS } from "../companion/companion.js";
import { describeNpcMove, npcRoamRule, randomStep, stepToward } from "./roam.js";

const importedRegistry = { getImportedResidentNames: () => [] };

const neighborsOf = (district, room) => Object.values(getInnerRoom(district, room).exits);

// 独立的最短步数（与被测的 BFS 无关的朴素实现：逐层扩散）
function shortestSteps(district, from, to, passable) {
  let layer = new Set([from]);
  const seen = new Set(layer);
  for (let steps = 0; layer.size; steps++) {
    if (layer.has(to)) return steps;
    const next = new Set();
    for (const room of layer) {
      for (const dest of neighborsOf(district, room)) {
        if (seen.has(dest) || !getInnerRoom(district, dest)) continue;
        if (dest !== to && !passable.has(dest)) continue;
        seen.add(dest);
        next.add(dest);
      }
    }
    layer = next;
  }
  return Infinity;
}

// 把规则当世界规则 runner 那样调：上一刻 time-1、同一据点。
function tick(state, time, extra = {}) {
  const next = { ...state, time };
  const result = npcRoamRule.run(next, { importedRegistry, firstRun: false, previousDeps: [time - 1, state.room.name], ...extra });
  if (!result) return { state: next, logs: [] };
  return { state: { ...next, room: result.changes.room(next.room) }, logs: result.logs || [] };
}

const baseState = (room, extra = {}) => ({ time: 0, room, flags: [], questProgress: {}, companionState: {}, innerRoomName: null, ...extra });

describe("npc.roam 一步一格", () => {
  it("stepToward 只返回相邻出口，N 步远要 N 次", () => {
    const district = "鱼定村";
    const passable = new Set(getPublicInnerRoomNames(district));
    const total = shortestSteps(district, "村口", "护镖站", passable);
    expect(total).toBeGreaterThan(1);
    let at = "村口";
    let taken = 0;
    while (at !== "护镖站" && taken < 20) {
      const step = stepToward(district, at, "护镖站", passable);
      expect(neighborsOf(district, at)).toContain(step.to);
      at = step.to;
      taken++;
    }
    expect(taken).toBe(total);
  });

  it("随机晃步永远落在相邻房间", () => {
    const passable = new Set(getPublicInnerRoomNames("鱼定村"));
    for (let i = 0; i < 50; i++) {
      const step = randomStep("鱼定村", "村口", passable, () => (i % 10) / 10);
      expect(neighborsOf("鱼定村", "村口")).toContain(step.to);
    }
  });

  it("游走者每一步都落在上一间的邻居，公屏只报玩家视野内的进出", () => {
    // 玩家在村口（innerRoomName null → playerSpot = 据点锚点村口）：
    // 只有进出村口的步子上公屏，别院动静静默。
    let state = baseState({ name: "鱼定村", npcs: [{ name: "路人甲", isPoolNpc: true, innerRoom: "村口" }] });
    let moves = 0;
    const moveTimes = [];
    for (let time = 1; time <= 600; time++) {
      const before = state.room.npcs[0].innerRoom;
      const out = tick(state, time);
      state = out.state;
      const after = state.room.npcs[0].innerRoom;
      if (after !== before) {
        moves++;
        moveTimes.push(time);
        expect(neighborsOf("鱼定村", before)).toContain(after);
        const visible = before === "村口" || after === "村口";
        if (visible) {
          expect(out.logs).toHaveLength(1);
          expect(out.logs[0]).toMatchObject({ t: "sys" });
          expect(out.logs[0].text).toContain("路人甲");
          // 进场文案写来处、离场文案写去向——按方向各断一处
          if (after === "村口") expect(out.logs[0].text).toContain(`「${before}」`);
          else expect(out.logs[0].text).toContain(`「${after}」`);
        } else {
          // W-ROAM 公屏去噪：隔壁街走动静默改坐标
          expect(out.logs).toEqual([]);
        }
      } else {
        expect(out.logs).toEqual([]);
      }
    }
    expect(moves).toBeGreaterThanOrEqual(1);
    // W-ROAM 双重节流：0.08 低概率 + 4 刻最小步距——600 刻移动次数远少于旧制
    expect(moves).toBeLessThan(40);
    // 最小步距：相邻两次移动间隔不小于 4 刻
    for (let i = 1; i < moveTimes.length; i++) {
      expect(moveTimes[i] - moveTimes[i - 1]).toBeGreaterThanOrEqual(4);
    }
  });

  it("W-ROAM 十回合驻足锁：锁期内随机游走与换班一律跳过，过期恢复", () => {
    // 随机游走者被锁：锁到 time+10，期间一步不动
    let state = baseState(
      { name: "鱼定村", npcs: [{ name: "路人甲", isPoolNpc: true, innerRoom: "村口" }] },
      { varTree: { 世界: { 驻足锁: { 路人甲: 11 } } } },
    );
    for (let time = 1; time <= 10; time++) {
      state = tick(state, time).state;
      expect(state.room.npcs[0].innerRoom).toBe("村口");
    }
    // 锁过期后（11 <= time）恢复掷骰——长跑内终会挪窝
    for (let time = 11; time <= 400 && state.room.npcs[0].innerRoom === "村口"; time++) {
      state = tick(state, time).state;
    }
    expect(state.room.npcs[0].innerRoom).not.toBe("村口");
  });

  it("W-ROAM 驻足锁连时段表换班也跳过：兰姐被锁不入夜回楼", () => {
    const state0 = baseState(
      { name: "天都镇", npcs: [{ name: "兰姐", isPoolNpc: true, innerRoom: "玉石料场", schedule: [{ slot: [18, 24], weights: { 天都镇: 1 }, lockInnerRoom: "百花楼" }] }] },
      { varTree: { 世界: { 驻足锁: { 兰姐: 40 } } } },
    );
    let state = state0;
    for (let time = 18; time <= 22; time++) {
      state = tick(state, time).state;
      expect(state.room.npcs[0].innerRoom).toBe("玉石料场");
    }
  });

  it("W-ROAM 主叙事同源感知：视野内进出写入 recentMovements，隔街不入，旧记录清理", () => {
    let state = baseState({ name: "鱼定村", npcs: [{ name: "路人甲", isPoolNpc: true, innerRoom: "村口" }] });
    // 手工注入一条移动：从村口走出去——玩家在村口，应入记录
    let sawRecord = null;
    for (let time = 1; time <= 600 && !sawRecord; time++) {
      const out = tick(state, time);
      state = out.state;
      const rec = (state.room.recentMovements || []).find((m) => m.name === "路人甲");
      if (rec) sawRecord = rec;
    }
    expect(sawRecord).toBeTruthy();
    expect(["arrive", "depart"]).toContain(sawRecord.kind);
    expect(sawRecord.from).toBeTruthy();
    expect(sawRecord.to).toBeTruthy();
    // 记录只留最近一刻：很旧的条目会被清掉
    for (const m of state.room.recentMovements || []) {
      expect(m.turn).toBeGreaterThanOrEqual(state.time - 1);
    }
  });

  it("日志按玩家所在房间换说法：离开此处 / 走了进来", () => {
    let state = baseState({ name: "鱼定村", npcs: [{ name: "路人甲", isPoolNpc: true, innerRoom: "村口" }] }, { innerRoomName: "村口" });
    let left;
    for (let time = 1; time <= 100 && !left; time++) {
      const out = tick(state, time);
      state = out.state;
      if (out.logs.length) left = out.logs[0].text;
    }
    expect(left).toMatch(/^ {2}路人甲转身离开此处，往.朝「.+」去了。$/);
    const step = { dir: "e", to: "歇马居" };
    expect(describeNpcMove("路人甲", "村口", step, "歇马居")).toBe("  脚步声近，路人甲从「村口」走了过来。");
    expect(describeNpcMove("路人甲", "村口", step, null)).toBe("  路人甲从「村口」往东去了「歇马居」。");
  });

  it("兰姐入夜从赌石坊一步步走回百花楼：N 步远要 N 刻，每刻一行日志", () => {
    const district = "天都镇";
    const passable = new Set(getPublicInnerRoomNames(district));
    const total = shortestSteps(district, "玉石料场", "百花楼", passable);
    expect(total).toBeGreaterThan(1);
    let state = baseState({ name: district, npcs: [{ name: "兰姐", isPoolNpc: true, innerRoom: "玉石料场" }] });
    let ticks = 0;
    for (let time = 18; time < 18 + 12 && state.room.npcs[0].innerRoom !== "百花楼"; time++) {
      const before = state.room.npcs[0].innerRoom;
      const out = tick(state, time);
      state = out.state;
      ticks++;
      expect(neighborsOf(district, before)).toContain(state.room.npcs[0].innerRoom);
      // W-ROAM 公屏去噪：不进出玩家视野房的步子静默——兰姐走回百花楼沿途不经过
      // 玩家所在处时不再逐刻刷屏，日志可有可无但不许超过一行
      expect(out.logs.length).toBeLessThanOrEqual(1);
      if (out.logs.length) expect(out.logs[0].text).toContain("兰姐");
    }
    expect(state.room.npcs[0].innerRoom).toBe("百花楼");
    expect(ticks).toBe(total);
    // 到了就不再动、不再写日志
    expect(tick(state, 18 + ticks).logs).toEqual([]);
  });

  it("兰姐白天不被绑定房间钉死在百花楼：走到赌石坊后在那里可见", () => {
    const state = baseState({ name: "天都镇", npcs: [{ name: "兰姐", isPoolNpc: true, innerRoom: "百花楼" }] });
    // 08:00 起落点改成玉石料场；老存档的兰姐没带 schedule，首刻会补上
    let cur = state;
    for (let time = 8; time < 30 && cur.room.npcs[0].innerRoom !== "玉石料场"; time++) cur = tick(cur, time).state;
    const lanjie = cur.room.npcs[0];
    expect(lanjie.innerRoom).toBe("玉石料场");
    expect(Array.isArray(lanjie.schedule)).toBe(true);
    expect(isNpcVisibleInInnerRoom("天都镇", "玉石料场", lanjie)).toBe(true);
    expect(isNpcVisibleInInnerRoom("天都镇", "百花楼", lanjie)).toBe(false);
  });

  it("入队伙伴、驻场、被追的人、锁房竞价者、AI 生成的人都不走", () => {
    const slot = COMPANION_SLOTS[0];
    const companionState = { [slot.key]: { unlocked: true, data: { name: slot.label } } };
    const npcs = [
      { name: slot.label, isPoolNpc: true, innerRoom: "村口" },
      { name: "周铭章", isPoolNpc: true, innerRoom: "鱼定商号" },
      { name: "追兵", isPoolNpc: true, innerRoom: "村口", pursuitInnerRoom: "村口" },
      { name: "竞价者", isPoolNpc: true, innerRoom: "村口", lockInnerRoom: "村口" },
      { name: "AI路人", innerRoom: "村口" },
    ];
    let state = baseState({ name: "鱼定村", npcs }, { companionState });
    for (let time = 1; time <= 200; time++) state = tick(state, time).state;
    expect(state.room.npcs.map((n) => n.innerRoom)).toEqual(["村口", "鱼定商号", "村口", "村口", "村口"]);
  });

  it("刚进据点、时间没动、首跑都不走", () => {
    const state = baseState({ name: "鱼定村", npcs: [{ name: "路人甲", isPoolNpc: true, innerRoom: "村口" }] });
    for (let time = 1; time <= 100; time++) {
      expect(npcRoamRule.run({ ...state, time }, { importedRegistry, firstRun: false, previousDeps: [time - 1, "锦官城"] })).toBeNull();
      expect(npcRoamRule.run({ ...state, time }, { importedRegistry, firstRun: false, previousDeps: [time, "鱼定村"] })).toBeNull();
      expect(npcRoamRule.run({ ...state, time }, { importedRegistry, firstRun: true, previousDeps: undefined })).toBeNull();
    }
  });
});
