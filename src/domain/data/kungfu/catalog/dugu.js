// 武学目录·独孤（从 qucuoKungfu.js 拆出，聚合见 ./index.js）
import { SKILL_TYPE } from "../skillType.js";

export const dugu = [
    {
      insight: { stat: "waigong", threshold: 60, label: "外功" },
      id: "kf_rec_jianzhong", name: "剑冢独坐", type: SKILL_TYPE.MOVE, quality: "橙", price: 0,
      moveType: "状态",
      energyRestore: 10, immuneControl: true,
      desc: "在剑冢边上坐着，什么也不做。风穿过那些插了几十年的剑，声音很杂，坐久了就听不见了。听不见的时候，气自己回来了，心里也没什么能扰得动你。",
    },
    {
      // price 0 + insight：不卖钱，走"参悟"。门槛写成数据，WuguanScreen 据此显示
      // 「参悟」而非「购买」，够不到就明说还差多少。剑诀刻在墓壁上，看得见看不懂。
      insight: { stat: "waigong", threshold: 80, label: "外功" },
      id: "kf_dugujiujian", name: "独孤九剑", type: SKILL_TYPE.MOVE, quality: "橙", price: 0,
      moveType: "攻击",
      desc: "剑魔独孤求败所创，无招胜有招。总诀式、破剑式、破刀式、破掌式、破索式、破鞭式、破枪式、破箭式、破气式，九式归一。令狐冲刻于墓壁，待有缘人。",
      passiveBonus: { speedBonus: 2 },
    },
  ];
