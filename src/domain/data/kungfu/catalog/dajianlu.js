// 武学目录·打箭炉（跑马山武馆，中立大城开放武馆，3 门）
import { SKILL_TYPE } from "../skillType.js";

export const dajianlu = [
  {
    id: "kf_djl_pishuidao", name: "折多劈水刀", type: SKILL_TYPE.MOVE, quality: "绿", price: 65,
    moveType: "攻击",
    desc: "康巴马帮在折多河急流边练出的厚背阔刀法，刀势大开大阖，连水花都能被一刀劈断。",
  },
  {
    id: "kf_djl_panyangbu", name: "康巴盘羊步", type: SKILL_TYPE.QINGGONG, quality: "蓝", price: 135,
    moveType: "状态",
    passiveBonus: { speedBonus: 1 },
    desc: "跑马山峭壁腾跃步法，借山岩落脚折转如野盘羊，走山路与贴身缠斗皆极灵便。",
  },
  {
    id: "kf_djl_bailianti", name: "炉城百炼体", type: SKILL_TYPE.NEIGONG, quality: "蓝", price: 150,
    moveType: "防御",
    passiveBonus: { maxHp: 20 },
    desc: "武侯造箭坊铁匠与拳师共修的外家抗打硬功，经水车铁锤震荡筋骨后气血尤为厚实。",
  },
];
