// 武学目录·三星（从 qucuoKungfu.js 拆出，聚合见 ./index.js）
import { SKILL_TYPE } from "../skillType.js";

export const sanxing = [
    {
      id: "kf_sanxing_tingfeng", name: "听风铜剑", type: SKILL_TYPE.MOVE, quality: "绿", price: 85,
      moveType: "攻击",
      nextAttackBonus: 0.15,
      unlock: { faction: "三星派", rep: 15, note: "三星派声誉 ≥ 15（无需正式拜入）" },
      desc: "墟外听风人姜泠常使的入门剑路。鸭子河畔雾大看不清人，便先听风擦过芦苇的响动再递剑。不求一剑封喉，只求上一剑试出虚实，下一剑稳稳落在空门上。",
    },
    {
      id: "kf_rec_guixu", name: "归墟坐忘", type: SKILL_TYPE.MOVE, quality: "橙", price: 160,
      moveType: "状态",
      energyRestore: 12,
      unlock: { faction: "三星派", rep: 15, quest: ["sanxingpai_2_sanmianjianzhen"], note: "三星派声誉 ≥ 15 且通过「星2·三面试剑」" },
      desc: "纵目者那一式的皮毛。闭眼，把自己当成一件被放回坑里的青铜器——三千年没人动过，也就三千年没耗过。睁眼时气是满的。",
    },
    {
      id: "kf_sanxing_xuantong", name: "玄铜镇岳势", type: SKILL_TYPE.MOVE, quality: "蓝", price: 150,
      moveType: "防御",
      immuneControl: true, onCounterSuccessDamageRatio: 0.35,
      unlock: { faction: "三星派", rep: 40, note: "三星派声誉 ≥ 40" },
      desc: "青铜面人·甲与丙守坪时最爱用的重剑架势。双足钉死夯土，宽背铜剑横在胸前如门板，任你百般巧劲刺来，先吃住你七分力道，再顺着铜脊沉沉反震回去。",
    },
    { id: "kf_sanxing_bu", name: "神树步", type: SKILL_TYPE.QINGGONG, quality: "紫", price: 210,
      moveType: "状态",
      unlock: { faction: "三星派", rep: 40, note: "三星派声誉 ≥ 40" },
      desc: "三星堆青铜神树九枝九鸟，枝杈交错毫无规律。步法脱胎于此，走位如攀树，每一步都踩在你判断不到的枝杈上。不是快，是无规律——你预判他往左，他往上了；你预判他落地，他还在半空拐了个弯。",
      passiveBonus: { speedBonus: 2 } },
    {
      id: "kf_rec_neishi", name: "纵目内视", type: SKILL_TYPE.MOVE, quality: "紫", price: 220,
      moveType: "状态",
      energyRestore: 7, hpRestore: 0.12, immuneControl: true,
      unlock: { faction: "三星派", rep: 40, member: true, guestRep: 80, note: "正式拜入三星派且声誉 ≥ 40（外客须声誉 ≥ 80）" },
      desc: "戴上面具之后视野窄了，反而看得见自己身体里的事——哪条经堵着，哪处旧伤没长好，一目了然。看见了，也就理顺了。青铜面人不说话，他们就这么互相教。",
    },
    { id: "kf_sanxing_jian", name: "纵目剑法", type: SKILL_TYPE.MOVE, quality: "紫", price: 280,
      moveType: "攻击",
      ignoreDefense: true,
      unlock: { faction: "三星派", rep: 40, member: true, guestRep: 80, note: "正式拜入三星派且声誉 ≥ 40（外客须声誉 ≥ 80）" },
      desc: "剑走直线，不拐弯。三星堆青铜面具的眼睛是凸出来的，看人不看表面，看穿。剑也一样：不刺你格挡的地方，刺你格挡之后的地方。一剑出去你挡了，但剑尖已经在你身后。三千年前的剑法本没有名字，后人叫它纵目——纵目所见，皆是要害。" },
    {
      id: "kf_sanxing_jinwupowang", name: "金乌破妄剑", type: SKILL_TYPE.MOVE, quality: "橙", price: 520,
      moveType: "攻击",
      forceCrit: { multiplier: 1.8 }, ignoreDefenseRatio: 0.45,
      unlock: { faction: "三星派", rep: 80, member: true, guestRep: 100, quest: ["sanxingpai_4_sanshinianjiushi"], note: "通过「星4·三十年前的旧客」，且正式拜入三星派、声誉 ≥ 80（外客须声誉满 100）" },
      desc: "纵目者枯坐青铜神树之巅三十年所悟的镇派绝剑。一剑挥落如金乌破开鸭子河千重阴雾，专斩世间一切护体假势与虚妄心障——剑光过后，真假自明，强弱立判。",
    },
  ];
