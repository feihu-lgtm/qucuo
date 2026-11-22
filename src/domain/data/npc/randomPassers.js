// 随机过路人：每个地图节点每天按种子刷一批有名有姓、有势力归属的人；据点里驻场的人加过路人至少凑够 MIN_PRESENT 个具名人物
// （山洞、顶峰这类小地方不凑）。另有一层不具名的群众（getCrowd），只给叙事做背景，不进人物名单、不计数。
// 同一天同一节点结果固定（seededRand），第二天换一批；旧的一批由 npc.residents 规则清掉。
// 守「契诃夫之枪」：人人扛一面已有势力的旗（或明说是散人），身份和归属都给 AI 写进叙事，
// 不刷无名无姓的装饰路人。名字避开驻场和游走池里的人，免得好感度串到别人身上。

import { seededRand } from "../../../utils/seededRandom.js";
import { NPC_POOL } from "./npcPool.js";
import { getAllResidentNpcNames, getResidentNpcs } from "./residentNpcs.js";

const MIN_PRESENT = 15;
const SMALL_PLACES = new Set(["山洞", "顶峰"]);

const HAN_SURNAMES = ["王", "李", "张", "刘", "陈", "杨", "赵", "周", "吴", "徐", "孙", "马", "胡", "郭", "何", "高", "郑", "梁", "宋", "谢", "韩", "冯", "邓", "曹", "彭", "曾", "肖", "田", "蒋", "袁"];
const HAN_MALE = ["大山", "长贵", "守义", "文远", "铁柱", "德福", "有才", "明远", "子安", "春生", "石头", "世昌", "永年", "三娃", "满仓", "茂林", "广财", "金水"];
const HAN_FEMALE = ["秀英", "桂兰", "翠花", "玉珍", "小莲", "春梅", "月娥", "素芬", "巧云", "凤仙", "银杏", "招娣"];
const TIBETAN_MALE = ["次仁", "多吉", "顿珠", "平措", "尼玛", "达瓦", "贡布", "洛桑", "强巴", "索南", "格勒", "群培"];
const TIBETAN_FEMALE = ["央金", "卓嘎", "德吉", "拉姆", "曲珍", "白玛", "旺姆", "措姆", "仁青", "益西"];
const MIAO_SURNAMES = ["龙", "吴", "杨", "石", "麻", "滕"];
const MIAO_MALE = ["阿龙", "阿岩", "阿保", "阿松", "阿牛", "阿勇"];
const MIAO_FEMALE = ["阿朵", "阿妹", "阿香", "阿银", "阿娇", "阿翠"];

