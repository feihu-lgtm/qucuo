// 武学目录·土司（从 qucuoKungfu.js 拆出，聚合见 ./index.js）
import { SKILL_TYPE } from "../skillType.js";

export const tusi = [
    {
      id: "kf_tusi_xunshan", name: "巡山铁步", type: SKILL_TYPE.QINGGONG, quality: "绿", price: 60,
      moveType: "状态",
      passiveBonus: { speedBonus: 1, maxHp: 6 },
      unlock: { faction: "鱼定土司府", rep: 0, member: false, note: "鱼定土司府声誉 ≥ 0 即可在巡捕营校场购习" },
      desc: "巡捕营骑手下马巡岭练出来的硬步子，踩雪不滑、踏石不晃。格桑顿珠常骂新兵：「轻功不是用来飘给姑娘看的，是背着四十斤甲还能抢占高坡的！」",
    },
    {
      id: "kf_tusi_duanqi", name: "校场整肃", type: SKILL_TYPE.MOVE, quality: "绿", price: 65,
      moveType: "状态",
      energyRestore: 6, hpRestore: 0.06,
      unlock: { faction: "鱼定土司府", rep: 0, member: false, note: "鱼定土司府声誉 ≥ 0 即可购习" },
      desc: "巡捕营寅时点卯后的站桩调息法。腰板挺得像门前的旗杆，气沉下去，不乱喘也不露怯——站久了，连站在衙门口讨公道的百姓都先矮了三分气势。",
    },
    {
      id: "kf_tusi_maozhen", name: "镇边矛势", type: SKILL_TYPE.MOVE, quality: "蓝", price: 150,
      moveType: "攻击",
      nextAttackBonus: 0.25, lowHpBonus: 0.15,
      unlock: { faction: "鱼定土司府", rep: 15, member: false, note: "鱼定土司府声誉 ≥ 15（颇具善缘）" },
      desc: "格桑顿珠压箱底的军阵长兵路数，化繁为简，就三下：压、扎、挑。不跟江湖人比花巧，专破单打独斗的游击散招，一杆矛捅出去像一堵移动的墙。",
    },
    {
      id: "kf_tusi_tiebian", name: "敕令铁鞭", type: SKILL_TYPE.MOVE, quality: "紫", price: 260,
      moveType: "攻击",
      forceCrit: { multiplier: 1.55 },
      unlock: { faction: "鱼定土司府", rep: 40, member: false, note: "鱼定土司府声誉 ≥ 40（门墙之交）" },
      desc: "土司府执法重技，原本配的是沉铁马鞭与硬木算筹。抽出去带着破风的尖啸，打的不是要害，打的是「不守规矩」那口气——挨上一鞭，半边身子都发麻。",
    },
    {
      id: "kf_tusi_budong", name: "雪域不动诀", type: SKILL_TYPE.NEIGONG, quality: "紫", price: 280,
      moveType: "防御",
      immuneControl: true,
      passiveBonus: { maxHp: 28 },
      unlock: { faction: "鱼定土司府", rep: 40, member: false, bypassFlag: "tusi_gesang_true_heir", note: "鱼定土司府声誉 ≥ 40（门墙之交），或府4格桑顿珠真传" },
      desc: "三十年前老土司桑杰大侠融合藏地密息与中原内功所创的护体心法。气行周天如雪峰盘踞，任狂风扑面岿然不动；只是如今府里懂它本意的人，满打满算不过两个。",
    },
    {
      id: "kf_tusi_yinshan", name: "印山镇岳掌", type: SKILL_TYPE.MOVE, quality: "橙", price: 480,
      moveType: "攻击",
      forceCrit: { multiplier: 1.75 }, nextAttackBonus: 0.35,
      unlock: { faction: "鱼定土司府", rep: 80, member: false, favor: { npc: "桑杰朵杰", min: 45 }, bypassFlag: "quest_ts4_purge", note: "鱼定土司府声誉 ≥ 80（股肱心腹）且桑杰朵杰好感 ≥ 45，或府4清营后桑杰朵杰亲授" },
      desc: "桑杰朵杰不轻易示人的世家绝学。出掌前看不出半分杀气，落下来却似一方千斤官印从天压顶，外绵内沉、劲透脏腑。三十年前雪山崖底，老土司正是以此掌接下了呼延大侠的剑。",
    },
  ];
