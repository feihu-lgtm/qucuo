// 心灵之海 · 五种安抚（从 narratorQuest.js 拆出，纯函数）
// ============================================================================
// ── 五种安抚 ────────────────────────────────────────────────────────────
// weight   这一次做了值多少分（累计分数派生 defenseLevel）
// minLevel 心防降到这一级（含）以下才做得动；高于它就是越级
//
// 【minLevel 是门槛不是建议】越级执行 → 被拒绝，且**不计分**。
// level 5 想抱她只会得到"别碰我"，白费一次。什么时候能做什么让玩家自己摸，
// 不给任何提示——这是这一段最重要的手感，一提示就变成填表了。
export const COMFORT_ACTIONS = {
  verbal:     { label: "说句话",   weight: 1, minLevel: 5, needItem: null },
  food:       { label: "拿块蛋糕", weight: 1, minLevel: 4, needItem: "蛋糕" },
  medication: { label: "喂药",     weight: 2, minLevel: 3, needItem: "抗焦虑药" },
  hug:        { label: "抱住她",   weight: 3, minLevel: 2, needItem: null },
  kiss:       { label: "亲额头",   weight: 3, minLevel: 1, needItem: null },
};

export const emptyComfort = () => ({ verbal: 0, food: 0, medication: 0, hug: 0, kiss: 0 });

// 心防等级由累计安抚分数派生——**不存第二份**。
// 旧稿设计过一个独立的 trust 字段，与 comfort 并存；两处记账必然对不上，砍掉。
export function comfortScore(comfort) {
  const c = { ...emptyComfort(), ...(comfort || {}) };
  return Object.entries(COMFORT_ACTIONS)
    .reduce((sum, [k, spec]) => sum + (Number(c[k]) || 0) * spec.weight, 0);
}

export function defenseLevelOf(comfort) {
  const s = comfortScore(comfort);
  return s >= 24 ? 0 : s >= 16 ? 1 : s >= 10 ? 2 : s >= 5 ? 3 : s >= 2 ? 4 : 5;
}

// 此刻能不能做某个安抚动作。inv 用来判道具（药在卧室药柜、蛋糕在厨房冰柜）。
export function canComfort(actionKey, comfort, invNames = []) {
  const spec = COMFORT_ACTIONS[actionKey];
  if (!spec) return { ok: false, reason: "unknown" };
  const level = defenseLevelOf(comfort);
  if (level > spec.minLevel) return { ok: false, reason: "tooEarly", level, need: spec.minLevel };
  if (spec.needItem && !invNames.includes(spec.needItem)) {
    return { ok: false, reason: "noItem", item: spec.needItem };
  }
  return { ok: true };
}

// 越级/缺物时给玩家看的话。刻意不说"心防还有几级"——不把机制摊开。
export function describeComfortReject(actionKey, reason, extra = {}) {
  if (reason === "noItem") return `你手里没有${extra.item}。`;
  if (reason !== "tooEarly") return "做不到。";
  return {
    food: "她连头都没抬。「……拿走。」",
    medication: "她把你的手推开了。「我不吃那个。」",
    hug: "你刚一伸手，她整个人就缩开了。「别碰我。」",
    kiss: "她偏过头去，肩膀绷得很紧。还不是时候。",
  }[actionKey] || "她没有回应。";
}

// 做成了之后她的反应（本地文本，不调 AI——这些是高频动作，每次都烧一次调用不值当，
// 且写死的反应更稳定、不会因为模型状态好坏而忽冷忽热）。
// 每个动作按当时的心防级别给不同反应：同样是"抱住她"，level 2 和 level 0 不是一回事。
export function comfortResponse(actionKey, levelBefore) {
  const T = {
    verbal: [
      "「……」她没应声。但也没有让你走。",
      "「……吵。」她把脸埋进沙发里。",
      "她睫毛动了一下。「……你还在啊。」",
      "「嗯。」很轻的一声。",
      "「……你说话吧。我听着。」",
    ],
    food: [
      "她看了一眼，没动。",
      "她拿过去，小口小口地吃了。没说话。",
      "「……甜的。」她说。像是自己也意外。",
      "她吃完了，把碟子放在茶几上摆正。",
      "「还有吗。」",
    ],
    medication: [
      "她盯着那瓶药看了很久，才伸手。",
      "她仰头把药吞了，眉头一直皱着。",
      "「……这个我认得。」她说，声音有点抖。「我以前吃过。」",
      "她自己拿了水杯。手比刚才稳。",
      "她摇摇头。「不用了。今天不难受。」",
    ],
    hug: [
      "你抱住她的时候她整个人是僵的。但没有推开。",
      "她的手抓住了你后背的衣料。抓得很紧。",
      "她把额头搁在你肩上，很久没动。你听见她吸了一下鼻子。",
      "她哭了。无声的。你没有说话，让她哭完。",
      "她主动往你怀里靠了靠。「……再一会儿。」",
    ],
    kiss: [
      "——",
      "——",
      "你亲了她的额头。她愣住了，然后耳朵红了。「……你干什么。」",
      "她闭上眼。左眼那道旧疤在光里很浅。",
      "「……再亲一下。」她说。说完自己先把脸转开了。",
    ],
  };
  const arr = T[actionKey] || T.verbal;
  // levelBefore 5→索引0，0→索引4
  const idx = Math.max(0, Math.min(4, 5 - levelBefore));
  return arr[idx];
}
