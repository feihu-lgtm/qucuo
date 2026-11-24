// 地宫谜题四模板引擎（设计稿 docs/设计_地宫内层地图.md A 节）：
//   sequenceReset 序列复位 / recipeCraft 配方合成 / pushPull 力量推拉 / timedAgility 时机敏捷。
// 每个 make 工厂产出统一接口：
//   { type, prompt, actions(state), applyAction(input, state, attrs) -> {done,fail,reset,log,state} }
// 判定一律走 calcDungeonCheckRate（clamp(35+(属性-DC)*12, 15, 95)）。
// 输入双通道：按钮确定动作（applyAction 吃结构化 input）+ 自由文本（parseIntent 关键词映射，
//   返回 null 时交由上层 AI 意图识别接管）。

import { calcDungeonCheckRate } from "./internal.js";
import { random } from "../../../utils/rng.js";

function roll(rate) {
  return random() * 100 < rate;
}

// ---------- 序列复位 ----------
// config: { items: [正确顺序], prompt, dc, stat, maxAttempts? }
export function makeSequenceReset(config) {
  const order = [...config.items];
  const shuffle = [...config.items].sort(() => random() - 0.5);
  return {
    type: "sequenceReset",
    prompt: config.prompt,
    state: { current: shuffle, correct: order, attempts: 0 },
    actions() {
      return ["提交顺序", "查看线索"];
    },
    parseIntent(text) {
      const m = String(text).match(/[:：,，、\s]/);
      if (m || /^\S+$/.test(text.trim())) {
        const parts = text.split(/[:：,，、\s]+/).filter(Boolean);
        if (parts.length === order.length) return { kind: "submit", order: parts };
      }
      return null;
    },
    applyAction(input, state, attrs = {}) {
      if (input.kind === "hint") return { done: false, fail: false, log: config.hint || "线索不明。", state };
      const submitted = input.order || [];
      const ok = submitted.length === order.length && submitted.every((x, i) => x === order[i]);
      if (ok) {
        return { done: true, fail: false, log: config.successLog || "顺序对了，机关应声而开。", state };
      }
      const rate = calcDungeonCheckRate(attrs[config.stat] ?? 5, config.dc ?? 5);
      const partial = roll(rate);
      const attempts = state.attempts + 1;
      return {
        done: false,
        fail: false,
        reset: true,
        log: partial
          ? "隐约觉得顺序接近了，机关卡顿了一下又弹回。"
          : "机关轰然复位，一切重来。" + (config.failExtraLog || ""),
        state: { ...state, attempts },
      };
    },
  };
}

// ---------- 配方合成 ----------
// config: { recipe: {materials: [必须材料], action: "点火|涂抹|投入" 等指令词},
//           materials: [可选材料池], dc, stat, prompt }
export function makeRecipeCraft(config) {
  return {
    type: "recipeCraft",
    prompt: config.prompt,
    state: { used: [] },
    actions(state) {
      const left = config.materials.filter((m) => !state.used.includes(m));
      return left.map((m) => `使用 ${m}`).concat(["合成"]);
    },
    parseIntent(text) {
      const t = String(text);
      const mats = config.materials.filter((m) => t.includes(m));
      const hasAction = config.recipe.action && t.includes(config.recipe.action);
      if (hasAction || /合成|炼|煮|涂|投/.test(t)) return { kind: "craft", materials: mats };
      if (mats.length) return { kind: "use", material: mats[0] };
      return null;
    },
    applyAction(input, state, attrs = {}) {
      if (input.kind === "use") {
        const used = state.used.includes(input.material) ? state.used : [...state.used, input.material];
        return { done: false, fail: false, log: `取出了${input.material}。`, state: { used } };
      }
      if (input.kind === "craft") {
        const mats = input.materials?.length ? input.materials : state.used;
        const missing = config.recipe.materials.filter((m) => !mats.includes(m));
        if (missing.length) {
          return {
            done: false,
            fail: true,
            reset: true,
            log: `材料不对：缺了${missing.join("、")}，配方作废。`,
            state: { used: [] },
          };
        }
        const rate = calcDungeonCheckRate(attrs[config.stat] ?? 5, config.dc ?? 5);
        if (roll(rate)) {
          return { done: true, fail: false, log: config.successLog || "合成成功。", state };
        }
        return {
          done: false,
          fail: true,
          reset: true,
          log: config.failLog || "火候不对，材料尽毁。",
          state: { used: [] },
        };
      }
      return { done: false, fail: false, log: "无从下手。", state };
    },
  };
}