// role: 身份；level: [下限, 上限] 品阶；culture: han | tibetan | miao；gender: 男 | 女（不写则随机）
const ROLES = {
  鱼定土司府: [
    { role: "巡丁", level: [1, 2], culture: "tibetan", gender: "男", personality: "仗着土司府的腰牌横着走，见了外乡人先盘问来路" },
    { role: "税吏", level: [0, 1], culture: "han", gender: "男", personality: "算盘不离手，嘴上客气，心里只记谁欠了几分租子" },
    { role: "府里马夫", level: [0, 1], culture: "tibetan", personality: "替府里跑腿办差，嘴碎爱抱怨管家刻薄" },
  ],
  鱼定村: [
    { role: "赶集村民", level: [0, 0], culture: "tibetan", personality: "背着酥油和青稞赶集，最关心今年的收成和土司府加不加租" },
    { role: "磨坊伙计", level: [0, 1], culture: "tibetan", gender: "男", personality: "力气大话少，谁家磨了几斗面他都清楚" },
  ],
  雪山派: [
    { role: "外门弟子", level: [1, 2], culture: "tibetan", personality: "下山办差的雪山派外门弟子，行止有练家子的分寸，对外人客气而疏远" },
    { role: "采药门人", level: [1, 1], culture: "han", personality: "背着药篓下山采雪莲，熟悉山路，问起门中事一概不答" },
  ],
  喇嘛庙: [
    { role: "行脚僧", level: [1, 2], culture: "tibetan", gender: "男", personality: "下山化缘的行脚僧，说话慢，常带一句劝善的话" },
    { role: "上山香客", level: [0, 0], culture: "tibetan", personality: "转着经筒去庙里还愿，絮叨家里的病人和心愿" },
    { role: "采办小喇嘛", level: [0, 1], culture: "tibetan", gender: "男", personality: "替庙里采买灯油，贪玩又怕被师父知道" },
  ],
  玉泉寨: [
    { role: "商队伙计", level: [1, 1], culture: "tibetan", gender: "男", personality: "押货跑狼曲水路，识行情、重实利，开口先问价" },
    { role: "牧民", level: [0, 1], culture: "tibetan", personality: "赶着牦牛换草场，见惯了风雪，说话直来直去" },
    { role: "脚夫", level: [0, 1], culture: "han", gender: "男", personality: "扛脚力讨生活，哪条路好走、哪段闹匪一清二楚" },
  ],
  黑风寨: [
    { role: "寨中探子", level: [1, 2], culture: "tibetan", gender: "男", personality: "扮作行商四处打探，眼睛总往别人的钱袋和马匹上瞟" },
    { role: "采买喽啰", level: [1, 1], culture: "han", gender: "男", personality: "替寨里采买盐巴和药，花钱大方，不许人多问" },
  ],
  百花门: [
    { role: "卖花苗女", level: [1, 2], culture: "miao", gender: "女", personality: "挎着花篮串街，笑盈盈的，花里却常藏着百花门的信" },
  ],
  锦官城: [
    { role: "差役", level: [1, 1], culture: "han", gender: "男", personality: "公事公办，下乡催粮查案，对土司府的人又怕又恨" },
    { role: "巡捕", level: [1, 2], culture: "han", gender: "男", personality: "按刀巡街，见带兵刃的外乡人必要盘问几句" },
    { role: "书吏", level: [0, 0], culture: "han", gender: "男", personality: "抄录文书的小吏，消息灵通，一壶茶就能撬开嘴" },
  ],
  欢喜教: [
    { role: "香行伙计", level: [0, 1], culture: "han", personality: "替天都香行送香，身上一股甜腻的香气，嘴严得很" },
    { role: "外院香客", level: [0, 0], culture: "han", personality: "刚从香行出来，神情恍惚又满足，逢人便夸那里的安神香" },
  ],
  青城派: [
    { role: "下山历练弟子", level: [1, 2], culture: "han", personality: "青城派年轻弟子，背剑下山历练，正派却有些傲气" },
    { role: "采药道童", level: [0, 1], culture: "han", gender: "男", personality: "替药圃采药的小道童，认得百草，怕蛇" },
  ],
  峨眉派: [
    { role: "化缘女尼", level: [1, 2], culture: "han", gender: "女", personality: "峨眉女尼，持钵化缘，眉目冷清，遇不平事必出手" },
    { role: "俗家女弟子", level: [1, 1], culture: "han", gender: "女", personality: "峨眉俗家弟子，替庵里送药施粥，爽利干练" },
  ],
  唐门: [
    { role: "外姓门客", level: [1, 2], culture: "han", gender: "男", personality: "唐门外姓门客，袖口鼓鼓囊囊，说话前先打量对方手上的茧" },
    { role: "唐家家丁", level: [0, 1], culture: "han", gender: "男", personality: "替唐堡办货的家丁，主家规矩大，不敢多嘴" },
  ],
  丐帮三星分舵: [
    { role: "讨饭帮众", level: [1, 2], culture: "han", gender: "男", personality: "丐帮三星分舵的帮众，衣衫破却腰杆直，最瞧不上欺压穷人的" },
    { role: "跑腿小叫化", level: [0, 1], culture: "han", personality: "替分舵传话的小叫化，机灵嘴甜，给块锅盔就肯带路" },
  ],
  五仙教: [
    { role: "采蛊苗女", level: [1, 2], culture: "miao", gender: "女", personality: "背篓里窸窸窣窣不知装着什么，笑起来甜，却不许人碰她的篓子" },
    { role: "背篓药农", level: [0, 1], culture: "miao", personality: "替五仙教收山货毒草的药农，认路认草不认人" },
  ],
  天龙教: [
    { role: "血刀部游骑", level: [2, 2], culture: "tibetan", gender: "男", personality: "天龙教血刀部的游骑，刀不离身，见人先看对方是不是软柿子" },
    { role: "营里伙夫", level: [0, 1], culture: "han", gender: "男", personality: "天龙营里烧火做饭的，被抓来的，嘴上骂教主，手上不敢停" },
  ],
  三星派: [
    { role: "古墟守碑人", level: [1, 2], culture: "han", gender: "男", personality: "守着广汉古墟的三星派门人，话少，问起地底下的事就岔开" },
    { role: "拓碑弟子", level: [0, 1], culture: "han", personality: "背着拓包和纸卷，满手墨灰，见了青铜残片眼睛就发亮" },
  ],
  散人: [
    { role: "流民", level: [0, 0], personality: "逃荒来的，只想找口饭吃，对谁都提防" },
    { role: "独行游侠", level: [1, 2], personality: "无门无派，仗剑独行，最不把旁人当回事" },
    { role: "进山猎户", level: [1, 1], gender: "男", personality: "背弓挎刀进山打猎，熟悉山林野兽，话不多" },
    { role: "赶路小行商", level: [0, 1], personality: "挑着担子走村串寨，消息杂而不准，爱打听也爱说" },
  ],
};

