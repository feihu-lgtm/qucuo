// 鱼定土司府任务线（合稿·土司府第 4 节）。土司府不可拜入，玩家是编外客卿：主线 府1~府3 与支线 府支1~3；
// 府4「旧刃问心」牵着雪山派三十年宿怨；府5「斗地主」是终局决战，读各家终局 flag。门槛按 #237 顶层写法，全部 ≤ 100。
// 奖励照合稿原值；土司府涨声誉时黑风寨、玉泉寨、雪山派的联动扣分由 factionRepDeltas 统一结算，这里不手写。
export const TS = "鱼定土司府";
export const at = (inner, district = "鱼定土司") => ({ district, inner });
export const catalog = (name, count = 1) => Array.from({ length: count }, () => ({ name, fromCatalog: true }));

// 府5 读各家终局 flag 的映射表。各家 flag 名不统一（flag_*/endgame_*/*_endgame_*/finale_*/ally_*_confirmed），
// 这里只读不改名。effect 只抄各家章节合稿明写的终局效果；合稿没写效果或效果已被府4前置覆盖的，effect 为 null，府5 不接。
export const TUSI_FINALE_FLAGS = {
  gesangNeutralized: { flag: "flag_gesang_neutralized", faction: TS, effect: "格桑顿珠率八成巡捕营按兵不动，桑杰朵杰失去半数防线（府5 前置）" },
  meiduoRegent: { flag: "flag_meiduo_regent", faction: TS, effect: "战后推举梅朵代管" },
  meiduoBacked: { flag: "endgame_meiduo_succession_backed", faction: "锦官城", effect: "锦官城官府支持梅朵继位/代管" },
  yudingAlly: { flag: "flag_endgame_ally_yuding", faction: "鱼定村", effect: "情报封锁+后勤粮药+暗渡奇袭路线" },
  xueshanAlly: { flag: "xueshan_endgame_ally", faction: "雪山派", effect: "雪山剑阵正面拖住桑杰朵杰，大幅震慑土司府护卫军心" },
  baihuaAlly: { flag: "finale_baihua_joined", faction: "百花门", effect: "粮仓水源下软筋散、放瘴截断骑手，瓦解土司府半数私兵；百花门能解毒" },
  gaibangAlly: { flag: "endgame_ally_gaibang", faction: "丐帮", effect: "打狗阵牵制巡捕营与骑手" },
  gaibangScouts: { flag: "endgame_buff_gaibang_scouts", faction: "丐帮", effect: "全图斥候，提前洞悉伏兵与血刀部调兵动向" },
  heifengRaid: { flag: "endgame_buff_heifengzhai_raid_supply_lines", faction: "黑风寨", effect: "袭扰土司府粮道，后勤支援延迟两回合" },
  tangmenAlly: { flag: "ally_tangmen_confirmed", faction: "唐门", effect: "破甲连弩削减精兵三成护甲，取消管家毒弩伏击" },
  emeiAlly: { flag: "ally_emei_joined", faction: "峨眉派", effect: "回风剑阵破敌、正面硬撼血刀部（慈济施药减损府5 不建模）" },
  emeiFull: { flag: "ally_emei_full", faction: "峨眉派", effect: "倾巢相助：直接压制血刀部援军与唐门/五仙教毒阵" },
  huanxiLuoqi: { flag: "ending_huanxi_luoqi_ally", faction: "欢喜教", effect: "罗琦遣内院弟子潜入土司府，以特制安眠香放倒中院亲兵" },
  huanxiGuanjia: { flag: "ending_huanxi_guanjia", faction: "欢喜教", effect: "帮管家清剿欢喜堂：被土司府收编的暗香作坊转为敌方毒烟阵助战" },
  huanxiFanyanna: { flag: "ending_huanxi_fanyanna", faction: "欢喜教", effect: null },
  tianlongTianwang: { flag: "ending_ally_tianlong_tianwang", faction: "天龙教", effect: "天王复位、解散血刀部；白衣旧部陈兵鱼定村外，威慑土司不敢借外敌反扑（作证旧案府5 不建模）" },
  tianlongLongwang: { flag: "ending_ally_tianlong_longwang", faction: "天龙教", effect: "龙王铁血奇兵直捣土司府，血刀部随龙王反手攻府；战后走「黑旗入曲措」霸道分歧" },
  yuquanAlly: { flag: "endgame_ally_yuquan", faction: "玉泉寨", effect: "掐断土司府经大草甸转运粮草与血刀部补给的南线命脉" },
  yuquanFull: { flag: "endgame_ally_yuquan_full", faction: "玉泉寨", effect: null },
  yuquanEyes: { flag: "endgame_buff_yuquan_herder_eyes", faction: "玉泉寨", effect: null },
  qingchengPledge: { flag: "endgame_qingcheng_sword_pledge", faction: "青城派", effect: "青城剑坪精锐西渡，死死钉住大草甸的血刀部援军" },
  qingchengAlly: { flag: "ally_qingcheng", faction: "青城派", effect: "青5 守住安澜索桥，青城剑阵西渡钉住大草甸的血刀部援军" },
  qingchengFull: { flag: "ally_qingcheng_full", faction: "青城派", effect: "青霞子亲征，剑阵西渡钉住血刀部援军（同青5 常规结盟）" },
  tusiCrossbowExposed: { flag: "quest_tss2_hand", faction: TS, effect: "府支2 把暗弩交给格桑顿珠，削弱终局土司府暗器伏兵" },
  wuxianAlly: { flag: "endgame_ally_wuxian", faction: "五仙教", effect: "银冠线：解瘴清风香与软筋麻蛊破毒阵、克制血刀部冲锋；麻九娘未能卖蛊，战阵无紫瘴" },
  wuxianFull: { flag: "endgame_ally_wuxian_full", faction: "五仙教", effect: null },
  wuxianPoisonTusi: { flag: "endgame_wuxian_poison_tusi", faction: "五仙教", effect: "赤蜈线：土司私兵全员淬毒、战阵弥漫紫瘴（放任不管同样如此）" },
  gaibangFull: { flag: "endgame_ally_gaibang_full", faction: "丐帮", effect: null },
  lamaAlly: { flag: "lama_endgame_ally", faction: "喇嘛庙", effect: null },
  xueshanLone: { flag: "xueshan_endgame_lone", faction: "雪山派", effect: null },
  xueshanHeyuxieFull: { flag: "endgame_xueshan_heyuxie_full", faction: "雪山派", effect: "雪2 拔毒：何雨谢寒毒大幅根除，雪山派终局战力 +1 档（随雪山结盟时亲兵再降一档）" },
  baihuaNeutral: { flag: "bh5_neutral", faction: "百花门", effect: "退银守中，不接土司府招安，终局不反噬" },
  baihuaPersuaded: { flag: "finale_neutral_baihua", faction: "百花门", effect: "说服中立，不接土司府招安，终局不反噬" },
};
export const F = Object.fromEntries(Object.entries(TUSI_FINALE_FLAGS).map(([k, v]) => [k, v.flag]));
export const FINALE_ROOM = at("议事厅");
