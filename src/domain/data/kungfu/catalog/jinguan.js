// 武学目录·锦官（从 qucuoKungfu.js 拆出，聚合见 ./index.js）
import { SKILL_TYPE } from "../skillType.js";

export const jinguan = [
    {
      id: "kf_rec_chabo", name: "茶博士收势", type: SKILL_TYPE.MOVE, quality: "绿", price: 50,
      moveType: "状态",
      energyRestore: 5, hpRestore: 0.05,
      desc: "清风茶馆的跑堂一天走三十里地不歇脚，全靠这一手：长嘴壶收势那一下顺势沉肩塌腰，一口气就换过来了。李掌柜说学会了「端一天盘子腰不酸」。",
    },
    {
      id: "kf_rec_xiaochang", name: "校场歇鼓", type: SKILL_TYPE.MOVE, quality: "蓝", price: 140,
      moveType: "状态",
      energyRestore: 7, nextAttackBonus: 0.3,
      desc: "锦官武馆校场上，一通鼓歇下来的那三息。老兵教的：别急着喘，先把散掉的劲收回丹田，收利索了下一棍才有分量。鼓再响时，你比刚才更沉。",
    },
    {
      id: "kf_gangfeng", name: "刚锋腿", type: SKILL_TYPE.MOVE, quality: "白", price: 18,
      moveType: "攻击",
      lowHpBonus: 0.2,
      desc: "朴实无华的腿法，踢出去带着一股硬劲，胜在简单直接，江湖初入者常练。",
    },
    {
      id: "kf_lieyan", name: "烈焰拳", type: SKILL_TYPE.MOVE, quality: "绿", price: 45,
      moveType: "攻击",
      forceCrit: { multiplier: 1.4 },
      desc: "流传甚广的刚猛拳法，以力破巧，一拳连着一拳往上催，架不住就是硬吃。",
    },
    {
      id: "kf_jinshen", name: "金身诀", type: SKILL_TYPE.NEIGONG, quality: "白", price: 22,
      moveType: "防御",
      desc: "流传于锦官城武林的入门内功，练气固体，气血略有增益，初学者常备。",
      passiveBonus: { maxHp: 8 },
    },
    {
      id: "kf_wuyou", name: "无忧步", type: SKILL_TYPE.QINGGONG, quality: "绿", price: 40,
      moveType: "状态",
      desc: "行云流水般的步法，能在混战中灵活穿插，身形难以捉摸，是走南闯北的江湖人惯用的入门轻功。",
      passiveBonus: { speedBonus: 1 },
    },
    {
      id: "kf_guan_yanxing", name: "雁行缉拿棍", type: SKILL_TYPE.MOVE, quality: "蓝", price: 115,
      moveType: "攻击",
      applyStatus: "麻穴", statusChance: 0.3,
      unlock: { faction: "锦官城", rep: 15, member: false, note: "锦官城声誉 ≥ 15（差役把式）" },
      desc: "都事府差役巡街缉凶的棍法，棍走雁行斜插——不取要害，专打持刀的手腕与膝盖，拿人为主、伤人为辅。班头侯敢教这门时说：「打躺下容易，捆回去才算完。」",
    },
    {
      id: "kf_guan_fuhu", name: "六扇门缚虎手", type: SKILL_TYPE.MOVE, quality: "紫", price: 250,
      moveType: "攻击",
      ignoreDefenseRatio: 0.2, applyStatus: "麻穴", statusChance: 0.3,
      unlock: { faction: "锦官城", rep: 40, member: false, note: "锦官城声誉 ≥ 40（门墙之交）" },
      desc: "官衙缉拿凶犯的擒拿散手，讲究一手锁腕一手压肩，三招之内叫对方兵刃脱手、跪地就缚。练到深处连成名凶徒也挣不脱，故名缚虎。",
    },
    {
      id: "kf_guan_qingyuan", name: "青鸢回风", type: SKILL_TYPE.MOVE, quality: "橙", price: 450,
      moveType: "攻击",
      highHpBonus: 0.15, applyMark: { name: "内伤", stacks: 2, max: 5 },
      unlock: { faction: "锦官城", rep: 80, member: true, guestRep: 100, note: "需投效都事府且声誉 ≥ 80（外客须声誉 ≥ 100 一代尊宿方可求教）" },
      desc: "柳青鸢压箱底的剑式，青鸢点水、回风折柳——出手时不显山露水，收剑时内伤已埋进对方筋骨。她只授给府里当差且信得过的人。",
    },
  ];
