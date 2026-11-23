// 武学目录·雪山（从 qucuoKungfu.js 拆出，聚合见 ./index.js）
import { SKILL_TYPE } from "../skillType.js";

export const xueshan = [
    {
      id: "kf_rec_xuexian", name: "雪线吐纳", type: SKILL_TYPE.MOVE, quality: "蓝", price: 130,
      moveType: "状态",
      energyRestore: 8,
      unlock: { faction: "雪山派", rep: 15, member: false, note: "雪山派声誉 ≥ 15（颇具善缘）" },
      desc: "站在雪线上呼吸——那条线以上空气稀薄，逼得你把每一口都吸到底。练熟了下山再喘气，觉得平地的空气浓得发腻。呼延雪说这门功夫的诀窍是「先学会难受」。",
    },
    {
      id: "kf_rec_wenquan", name: "温泉纳气", type: SKILL_TYPE.MOVE, quality: "紫", price: 200,
      moveType: "状态",
      energyRestore: 7, hpRestore: 0.14,
      unlock: { faction: "雪山派", rep: 40, member: false, note: "雪山派声誉 ≥ 40（门墙之交）" },
      discount: { flag: "xueshan_heyuxie_cold_purged", rate: 0.5 }, // 合稿雪2 分支B：拔毒线半价
      desc: "后山温泉水温烫手，泡到肩膀，任热气从毛孔往里钻。何雨谢定的规矩是一炷香就得起来——「再泡下去补的是懒，不是气。」",
    },
    {
      id: "kf_ting_tingxue", name: "听雪", type: SKILL_TYPE.MOVE, quality: "紫", price: 230,
      moveType: "防御",
      onCounterSuccessEnergyGain: 4, onCounterSuccessDamageRatio: 0.4,
      unlock: { faction: "雪山派", rep: 40, member: true, guestRep: 80, note: "需拜入雪山派且声誉 ≥ 40；未拜入者需声誉 ≥ 80（股肱心腹）方可破例传授" },
      desc: "听桥一路的雪山变体。不看不挡，只听。雪落在肩上有声，剑破空也有声，两种声音在他耳朵里是一样的。听准了再动，一动就是还手。",
    },
    {
      id: "kf_xuexin", name: "雪山养气诀", type: SKILL_TYPE.NEIGONG, quality: "绿", price: 70,
      moveType: "防御",
      unlock: { faction: "雪山派", rep: 0, member: false, note: "雪山派声誉 ≥ 0（外客可学）" },
      desc: "雪山派内功入门，以静养气、以气养血。修习后气血上限提升，且每次切磋后恢复更快。",
      passiveBonus: { maxHp: 15 },
    },
    {
      id: "kf_bingxin", name: "冰心掌", type: SKILL_TYPE.MOVE, quality: "绿", price: 55,
      moveType: "防御",
      immuneControl: true,
      unlock: { faction: "雪山派", rep: 0, member: false, note: "雪山派声誉 ≥ 0（外客可学）" },
      desc: "以静制动，掌法平稳如雪山不动，防住来势后余力犹在。雪山派弟子入门必学的防身功夫。",
    },
    {
      id: "kf_xuekong", name: "虚空游步", type: SKILL_TYPE.QINGGONG, quality: "蓝", price: 100,
      moveType: "状态",
      unlock: { faction: "雪山派", rep: 15, member: false, note: "雪山派声誉 ≥ 15（颇具善缘）" },
      desc: "雪山派独门轻功，步随心走，动静之间令对手难以判断落脚点，身法与状态浑然一体。",
      passiveBonus: { speedBonus: 1 },
    },
    {
      id: "kf_shuangtian_luoxue", name: "霜天落雪剑", type: SKILL_TYPE.MOVE, quality: "橙", price: 420,
      moveType: "攻击",
      ignoreDefenseRatio: 0.25,
      unlock: { faction: "雪山派", rep: 80, member: true, guestRep: 100, quest: ["xueshan_4_yadi_zhenxiang"], note: "需拜入雪山派且声誉 ≥ 80 + 完成「雪4·雪山崖底三十年」；客卿尊宿（声誉 ≥ 100）获何雨谢亲授" },
      desc: "呼延大侠留下的雪山正宗剑法。起手平平无奇，像大雪压枝时一声极轻的咔哒，落下来却避无可避。齐照野说，这剑不是为了杀得痛快，是为了让该停下的事停下来。",
    },
    {
      id: "kf_taisu_hanyujing", name: "太素寒玉经", type: SKILL_TYPE.NEIGONG, quality: "红", price: 680,
      moveType: "防御",
      passiveBonus: { maxHp: 45 },
      immuneControl: true,
      unlock: { faction: "雪山派", rep: 100, member: true, quest: ["xueshan_5_pojie_chushan"], note: "镇派秘传：须正式拜入且完成「雪5·破戒出山」（合稿需声誉 ≥140，引擎封顶 100）" },
      desc: "雪山寒岭与后山热泉阴阳相济的最高心法，外如寒玉不侵、内似温泉不竭。修到深处，百毒难入、心魔不扰，任山下风浪翻天，丹田里始终只有一潭平水。",
    },
  ];