// 每个节点：[势力, 权重] 与人数区间。势力腹地以自家人为主，商路要冲混杂。
const NODE_PASSERS = {
  鱼定村: { count: [2, 4], factions: [["鱼定村", 3], ["鱼定土司府", 2], ["玉泉寨", 1], ["喇嘛庙", 1], ["散人", 2]] },
  鱼定土司: { count: [1, 3], factions: [["鱼定土司府", 4], ["鱼定村", 1], ["散人", 1]] },
  喇嘛庙: { count: [1, 3], factions: [["喇嘛庙", 4], ["散人", 1]] },
  白塔: { count: [1, 3], factions: [["喇嘛庙", 3], ["雪山派", 1], ["散人", 1]] },
  后山平台: { count: [1, 3], factions: [["雪山派", 3], ["喇嘛庙", 1], ["散人", 1]] },
  雪山派: { count: [1, 3], factions: [["雪山派", 4], ["散人", 1]] },
  山洞: { count: [0, 1], factions: [["散人", 1]] },
  顶峰: { count: [0, 1], factions: [["散人", 1]] },
  天都镇: { count: [2, 4], factions: [["欢喜教", 2], ["百花门", 2], ["玉泉寨", 1], ["鱼定土司府", 1], ["散人", 2]] },
  大草甸: { count: [2, 4], factions: [["玉泉寨", 3], ["黑风寨", 1], ["天龙教", 1], ["散人", 2]] },
  玉泉寨: { count: [2, 4], factions: [["玉泉寨", 4], ["鱼定土司府", 1], ["散人", 1]] },
  黑风寨: { count: [1, 3], factions: [["黑风寨", 4], ["散人", 1]] },
  贡措海: { count: [1, 3], factions: [["玉泉寨", 2], ["散人", 2]] },
  雅江: { count: [2, 4], factions: [["青城派", 4], ["唐门", 1], ["散人", 2]] },
  广汉: { count: [2, 4], factions: [["丐帮三星分舵", 4], ["三星派", 1], ["锦官城", 1], ["散人", 2]] },
  锦官城: { count: [2, 4], factions: [["锦官城", 3], ["峨眉派", 2], ["唐门", 1], ["散人", 2]] },
  天龙营: { count: [1, 3], factions: [["天龙教", 5], ["散人", 1]] },
  雾隐寨: { count: [1, 3], factions: [["五仙教", 4], ["百花门", 1], ["散人", 1]] },
  蜀南唐堡: { count: [1, 3], factions: [["唐门", 4], ["散人", 1]] },
};

const pick = (list, rng) => list[Math.floor(rng() * list.length)];

function pickWeighted(entries, rng) {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r < 0) return key;
  }
  return entries[entries.length - 1][0];
}

function makeName(culture, gender, rng) {
  if (culture === "tibetan") {
    const pool = gender === "女" ? TIBETAN_FEMALE : TIBETAN_MALE;
    const first = pick(pool, rng);
    const second = pick(pool.filter((n) => n !== first), rng);
    return `${first}${second}`;
  }
  if (culture === "miao") return `${pick(MIAO_SURNAMES, rng)}${pick(gender === "女" ? MIAO_FEMALE : MIAO_MALE, rng)}`;
  return `${pick(HAN_SURNAMES, rng)}${pick(gender === "女" ? HAN_FEMALE : HAN_MALE, rng)}`;
}

let reservedNames = null;
function isReserved(name) {
  if (!reservedNames) reservedNames = new Set([...getAllResidentNpcNames(), ...NPC_POOL.map((npc) => npc.name)]);
  return reservedNames.has(name);
}

// 一天的全图名单一起排，同一天各节点不重名；reserved 是调用方要避开的名字
// （玩家认识的人、导入角色卡），名字撞上就重抽，免得好感度、认识记录串到别人身上。
function passersAt(locationName, dayIdx, used, isTaken) {
  const cfg = NODE_PASSERS[locationName];
  const rng = seededRand(dayIdx, `passers|${locationName}`);
  const [lo, hi] = cfg.count;
  const rolled = lo + Math.floor(rng() * (hi - lo + 1));
  const count = SMALL_PLACES.has(locationName)
    ? rolled
    : Math.max(rolled, MIN_PRESENT - getResidentNpcs(locationName).length);
  const out = [];
  for (let i = 0; i < count; i++) {
    const faction = pickWeighted(cfg.factions, rng);
    const role = pick(ROLES[faction], rng);
    const gender = role.gender || (rng() < 0.5 ? "男" : "女");
    const culture = role.culture || pick(["han", "han", "tibetan"], rng);
    let name = makeName(culture, gender, rng);
    for (let tries = 0; tries < 30 && isTaken(name); tries++) name = makeName(culture, gender, rng);
    if (isTaken(name)) continue;
    used.add(name);
    const [minLv, maxLv] = role.level;
    const label = faction === "散人" ? "无门无派的" : `${faction}的`;
    out.push({
      id: `passer_${locationName}_${dayIdx}_${i}`,
      name,
      brief: role.gender ? `${label}${role.role}` : `${label}${role.role}（${gender}）`,
      personality: role.personality,
      faction,
      gender,
      levelCap: minLv + Math.floor(rng() * (maxLv - minLv + 1)),
      randomPasser: dayIdx,
    });
  }
  return out;
}

