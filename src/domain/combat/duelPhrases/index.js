import attack from "./attack.js";
import defense from "./defense.js";
import status from "./status.js";
import lightness from "./lightness.js";
import internal from "./internal.js";

export const DUEL_MOVE_TYPES = ["攻击", "防御", "状态", "轻功", "内功"];
export const DUEL_OUTCOMES = ["hit", "blocked", "dodged", "heal", "bothHit", "control", "dot"];
export const DUEL_HP_BANDS = ["healthy", "hurt", "nearDown"];

const phrasesByType = {
  攻击: attack,
  防御: defense,
  状态: status,
  轻功: lightness,
  内功: internal,
};

const hpTones = {
  healthy: ["，{target}晃肩浑若无事", "，{target}稳住身形恍若无伤", "，{target}拂衣如常"],
  hurt: ["，{target}身形一晃气息微乱", "，{target}踉跄半步神色微凝", "，{target}肩头一震难掩吃力"],
  nearDown: ["，{target}脚下踉跄眼看就要倒下", "，{target}摇摇欲坠几乎站不住", "，{target}膝头发软勉强支身"],
};

const dodgeTones = {
  healthy: ["，{actor}身轻如燕安然避过", "，{actor}衣袂轻扬稳稳落地", "，{actor}气定神闲未伤分毫"],
  hurt: ["，{actor}落地微晃仍稳住身形", "，{actor}气息略促才站定脚跟", "，{actor}踉跄半步终究避开"],
  nearDown: ["，{actor}险险站稳几乎失势", "，{actor}摇摇欲坠仍躲过一招", "，{actor}勉强支身未再受创"],
};

const recoveryTones = {
  healthy: ["，气机流转渐归平和", "，内息如泉重新周流", "，真元循脉缓缓归位"],
  hurt: ["，气息渐匀稍稍缓过", "，周身真气重新接续", "，脉息渐稳仍需调理"],
  nearDown: ["，气息稍复勉强支身", "，真元回转暂稳心脉", "，仍需提气站稳脚跟"],
};

const controlTones = {
  healthy: ["，对方气机略滞", "，只见衣袂微微一顿", "，对方步势稍缓"],
  hurt: ["，对方呼吸一窒", "，其势微乱难以续招", "，一缕劲意仍缠经脉"],
  nearDown: ["，对方勉强稳住身形", "，其气机迟滞难舒", "，对方脚步一顿"],
};

const toneSets = {
  hit: hpTones, blocked: hpTones, bothHit: hpTones,
  dodged: dodgeTones, heal: recoveryTones, control: controlTones, dot: hpTones,
};

export const DUEL_PHRASE_BANK = Object.fromEntries(DUEL_MOVE_TYPES.map((type) => [
  type,
  Object.fromEntries(DUEL_OUTCOMES.map((outcome) => [
    outcome,
    Object.fromEntries(DUEL_HP_BANDS.map((band) => [
      band,
      phrasesByType[type][outcome].map((template, index) => (
        `${template}${toneSets[outcome][band][index % toneSets[outcome][band].length]}`
      )),
    ])),
  ])),
]));

export function hpBandFor(hp) {
  const [current, maximum] = Array.isArray(hp) ? hp : [];
  if (!(maximum > 0) || !Number.isFinite(current)) return "healthy";
  const ratio = current / maximum;
  return ratio < 0.25 ? "nearDown" : ratio < 0.6 ? "hurt" : "healthy";
}
