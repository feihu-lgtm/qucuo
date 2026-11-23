// 武学目录·丐帮（从 qucuoKungfu.js 拆出，聚合见 ./index.js）
import { SKILL_TYPE } from "../skillType.js";

export const gaibang = [
    {
      id: "kf_rec_pomiao", name: "破庙烤火", type: SKILL_TYPE.MOVE, quality: "绿", price: 55,
      moveType: "状态",
      energyRestore: 6, hpRestore: 0.08,
      unlock: { faction: "丐帮三星分舵", rep: 0, member: false, note: "无需拜入，丐帮三星分舵声誉 ≥ 0（破庙竹坪可学）" },
      desc: "大雪夜缩在漏风的土地庙里，抱紧膝盖凑着半截柴火烤手。冷到骨头缝里还能把一口暖气吊住不散，是叫花子走江湖的第一门本事。白婶说学会了这手，「饿两顿照样能翻过雪山垭口」。",
    },
    {
      id: "kf_gaibang_lianhuan", name: "莲花落棍", type: SKILL_TYPE.MOVE, quality: "白", price: 24,
      moveType: "攻击",
      lowHpBonus: 0.25,
      unlock: { faction: "丐帮三星分舵", rep: 0, member: false, note: "无需拜入，丐帮三星分舵声誉 ≥ 0（丐帮入门外功）" },
      desc: "讨饭时打竹板唱莲花落顺手改出来的棒法，专挑下三路磕膝盖、扫脚踝。招式看着滑稽寒酸，真到血肉相搏、自己快撑不住的时候，越是拼命越粘人。",
    },
    {
      id: "kf_gaibang_zuitabu", name: "醉踏青石步", type: SKILL_TYPE.QINGGONG, quality: "绿", price: 85,
      moveType: "状态",
      passiveBonus: { speedBonus: 1 },
      unlock: { faction: "丐帮三星分舵", rep: 15, member: false, note: "丐帮三星分舵声誉 ≥ 15" },
      desc: "广汉雨后的青石板滑得能摔死骡子，严九斤提着酒葫芦走在上面却东倒西歪偏偏不倒。身法看着浑身破绽，刀锋真削过去，人早顺着酒劲滑出三尺外了。",
    },
    {
      id: "kf_gaibang_huntian", name: "混元吐纳功", type: SKILL_TYPE.NEIGONG, quality: "蓝", price: 135,
      moveType: "防御",
      passiveBonus: { maxHp: 22 },
      unlock: { faction: "丐帮三星分舵", rep: 15, member: false, note: "丐帮三星分舵声誉 ≥ 15" },
      desc: "丐帮代代相传的固本内功，不讲深山辟谷的清贵套路，专练风餐露宿、啃糙米喝冷水也能化作浑厚底气的本事。修成之后皮糙肉厚，极耐缠斗。",
    },
    {
      id: "kf_ting_zhusheng", name: "听桥·竹声", type: SKILL_TYPE.MOVE, quality: "紫", price: 240,
      moveType: "防御",
      onCounterSuccessEnergyGain: 4, onCounterSuccessDamageRatio: 0.45,
      unlock: { faction: "丐帮三星分舵", rep: 40, member: false, note: "需正式拜入丐帮三星分舵，或声誉 ≥ 40" },
      desc: "听桥一路流落川北丐帮的变体。老槐树下竹叶沙沙响，哑巴七闭着眼敲竹板，风往哪边吹、恶犬从哪边扑，全在半寸竹影里听得清清楚楚。先引其势，顺竹反抽。",
    },
    {
      id: "kf_gaibang_daguo", name: "缠丝打犬棒", type: SKILL_TYPE.MOVE, quality: "紫", price: 260,
      moveType: "攻击",
      ignoreDefenseRatio: 0.2, applyStatus: "麻穴", statusChance: 0.3,
      unlock: { faction: "丐帮三星分舵", rep: 40, member: true, guestRep: 80, note: "需正式拜入丐帮三星分舵且声誉 ≥ 40（外客须声誉 ≥ 80）" },
      desc: "三星分舵赖以成名的正宗棒法精要，讲究绊、挑、封、戳四字诀。竹棒看着轻巧，粘上兵刃便如老藤缠树，专克西域血刀的莽猛劈砍与马背长刀。",
    },
    {
      id: "kf_gaibang_fuhu", name: "裂山伏虎掌", type: SKILL_TYPE.MOVE, quality: "橙", price: 480,
      moveType: "攻击",
      forceCrit: { multiplier: 1.65 }, nextAttackBonus: 0.25,
      unlock: { faction: "丐帮三星分舵", rep: 80, member: true, guestRep: 100, note: "需正式拜入丐帮三星分舵且声誉 ≥ 80（外客须声誉满 100）" },
      desc: "严九斤压箱底的刚猛掌法，脱胎于丐帮古传伏虎降龙一脉，又融了岷江出峡的暴烈水势。出掌前沉如醉汉伏地，推出时如山石崩裂，十成劲里还藏着三成连绵不绝的后浪。",
    },
  ];
