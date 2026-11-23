// 武学目录·百花（从 qucuoKungfu.js 拆出，聚合见 ./index.js）
import { SKILL_TYPE } from "../skillType.js";

export const baihua = [
    {
      id: "kf_baihua_huaniang", name: "花酿换气", type: SKILL_TYPE.MOVE, quality: "绿", price: 55,
      moveType: "状态",
      energyRestore: 5, hpRestore: 0.06, dispelSelf: true,
      unlock: { faction: "百花门", rep: 0, member: false, note: "百花门声誉 ≥ 0，入门即学（暖棚传艺地）" },
      desc: "百花楼的姑娘端着酒盘子站一夜不倒，全靠花婆教的一口换气法——吸进肺里的是苦艾香，吐出去的是宿醉气。小蝉说练熟了连喝三碗劣质青稞烧都不上头，中了小毒也能顺气逼出三分。",
    },
    {
      id: "kf_baihua_yinci", name: "银梅点刺", type: SKILL_TYPE.MOVE, quality: "绿", price: 65,
      moveType: "攻击",
      applyStatus: "裂伤", statusChance: 0.4, ignoreDefenseRatio: 0.15,
      unlock: { faction: "百花门", rep: 15, member: false, note: "百花门声誉 ≥ 15（颇具善缘）" },
      desc: "兰姐教楼里姑娘防身的三手发簪功夫。不拼蛮力，专挑手腕脉门与肘窝脆处扎——「醉汉手重，你跟他比劲是傻，扎他麻筋一寸，他自己就把酒碗松了。」",
    },
    {
      id: "kf_baihua_fudie", name: "拂蝶穿花步", type: SKILL_TYPE.QINGGONG, quality: "蓝", price: 135,
      moveType: "状态",
      passiveBonus: { speedBonus: 1 },
      unlock: { faction: "百花门", rep: 40, member: false, note: "百花门声誉 ≥ 40（门墙之交，持素梅牌）" },
      desc: "在桌椅挤得转不开身的酒楼大堂里练出来的步法。脚尖蹭着裙摆滑出去，人影还在左桌敬酒，袖口已经擦过右桌客人的刀柄。阿芷练这步子时脚踝绑着两串铜铃——什么时候走完一圈不响，才算入门。",
    },
    {
      id: "kf_baihua_biyu", name: "碧玉养蛊诀", type: SKILL_TYPE.NEIGONG, quality: "蓝", price: 150,
      moveType: "防御",
      passiveBonus: { maxHp: 18 },
      unlock: { faction: "百花门", rep: 40, member: false, note: "百花门声誉 ≥ 40（门墙之交，持素梅牌）" },
      desc: "原是苗疆五仙教入门心法，到了花婆手里删去三分狠毒、添了七分温养。以微毒日日试炼经脉，久练之下寻常蒙汗药与山瘴近身只觉鼻尖微凉，气血也比旁人沉厚耐耗。",
    },
    {
      id: "kf_baihua_tingxiang", name: "听香避瘴势", type: SKILL_TYPE.MOVE, quality: "紫", price: 240,
      moveType: "防御",
      immuneControl: true, onCounterSuccessDamageRatio: 0.35, applyStatus: "淬毒", statusChance: 0.3,
      unlock: { faction: "百花门", rep: 80, member: false, note: "百花门声誉 ≥ 80（股肱心腹，持银梅令）" },
      desc: "不硬架来招，只顺着风声退半步，袖底扬起一撮无色花尘。对手招式越猛，吸进去的药粉越深。花婆讲得好：「疯狗扑上来咬人，你伸手捂它嘴作甚？往它鼻尖吹把花椒面就老实了。」",
    },
    {
      id: "kf_baihua_jincan", name: "金蚕缠丝鞭", type: SKILL_TYPE.MOVE, quality: "紫", price: 260,
      moveType: "攻击",
      applyStatus: "剧毒", statusChance: 0.35, ignoreDefenseRatio: 0.15,
      unlock: { faction: "百花门", rep: 80, member: false, quest: ["baihuamen_3_shixinyudu"], note: "百花门声誉 ≥ 80 且完成花3·蚀心余毒（任务未落地前先锁）" },
      desc: "三尺软银丝浸过百花露与金蚕涎，抖开像一缕月光，抽在身上先不觉痛，三息之后骨缝里才往外冒寒酸劲。阿芷说这招最不讲体面——专缠那些爱摆架子的名门剑客手腕。",
    },
    {
      id: "kf_baihua_shixin", name: "百花蚀心掌", type: SKILL_TYPE.MOVE, quality: "橙", price: 520,
      moveType: "攻击",
      forceCrit: { multiplier: 1.5 }, applyStatus: "剧毒", statusChance: 0.4, ignoreDefenseRatio: 0.25,
      unlock: { faction: "百花门", rep: 100, member: false, quest: ["baihuamen_4_wuxianjiuan"], note: "百花门声誉 ≥ 100（合稿写140，引擎封顶100）且完成花4·雾隐旧案，兰姐亲授（任务未落地前先锁）" },
      desc: "脱胎自《五仙毒典》残页的镇楼杀招，兰姐流亡十年里只在天都镇外荒野动过一回。掌风拂面先闻梅香，继而五脏如浸冰水，内力越深厚的人反而越压不住这股逆行寒毒——兰姐传你时只嘱咐一句：「用完这一掌，记得洗手。」",
    },
  ];
