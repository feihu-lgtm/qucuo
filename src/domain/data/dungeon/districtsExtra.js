// 十宫配置数据·下五宫（接 districts.js，其中五仙/雅江/天龙已升级为 13×13 写实武侠大平面地宫）。
import { CHENSHA_DOCK_CONFIG } from "./gridDungeonsA.js";
import { WUXIAN_POISON_VALLEY_CONFIG, TIANLONG_SERPENT_CAVE_CONFIG } from "./gridDungeonsB.js";

export const DUNGEON_DISTRICTS_EXTRA = Object.freeze({
  雾隐寨五仙秘洞: WUXIAN_POISON_VALLEY_CONFIG,

  雅江悬棺裂谷: CHENSHA_DOCK_CONFIG,

  天龙营八部浮屠: TIANLONG_SERPENT_CAVE_CONFIG,

  蜀南唐堡千机楼: {
    anchor: "换班休息室",
    envTag: "tangGear",
    prefixPool: ["机括", "淬毒", "齿轮", "嘎吱", "连弩"],
    suffixPool: ["暗阁", "长廊", "演武房", "总控室", "水动房"],
    descPool: ["{name}齿轮在墙内咬合，机簧声如虫蛀。", "{name}弩口藏在雕花背后，淬毒倒钩泛着青。"],
    boss: { name: "唐门叛门长老", desc: "暴雨总控阁青铜外骨骼，每3回合全屏暴雨梨花针。", movesHint: "外骨骼/梨花针幕" },
    puzzle: { type: "sequenceReset", config: { items: ["上槽半满", "中槽调平", "下槽蓄水"], stat: "craft", dc: 7, prompt: "三水槽拨栓调平驱动大门齿轮" } },
    adventurerFactions: ["唐门", "散人", "刺客"],
    branchRate: 0.4, loopRate: 0.2,
    eventSeeds: [
      { kind: "fight", desc: "机关木人与唐门守卫", check: "combat", dc: 7, outcome: "齿轮件" },
      { kind: "event", desc: "走廊冷箭", check: "agility", dc: 6, outcome: "箭伤" },
      { kind: "nsfw", desc: "春丝束缚女刺客", check: "craft", dc: 5, outcome: "协助脱困" },
      { kind: "supply", desc: "搜刮解毒药包", check: null, dc: 0, outcome: "药包" },
      { kind: "loot", desc: "死路唐门金库", check: "craft", dc: 8, outcome: "唐门重货" },
      { kind: "watch", desc: "看木人阵绞碎毛贼", check: "stealth", dc: 4, outcome: "弱点情报" },
      { kind: "meet", desc: "被困的巧手飞贼", check: "charm", dc: 5, outcome: "组队拆机" },
      { kind: "appraise", desc: "鉴定机关人偶弱点", check: "craft", dc: 6, outcome: "破弱点" },
      { kind: "puzzle", desc: "水槽水量序列", check: "craft", dc: 7, outcome: "大门开启" },
      { kind: "checkpoint", desc: "换班休息室", check: null, dc: 0, outcome: "存点" },
    ],
  },

  欢喜教秘坛: {
    anchor: "未燃熏香偏房",
    envTag: "huanxiDesire",
    prefixPool: ["合欢", "销魂", "绮罗", "幽香", "靡靡"],
    suffixPool: ["禅房", "汤池", "软榻", "密室", "刑房"],
    descPool: ["{name}纱帐低垂，暖香里混着说不清的甜腥。", "{name}软榻横陈，墙角香炉吐着粉雾。"],
    boss: { name: "欢喜教圣女", desc: "大欢喜莲花榻薄纱圣女：天魔舞高闪避叠欲火、软剑、挥发性催情毒。", movesHint: "天魔舞/软剑缠丝" },
    puzzle: { type: "timedAgility", config: { stat: "agility", dc: 7, prompt: "欲海铃阵蒙眼穿红绳，响铃喷毒雾" } },
    adventurerFactions: ["合欢", "散人", "各派落难女侠"],
    branchRate: 0.35, loopRate: 0.15,
    eventSeeds: [
      { kind: "fight", desc: "欢喜堂成年护院武者", check: "combat", dc: 7, outcome: "坛中密货" },
      { kind: "event", desc: "欲火攻心扣内力", check: "inner", dc: 6, outcome: "内力流失" },
      { kind: "nsfw", desc: "汤池群交大典/解毒双修", check: "body", dc: 6, outcome: "救剑舞娘收从者" },
      { kind: "supply", desc: "搜刮清心丸", check: null, dc: 0, outcome: "降欲火药" },
      { kind: "loot", desc: "香炉底双修秘籍", check: "luck", dc: 6, outcome: "秘籍" },
      { kind: "watch", desc: "屏风后看圣女采补", check: "stealth", dc: 5, outcome: "采补诀情报" },
      { kind: "meet", desc: "潜伏采风的风流浪子", check: "charm", dc: 5, outcome: "坛路向导" },
      { kind: "appraise", desc: "鉴定香炉烧的药", check: "wisdom", dc: 6, outcome: "避香预警" },
      { kind: "puzzle", desc: "敏捷过铃阵", check: "agility", dc: 7, outcome: "坛城深处" },
      { kind: "checkpoint", desc: "未燃熏香偏房", check: null, dc: 0, outcome: "存点" },
    ],
  },
});
