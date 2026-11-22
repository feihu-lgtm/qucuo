// 跑马大会数据定义（总纲 v3「四、跑马大会」）。
// 三档赛事按节目单排时段：上午跑马、午后射箭、傍晚比武；
// 夜话限戌亥之交（19–22 时），子夜之变限子时（23 时）。
// 参赛门槛照「不超过 100」：比分线满分 100，冠军线都在 100 以内。


// 每项赛事一天一次：参赛 flag 按下注/参赛分别记。
export function contestFlag(contestId, kind, dayIdx) {
  return `festival_${contestId}_${kind}_${dayIdx}`;
}

export const FESTIVAL_CONTESTS = {
  saima: {
    id: "saima",
    title: "跑马",
    window: [6, 11],
    desc: "上午的跑马，终点在跑马场西头的彩旗下。卫冕的是土司府的梅朵。",
    // 比分线：七维加权，满分 100
    statLine: { 身法: 5, 体魄: 3, 气运: 2 },
    rollMax: 15,
    champion: { name: "梅朵", score: 78 },
    questFlag: "paoma_saima_win",
    winSettle: "跑马大会跑马竞技，你一路领跑到彩旗下，压过了卫冕的梅朵",
    loseSettle: "跑马大会跑马竞技，你跑到半程被梅朵甩开半个马身",
    bettors: [
      { name: "梅朵", weight: 60, odds: 1.5, note: "卫冕骑手，年年压场" },
      { name: "丹增", weight: 25, odds: 2.4, note: "玉泉寨老驯马手" },
      { name: "赶马人阿旺", weight: 15, odds: 4, note: "常年跑商路，马熟路不熟" },
    ],
  },
  shejian: {
    id: "shejian",
    title: "射箭",
    window: [12, 16],
    desc: "午后的射箭，三十步外立靶，红心不过铜钱大。",
    statLine: { 智谋: 4, 身法: 4, 气运: 2 },
    rollMax: 15,
    champion: { name: "老猎户", score: 72 },
    questFlag: "paoma_shejian_win",
    winSettle: "跑马大会射箭场，你三箭连中红心，压过了老猎户",
    loseSettle: "跑马大会射箭场，你最后一箭偏出红心，输给了老猎户",
    bettors: [
      { name: "老猎户", weight: 50, odds: 1.8, note: "打了一辈子熊瞎子" },
      { name: "才旦", weight: 30, odds: 2.6, note: "村长之女，臂力不大眼力狠" },
      { name: "无名弓手", weight: 20, odds: 4, note: "谁也不认识的外乡人" },
    ],
  },
  wubi: {
    id: "wubi",
    title: "比武",
    window: [17, 20],
    desc: "傍晚的擂台比武，土司当众看彩。点到为止，不是生死局。",
    questFlag: "paoma_wubi_win",
    combatNpc: { name: "土司府骑技教头", levelCap: 4 },
    aftermath: "比武夺彩落幕，土司府当众颁出彩头，写清彩头是什么、看客怎么喝彩、主角怎么下台。",
    bettors: [
      { name: "骑技教头", weight: 65, odds: 1.5, note: "格桑顿珠手下教出来的" },
      { name: "外乡武师", weight: 35, odds: 2.6, note: "招式杂，底盘稳" },
    ],
  },
};

// 女伴同游候选（总纲 4.2）：好感 ≥ 60 才能邀，一天只邀一人。
// masked=true 的以「蒙面/乔装」示人，名字对玩家照实写、对白里带遮掩。
export const FESTIVAL_COMPANION_FAVOR = 60;
export const FESTIVAL_COMPANIONS = [
  { name: "梅朵", note: "她才是跑马场的角儿——陪她逛，不是看她跑。" },
  { name: "呼延雪", note: "雪山弟子逛世俗集市，本就是破例。" },
  { name: "何雨谢", masked: true, note: "掌门师母不宜露面，蒙面同游。" },
  { name: "才旦", note: "村长之女，同游没有阻碍，是最轻松的一条。" },
  { name: "卓玛", note: "话少，看得仔细。" },
  { name: "李若由", note: "商队难得歇业一天。" },
  { name: "兰姐", masked: true, note: "一位斗笠遮面的女客，认出她需要点眼力。" },
];

export function companionFlag(name, dayIdx) {
  return `festival_companion_${dayIdx}_${name}`;
}

export function nightDoneFlag(name, dayIdx) {
  return `festival_night_${dayIdx}_${name}`;
}

// 子夜之变（总纲 4.4）：子时三选一随机触发。
// yield = 不拔刀；combat 的分支走任务 pendingQuestBranch，flag 即任务 stage 的 completionFlag。
export const MIDNIGHT_FLAG = "festival_midnight_done";
export const MIDNIGHT_EVENTS = {
  guan: {
    id: "guan",
    title: "官府查封",
    intro: "子夜鼓声未落，锦官城的缉查队打着「治安清查」的灯笼封了会场两头——这不是临时起意，是早就候在外面的。",
    choices: [
      {
        kind: "combat", label: "拔刀护会", flag: "paoma_ziye_guan",
        combatNpc: { name: "锦官城缉查队差头", levelCap: 5, hostile: true },
        aftermath: "官府查封被当众顶了回去，写清土司府和锦官城两边的脸面如何作结、人群怎么散去。",
      },
      { kind: "yield", label: "避其锋芒", flag: "paoma_ziye_yield" },
    ],
  },
  zei: {
    id: "zei",
    title: "山贼劫会",
    intro: "人堆刚散，一伙过路响马从狼曲方向摸下来——酒气混着刀风，先抢了收摊最慢的账箱。",
    choices: [
      {
        kind: "combat", label: "截住他们", flag: "paoma_ziye_zei",
        combatNpc: { name: "下山劫道的响马头子", levelCap: 5, hostile: true },
        aftermath: "劫会的响马被打退，写清账箱夺回、摊主致谢、夜色怎么重归安静。",
      },
      { kind: "yield", label: "袖手旁观", flag: "paoma_ziye_yield" },
    ],
  },
  xie: {
    id: "xie",
    title: "邪教乱党",
    intro: "夜市深处飘起一股甜得发腻的香——几个人影借着香火诵经声往人群里钻，袖口露出欢喜教的缠枝纹。",
    choices: [
      {
        kind: "combat", label: "搅破他们的局", flag: "paoma_ziye_xie",
        combatNpc: { name: "欢喜教乱党头目", levelCap: 5, hostile: true },
        aftermath: "乱党的迷香局被搅破，写清香火散掉、信众惊散、主角怎么收场。",
      },
      { kind: "yield", label: "袖手旁观", flag: "paoma_ziye_yield" },
    ],
  },
};

// 集市摊位（总纲 4.1 外围集市）：全部收进「跑马集市」一家商行的货架，
// 摊型靠物品描述区分，不另开房间。
