// 曲措乡各方势力，按全势力合稿「势力设定总表」的 16 家（终局靶心 1 + 本境 8 + 乡外 7）。
// districts 是该势力坐镇的外层据点，在这些据点里买东西才吃势力声誉的折扣；
// 与别家同城的（天都镇百花门/欢喜教、锦官城峨眉、广汉三星派古墟）暂不按据点区分。
// foes 照合稿「势力关系网络·敌对关系」，双向登记。
export const FACTIONS = Object.freeze([
  { name: "鱼定土司府", districts: ["鱼定土司"], foes: ["黑风寨", "玉泉寨", "雪山派"] },
  { name: "鱼定村", districts: ["鱼定村"], foes: [] },
  { name: "雪山派", districts: ["雪山派"], foes: ["鱼定土司府"] },
  { name: "喇嘛庙", districts: ["喇嘛庙", "白塔"], foes: [] },
  { name: "玉泉寨", districts: ["玉泉寨"], foes: ["鱼定土司府"] },
  { name: "百花门", districts: [], foes: ["五仙教"] },
  { name: "锦官城", districts: ["锦官城"], foes: ["欢喜教"] },
  { name: "黑风寨", districts: ["黑风寨"], foes: ["鱼定土司府"] },
  { name: "欢喜教", districts: [], foes: ["锦官城"] },
  { name: "青城派", districts: ["雅江"], foes: ["天龙教", "唐门"] },
  { name: "峨眉派", districts: [], foes: ["天龙教", "五仙教"] },
  { name: "唐门", districts: ["蜀南唐堡"], foes: ["青城派"] },
  { name: "丐帮三星分舵", districts: ["广汉"], foes: ["天龙教"] },
  { name: "五仙教", districts: ["雾隐寨"], foes: ["百花门", "峨眉派"] },
  { name: "天龙教", districts: ["天龙营"], foes: ["青城派", "峨眉派", "丐帮三星分舵"] },
  { name: "三星派", districts: [], foes: [] },
]);

export const FACTION_NAMES = Object.freeze(FACTIONS.map((faction) => faction.name));
