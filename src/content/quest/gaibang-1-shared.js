// 丐帮三星分舵任务线（合稿·丐帮第 4 节）。主线 丐1~丐5 与支线 丐支1~3，另有拜入前的聚义堂入门小考（合稿 7.4）。
// 死对头（天龙教）的联动扣分由 applyFactionRep 统一结算，这里不手写。
export const GB = "丐帮三星分舵";
export const at = (inner, district = "广汉") => ({ district, inner });
export const catalog = (name, count = 1) => Array.from({ length: count }, () => ({ name, fromCatalog: true }));

// 丐5 誓师分支：已拜入者升阶七袋掌棒使；倾巢相助合稿门槛 140 收到声誉上限 100。
export const MEMBER = "丐帮弟子";
export const OATH_ALLY = ["quest_gb5_oath", "quest_gb5_oath_rank"];
export const OATH_FULL = ["quest_gb5_full", "quest_gb5_full_rank"];
export const FULL_GATE = { requiresFactionRep: { [GB]: 100 }, requiresFavor: { 多吉: 60 } };
export const FULL_FLAGS = ["endgame_ally_gaibang_full", "gaibang_epilogue_yiyue_zhoupeng"];
export const GUEST_REWARD = { items: catalog("三星客卿青竹杖") };
export const RANK_REWARD = { items: catalog("七袋掌棒使铁令"), flags: ["丐帮七袋掌棒使"] };
export const FULL_NARRATION = "多吉站上供桌唱起玉泉牧歌，院里返乡的牧民一个接一个跟着唱。严九斤把裂山伏虎掌的架子一摆：「桑杰朵杰那一刀，到时候老叫花替你接。」";