// ---------- 力量推拉 ----------
// config: { size: 3, target: {x,y}, start: {x,y}, dc, stat, prompt }
export function makePushPull(config) {
  const size = config.size || 3;
  const inBounds = (p) => p.x >= 0 && p.x < size && p.y >= 0 && p.y < size;
  const dirs = {
    n: { x: 0, y: -1 }, s: { x: 0, y: 1 }, e: { x: 1, y: 0 }, w: { x: -1, y: 0 },
    上: { x: 0, y: -1 }, 下: { x: 0, y: 1 }, 左: { x: -1, y: 0 }, 右: { x: 1, y: 0 },
  };
  return {
    type: "pushPull",
    prompt: config.prompt,
    state: { pos: { ...config.start }, target: { ...config.target }, moves: 0 },
    actions() {
      return ["推向北", "推向南", "推向东", "推向西"];
    },
    parseIntent(text) {
      const t = String(text);
      if (/北|上|前|up/i.test(t)) return { kind: "push", dir: "n" };
      if (/南|下|后|down/i.test(t)) return { kind: "push", dir: "s" };
      if (/东|右|east|right/i.test(t)) return { kind: "push", dir: "e" };
      if (/西|左|west|left/i.test(t)) return { kind: "push", dir: "w" };
      return null;
    },
    applyAction(input, state, attrs = {}) {
      if (input.kind !== "push") return { done: false, fail: false, log: "使不上力。", state };
      const d = dirs[input.dir];
      const np = { x: state.pos.x + d.x, y: state.pos.y + d.y };
      if (!inBounds(np)) {
        return {
          done: false,
          fail: true,
          log: "卡死了——这个方向推不动，只能换个方向。",
          state: { ...state, moves: state.moves + 1 },
        };
      }
      const rate = calcDungeonCheckRate(attrs[config.stat] ?? 5, config.dc ?? 5);
      if (!roll(rate)) {
        return {
          done: false,
          fail: false,
          log: "力气不够，石像纹丝不动，手滑脱了力。",
          state: { ...state, moves: state.moves + 1 },
        };
      }
      const done = np.x === state.target.x && np.y === state.target.y;
      return {
        done,
        fail: false,
        log: done ? (config.successLog || "轰然入槽，机关解开了。") : "石像挪动了一格。",
        state: { ...state, pos: np, moves: state.moves + 1 },
      };
    },
  };
}

// ---------- 时机敏捷 ----------
// config: { dc, stat, windows: ["风停","浪歇"], prompt } — 上层在适当时机给出窗口提示，
// 玩家输入"过/走/穿"等动作指令判定敏捷。
export function makeTimedAgility(config) {
  return {
    type: "timedAgility",
    prompt: config.prompt,
    state: { windowOpen: false, tries: 0 },
    actions(state) {
      return state.windowOpen ? ["冲过去"] : ["等待时机", "冒险硬闯"];
    },
    parseIntent(text) {
      const t = String(text);
      if (/过|冲|走|穿|跳|闯/.test(t)) return { kind: "go" };
      if (/等|停|候/.test(t)) return { kind: "wait" };
      return null;
    },
    applyAction(input, state, attrs = {}) {
      if (input.kind === "wait") {
        return { done: false, fail: false, log: "你屏息等待，风口暂歇的刹那将至。", state: { ...state, windowOpen: true } };
      }
      if (input.kind === "go" || input.kind === "dash") {
        const dc = state.windowOpen ? config.dc : (config.dc ?? 5) + 3;
        const rate = calcDungeonCheckRate(attrs[config.stat] ?? 5, dc);
        const tries = state.tries + 1;
        if (roll(rate)) {
          return { done: true, fail: false, log: config.successLog || "抓住空隙，一跃而过。", state: { ...state, tries } };
        }
        return {
          done: false,
          fail: true,
          log: config.failLog || "时机错了，险象环生，只得退回。",
          state: { ...state, tries, windowOpen: false },
        };
      }
      return { done: false, fail: false, log: "举棋不定。", state };
    },
  };
}

export const PUZZLE_FACTORIES = Object.freeze({
  sequenceReset: makeSequenceReset,
  recipeCraft: makeRecipeCraft,
  pushPull: makePushPull,
  timedAgility: makeTimedAgility,
});

export function makePuzzle(type, config) {
  const f = PUZZLE_FACTORIES[type];
  if (!f) throw new Error(`未知谜题模板: ${type}`);
  return f(config);
}
