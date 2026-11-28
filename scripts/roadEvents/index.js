// 路遇随机事件总表：20 类 × 20 件 = 400 件。类别与提示词模板见 categories.js，条目格式见 ev.js。
import { EVENTS_A, EVENTS_B } from "./eventsAB.js";
import { EVENTS_C, EVENTS_D } from "./eventsCD.js";
import { EVENTS_E, EVENTS_F } from "./eventsEF.js";
import { EVENTS_G, EVENTS_H } from "./eventsGH.js";
import { EVENTS_I, EVENTS_J } from "./eventsIJ.js";
import { EVENTS_K, EVENTS_L } from "./eventsKL.js";
import { EVENTS_M, EVENTS_N } from "./eventsMN.js";
import { EVENTS_O, EVENTS_P } from "./eventsOP.js";
import { EVENTS_Q, EVENTS_R } from "./eventsQR.js";
import { EVENTS_S, EVENTS_T } from "./eventsST.js";

export { ROAD_EVENT_CATEGORIES, CATEGORY_KEYS, PLACE_TAGS, ALL_TAGS, ROAD_EVENT_RULES, SITUATION_IDS, livingAffinity } from "./categories.js";

export const ROAD_EVENTS = Object.freeze([
  ...EVENTS_A, ...EVENTS_B, ...EVENTS_C, ...EVENTS_D, ...EVENTS_E,
  ...EVENTS_F, ...EVENTS_G, ...EVENTS_H, ...EVENTS_I, ...EVENTS_J,
  ...EVENTS_K, ...EVENTS_L, ...EVENTS_M, ...EVENTS_N, ...EVENTS_O,
  ...EVENTS_P, ...EVENTS_Q, ...EVENTS_R, ...EVENTS_S, ...EVENTS_T,
]);

export const ROAD_EVENT_BY_ID = Object.freeze(Object.fromEntries(ROAD_EVENTS.map((e) => [e.id, e])));
