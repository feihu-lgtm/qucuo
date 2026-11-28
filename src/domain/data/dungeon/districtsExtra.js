// 十宫配置数据·下五宫（接 districts.js，其中五仙/雅江/天龙已升级为 13×13 写实武侠大平面地宫）。
import { CHENSHA_DOCK_CONFIG } from "./gridDungeonsA.js";
import { WUXIAN_POISON_VALLEY_CONFIG, TIANLONG_SERPENT_CAVE_CONFIG } from "./gridDungeonsB.js";

export const DUNGEON_DISTRICTS_EXTRA = Object.freeze({
  五仙百毒禁谷: WUXIAN_POISON_VALLEY_CONFIG,

  沉沙古坞: CHENSHA_DOCK_CONFIG,

  摩呼罗迦蛇窟: TIANLONG_SERPENT_CAVE_CONFIG,


});