// ── 移动途中的路遇：与过路人共用势力权重、身份池和姓名库 ──
export const passerFactionsAt = (locationName) => NODE_PASSERS[locationName]?.factions || null;
export const passerRolesOf = (faction) => ROLES[faction] || ROLES.散人;

// 给定势力造一个路上撞见的具名人（rng 由调用方给；isTaken 撞名就重抽，抽不开返回 null）
export function makeRoadPasser(faction, rng, isTaken = () => false) {
  const role = pick(passerRolesOf(faction), rng);
  const gender = role.gender || (rng() < 0.5 ? "男" : "女");
  const culture = role.culture || pick(["han", "han", "tibetan"], rng);
  let name = makeName(culture, gender, rng);
  for (let tries = 0; tries < 30 && (isReserved(name) || isTaken(name)); tries++) name = makeName(culture, gender, rng);
  if (isReserved(name) || isTaken(name)) return null;
  const [minLv, maxLv] = role.level;
  const label = faction === "散人" ? "无门无派的" : `${faction}的`;
  return {
    name,
    brief: role.gender ? `${label}${role.role}` : `${label}${role.role}（${gender}）`,
    role: role.role,
    personality: role.personality,
    faction,
    gender,
    levelCap: minLv + Math.floor(rng() * (maxLv - minLv + 1)),
  };
}

// 给定节点名 + 游戏时间 → 今天在此的随机过路人（纯函数，同日同地、同一组 reserved 结果一致）
export function getRandomPassers(locationName, time, reserved = new Set()) {
  if (!NODE_PASSERS[locationName]) return [];
  const dayIdx = Math.floor(time / 24);
  const used = new Set();
  const isTaken = (name) => used.has(name) || isReserved(name) || reserved.has(name);
  for (const node of Object.keys(NODE_PASSERS)) {
    const list = passersAt(node, dayIdx, used, isTaken);
    if (node === locationName) return list;
  }
  return [];
}

// 今天全图过路人的名字：路遇起名要避开，免得和某地正站着的过路人撞名
export function getTodaysPasserNames(time, reserved = new Set()) {
  const dayIdx = Math.floor(time / 24);
  const used = new Set();
  const isTaken = (name) => used.has(name) || isReserved(name) || reserved.has(name);
  for (const node of Object.keys(NODE_PASSERS)) passersAt(node, dayIdx, used, isTaken);
  return used;
}

// ── 不具名群众（路人甲乙丙）：只是此地的人气，不能对话、不记好感 ──
const CROWD_TIBETAN = ["背水的藏家妇人", "转经的老阿妈", "放羊的半大孩子", "赶牦牛的汉子", "晒青稞的女人", "拴马的马帮伙计", "捻羊毛线的老汉", "追着狗跑的娃娃", "磕长头路过的朝圣者", "蹲在墙根晒太阳的老人"];
const CROWD_HAN = ["挑担的货郎", "茶棚里打盹的老汉", "追着狗跑的孩童", "河边洗衣的妇人", "吆喝的菜贩", "抬轿的轿夫", "看热闹的闲汉", "摆卦摊的瞎子", "牵驴赶路的脚夫", "倚门嗑瓜子的妇人"];
const CROWD_MIAO = ["织布的苗家阿婆", "背竹篓的少女", "吹芦笙的后生", "溪边捣衣的妇人", "晒药草的老人", "光脚追鸡的娃娃"];
const HAN_PLACES = new Set(["天都镇", "雅江", "广汉", "锦官城", "蜀南唐堡"]);

export function getCrowd(locationName, time) {
  if (!NODE_PASSERS[locationName]) return [];
  const rng = seededRand(Math.floor(time / 24), `crowd|${locationName}`);
  const pool = locationName === "雾隐寨" ? CROWD_MIAO : HAN_PLACES.has(locationName) ? CROWD_HAN : CROWD_TIBETAN;
  const count = SMALL_PLACES.has(locationName) ? Math.floor(rng() * 2) : 3 + Math.floor(rng() * 4);
  const left = [...pool];
  const out = [];
  for (let i = 0; i < count && left.length; i++) out.push(left.splice(Math.floor(rng() * left.length), 1)[0]);
  return out;
}
