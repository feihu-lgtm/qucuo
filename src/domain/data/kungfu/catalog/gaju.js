// 武学目录·噶举（白门 · 焚风渡三迦叶拜火武馆，5 门）
import { SKILL_TYPE } from "../skillType.js";

export const gaju = [
  {
    id: "kf_gaju_daoge", name: "密勒道歌诀", type: SKILL_TYPE.MOVE, quality: "绿", price: 75,
    moveType: "状态",
    energyRestore: 7,
    immuneControl: true,
    unlock: { faction: "噶举山人", rep: 0, member: false, note: "噶举山人声誉 ≥ 0（外客可在拜火武馆请教）" },
    desc: "交手半途托腮放声唱出一句苍凉道歌，随歌声吐尽胸中闷气与敌方控制劲力，丹田拙火随之暴涨。",
  },
  {
    id: "kf_gaju_baifanbu", name: "白幡御风步", type: SKILL_TYPE.QINGGONG, quality: "蓝", price: 155,
    moveType: "状态",
    passiveBonus: { speedBonus: 2 },
    unlock: { faction: "噶举山人", rep: 15, member: false, note: "噶举山人声誉 ≥ 15（颇具善缘）" },
    desc: "借河谷焚风与对手劈来的掌风飘身滑翔，一袭单薄白衣在刀光中忽东忽西，潇洒绝伦。",
  },
  {
    id: "kf_gaju_zhuohuo", name: "三迦叶拙火功", type: SKILL_TYPE.NEIGONG, quality: "蓝", price: 185,
    moveType: "防御",
    passiveBonus: { maxHp: 25 },
    unlock: { faction: "噶举山人", rep: 40, member: false, note: "噶举山人声誉 ≥ 40（门墙之交）" },
    desc: "拜火三迦叶口传纯阳内功，真气如铜炉鼓风，隆冬单衣坐雪而落雪成雾，克尽天下寒毒。",
  },
  {
    id: "kf_gaju_huoyandao", name: "大轮火焰刀", type: SKILL_TYPE.MOVE, quality: "紫", price: 340,
    moveType: "攻击",
    ignoreDefenseRatio: 0.35,
    forceCrit: { multiplier: 1.6 },
    unlock: { faction: "噶举山人", rep: 80, member: true, note: "需拜入噶举山人且声誉 ≥ 80" },
    desc: "以体内沛然拙火催动的无形刀气。手无寸铁而虚空劈掌，掌缘过处空气焦灼扭曲，三尺外便能以无形烈焰劲刃斩断精钢、焚脉伤敌。",
  },
  {
    id: "kf_gaju_dashouyin", name: "指月大手印", type: SKILL_TYPE.MOVE, quality: "橙", price: 560,
    moveType: "攻击",
    ignoreDefense: true,
    forceCrit: { multiplier: 1.75 },
    unlock: { faction: "噶举山人", rep: 100, member: true, note: "需拜入噶举山人且声誉 ≥ 100（口传心授至高掌法）" },
    desc: "口传心授至高掌法。抬手不像打人，倒像在断崖边给人指天上的月亮；可掌影落下时天地气机尽数封锁，无处可逃、无坚不摧。",
  },
];
