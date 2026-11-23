// 十二位原创武侠 OC 炫彩冒险者池（参照历代经典武侠 RPG 浪子/侠客/怪杰/江湖算师原型）。
// 既会按日随机游走刷新于世界各地据点，也会在地宫深处与玩家狭路相逢（可帮、可不管、可能反水抢宝）。
// 全部掉落物均取自 CATALOG_INDEX 真实词条，全仓无重名。

import { QUCUO_MAP } from "../map/qucuoMap.js";
import { seededRand } from "../../../utils/seededRandom.js";
import { random } from "../../../utils/rng.js";

const EXCLUDED_DISTRICTS = new Set([
  "心灵之海", "第三新东京市", "白塔", "山洞", "顶峰",
]);

export const ADVENTURER_POOL = Object.freeze([
  {
    id: "adv_yan_shisanniang",
    name: "燕十三娘",
    title: "听雨盗圣",
    archetype: "opportunist",
    archetypeLabel: "狡黠",
    rainbow: true,
    rainbowStyle: "prism",
    stealBias: 0.55,
    levelCap: 3,
    gender: "女",
    faction: "散人",
    brief: "【冒险者·听雨盗圣】红绳束发的女飞贼，指尖总转着一枚旧铜镜，行踪飘忽。",
    personality: "嘴上讲究盗亦有道，真见着罕见秘宝时手指比脑子动得还快，顺完东西还爱留句俏皮话。",
    fullBio: "早年师从川西幻戏班子，习得一手听风辨锁的轻功与指上功夫。最爱闯各派地宫密室，只为顺一件稀罕玩意儿拿去酒肆吹嘘；真被撞破也不慌，打得过就劫一笔，打不过就撒把灰溜之大吉。",
    carry: [
      { name: "百花刺", category: "weapon", quality: "蓝" },
      { name: "旧铜镜", category: "accessory", quality: "紫" },
    ],
  },
  {
    id: "adv_lu_qingshan",
    name: "陆青衫",
    title: "青衫问剑客",
    archetype: "chivalrous",
    archetypeLabel: "侠义",
    rainbow: true,
    rainbowStyle: "jade",
    stealBias: 0.15,
    levelCap: 3,
    gender: "男",
    faction: "散人",
    brief: "【冒险者·青衫问剑客】一袭洗得发白的青布衫，背负无鞘松纹剑，四处寻高手问剑。",
    personality: "宁折不弯的老派游侠，路见不平必定拔剑；受人一饭之恩必报十倍，最看不起暗算同道之辈。",
    fullBio: "游历巴蜀雪域十余载的孤剑客，曾独闯贡措海剑冢领悟剑意。常在各处地宫石窟外打探前辈剑刻，若你在地宫里拉他一把，他十有八九会把刚摸到的银两剑器分你一半。",
    carry: [
      { name: "雪山松纹剑", category: "weapon", quality: "蓝" },
      { name: "守塔僧金疮药", category: "misc", quality: "绿" },
    ],
  },
  {
    id: "adv_gu_changfeng",
    name: "顾长风",
    title: "孤舟醉刀",
    archetype: "eccentric",
    archetypeLabel: "怪杰",
    rainbow: true,
    rainbowStyle: "sunset",
    stealBias: 0.35,
    levelCap: 4,
    gender: "男",
    faction: "散人",
    brief: "【冒险者·孤舟醉刀】拎着葫芦晃荡的邋遢刀客，刀背豁口比酒壶还多。",
    personality: "醒着时懒得理人，微醺时却喜欢找顺眼的人拼刀分酒，脾气全凭当下酒兴。",
    fullBio: "自称从江东一路喝到雪山脚下的浪子，凭一柄血槽厚背刀砍穿黑风寨旧道。下地宫往往不是为寻宝，而是听说地窖阴凉适合藏酒，遇上拦路高手反而打得兴起。",
    carry: [
      { name: "血槽铁刀", category: "weapon", quality: "蓝" },
      { name: "熊山活血药膏", category: "misc", quality: "紫" },
    ],
  },
  {
    id: "adv_shen_suiyu",
    name: "沈碎玉",
    title: "百戏机关师",
    archetype: "eccentric",
    archetypeLabel: "怪杰",
    rainbow: true,
    rainbowStyle: "aurora",
    stealBias: 0.4,
    levelCap: 3,
    gender: "女",
    faction: "散人",
    brief: "【冒险者·百戏机关师】腰挂七八串黄铜钥匙与小锉刀的少女，见着机关就挪不动脚。",
    personality: "对金银没大兴趣，唯独对古蜀青铜、唐门机簧痴迷成狂，拆机关时六亲不认。",
    fullBio: "曾潜入广汉祭祀坑临摹三百张青铜枢轴图谱，被三星门人追出三十里仍笑嘻嘻地摇着铜铃跑路。地宫里最擅长拆暗箭机关，但若她看中你手上的奇巧玩意儿，也敢亮暗器讨要。",
    carry: [
      { name: "青铜小铃", category: "accessory", quality: "紫" },
      { name: "柳叶小刀", category: "weapon", quality: "绿" },
    ],
  },
  {
    id: "adv_xiao_duanshui",
    name: "萧断水",
    title: "霜刃孤客",
    archetype: "chivalrous",
    archetypeLabel: "侠义",
    rainbow: true,
    rainbowStyle: "aurora",
    stealBias: 0.2,
    levelCap: 4,
    gender: "男",
    faction: "散人",
    brief: "【冒险者·霜刃孤客】雪白斗笠压得很低，袖中冷剑出鞘必见霜华。",
    personality: "话不过三句，重诺守信；若你放他自去则相安无事，若有人挡路抢宝也绝不手软。",
    fullBio: "出自北方世家的落魄少主，只身入藏边追查当年家族失窃的密卷。常独行于高寒雪山与密室之间，随身带一柄名为「折柳」的冷冽长剑，出手凌厉却从不偷袭。",
    carry: [
      { name: "折柳", category: "weapon", quality: "蓝" },
      { name: "雪鸮翎", category: "weapon", quality: "紫" },
    ],
  },
  {
    id: "adv_pei_xiaoman",
    name: "裴小满",
    title: "市井奇侠",
    archetype: "chivalrous",
    archetypeLabel: "侠义",
    rainbow: true,
    rainbowStyle: "sunset",
    stealBias: 0.25,
    levelCap: 2,
    gender: "男",
    faction: "散人",
    brief: "【冒险者·市井奇侠】扛着铁头长棍满世界乱窜的半大青年，见谁都喊一声大哥。",
    personality: "热心肠又话痨，自诩江湖百事通，虽然实力不算顶尖，关键时刻从不掉链子。",
    fullBio: "锦官城茶棚里长大的小混混，机缘巧合救过一名老丐，学了半套打狗棒法便自号「市井奇侠」闯荡江湖。各地茶馆、暗牢甚至黑风旧窟都能撞见他拎着铁棍探头探脑。",
    carry: [
      { name: "铁头打狗棒", category: "weapon", quality: "蓝" },
      { name: "察世青布短打", category: "armor", quality: "蓝" },
    ],
  },
  {
    id: "adv_chu_baiyi",
    name: "楚白衣",
    title: "玉笛书生",
    archetype: "opportunist",
    archetypeLabel: "狡黠",
    rainbow: true,
    rainbowStyle: "jade",
    stealBias: 0.5,
    levelCap: 3,
    gender: "男",
    faction: "散人",
    brief: "【冒险者·玉笛书生】折扇轻摇的白衣文士，袖里却藏着三寸短刺。",
    personality: "温文尔雅、笑里藏刀，说话三分真七分假，合作分宝时最爱在账目上动心眼。",
    fullBio: "落第秀才出身，弃笔从武后专研江湖秘史与前朝地契。常借探幽访古之名出入名山古刹，口称与人为善，但见了厚利也常顺手牵羊，让人防不胜防。",
    carry: [
      { name: "听风柳叶铜剑", category: "weapon", quality: "蓝" },
      { name: "鸡足山贝叶经残片", category: "accessory", quality: "紫" },
    ],
  },
  {
    id: "adv_wen_jiuyou",
    name: "温九幽",
    title: "红袖毒医",
    archetype: "greedy",
    archetypeLabel: "贪财",
    rainbow: true,
    rainbowStyle: "prism",
    stealBias: 0.65,
    levelCap: 3,
    gender: "女",
    faction: "散人",
    brief: "【冒险者·红袖毒医】披着暗红百花绸衣的冷艳女子，指尖染着淡紫药渍。",
    personality: "诊金和战利品都算得极精，绝不吃半点亏；若救了她她会丢药报答，若没防备她也敢黑吃黑。",
    fullBio: "游走巴蜀苗疆之间的奇医，为了搜罗「守宫砂」「雪莲清毒丸」等罕见药材常孤身下毒窟暗阁。对她而言，天下珍稀药草比人命金贵得多。",
    carry: [
      { name: "百花楼绸衣", category: "armor", quality: "蓝" },
      { name: "雪莲清毒丸", category: "misc", quality: "蓝" },
    ],
  },
  {
    id: "adv_xie_wujiu",
    name: "谢无咎",
    title: "玄甲散人",
    archetype: "greedy",
    archetypeLabel: "贪财",
    rainbow: true,
    rainbowStyle: "sunset",
    stealBias: 0.7,
    levelCap: 4,
    gender: "男",
    faction: "散人",
    brief: "【冒险者·玄甲散人】背负重盾护心镜的彪形大汉，满脸横肉却步履沉稳。",
    personality: "认钱不认人，只信手里攥着的真金白银与重甲；地宫里遇上他，先防他抢箱子。",
    fullBio: "原是西域商队重金雇来的保镖头子，后来觉得抢地宫比护商来钱快得多。仗着一身护心重甲横冲直撞，专盯刚从秘宝室走出来的落单旅人。",
    carry: [
      { name: "玄甲护心镜", category: "armor", quality: "紫" },
      { name: "西域弯刀", category: "weapon", quality: "绿" },
    ],
  },
  {
    id: "adv_lin_shuying",
    name: "林疏影",
    title: "锦衣夜行",
    archetype: "opportunist",
    archetypeLabel: "狡黠",
    rainbow: true,
    rainbowStyle: "aurora",
    stealBias: 0.6,
    levelCap: 3,
    gender: "女",
    faction: "散人",
    brief: "【冒险者·锦衣夜行】黑绸劲装束腰的冷面游侠，来去全无脚步声。",
    personality: "极讲分寸却也极现实，帮你是顺路，抢你是生意，一切全看当下筹码。",
    fullBio: "昔日锦官城暗桩出身，厌倦了衙门差遣后退隐江湖专接地下摸金买卖。熟悉南北暗牢与各大宗门密道，若在地宫撞上她，最好盯紧自己的钱袋。",
    carry: [
      { name: "牧云", category: "weapon", quality: "蓝" },
      { name: "锦官制式软甲", category: "armor", quality: "蓝" },
    ],
  },
  {
    id: "adv_qi_tiedan",
    name: "齐铁胆",
    title: "铁胆镖痴",
    archetype: "chivalrous",
    archetypeLabel: "侠义",
    rainbow: true,
    rainbowStyle: "jade",
    stealBias: 0.18,
    levelCap: 2,
    gender: "男",
    faction: "散人",
    brief: "【冒险者·铁胆镖痴】胸前总挂着半截旧镖旗的硬汉，嗓门大得能震落屋檐灰。",
    personality: "憨直倔强、讲义气到死，最痛恨背后捅刀与黑吃黑，受恩定当场还清。",
    fullBio: "曾走遍川西七十二道险滩的老镖头后人，为寻一批十年前失踪在黑风寨的旧镖而闯荡各地地宫。遇上迷路的江湖后辈总要搭把手护送一程。",
    carry: [
      { name: "八袋青竹护心甲", category: "armor", quality: "紫" },
      { name: "护法铜杖", category: "weapon", quality: "绿" },
    ],
  },
  {
    id: "adv_hua_jieyu",
    name: "花解语",
    title: "星槎算师",
    archetype: "greedy",
    archetypeLabel: "贪财",
    rainbow: true,
    rainbowStyle: "prism",
    stealBias: 0.72,
    levelCap: 3,
    gender: "女",
    faction: "散人",
    brief: "【冒险者·星槎算师】右手拨一只金珠算盘的笑面女子，算珠响处往往银钱易主。",
    personality: "笑眯眯地替你算吉凶、分宝藏，算盘一打完不是坑你半袋银子就是顺手捞走秘宝。",
    fullBio: "自诩能以奇门星数推演宝藏方位的奇女子，在天都镇茶馆和各大古墓间兜售秘图。和她共探地宫可得睁大眼睛——她的金珠算盘可不只是用来算账的，砸人一样疼。",
    carry: [
      { name: "金珠算盘", category: "weapon", quality: "蓝" },
      { name: "磨损藏银火镰", category: "accessory", quality: "紫" },
    ],
  },
]);

export const ADVENTURER_BY_NAME = Object.freeze(
  Object.fromEntries(ADVENTURER_POOL.map((adv) => [adv.name, adv])),
);

export function isAdventurerName(name) {
  return Boolean(name && ADVENTURER_BY_NAME[name]);
}

function getActiveWorldDistricts() {
  return Object.keys(QUCUO_MAP).filter((name) => !EXCLUDED_DISTRICTS.has(name));
}

// 每天把 12 位冒险者按确定性种子分布到世界各地据点（同一天每人只落在一个据点，跨天自动换城）。
export function getWorldAdventurers(districtName, time = 0) {
  if (!districtName || EXCLUDED_DISTRICTS.has(districtName) || !QUCUO_MAP[districtName]) return [];
  const districts = getActiveWorldDistricts();
  if (!districts.length) return [];

  const dayIdx = Math.floor((time ?? 0) / 24);
  const matched = [];
  for (const adv of ADVENTURER_POOL) {
    const rng = seededRand(dayIdx, `world_adv_${adv.id}`);
    const targetDistrict = districts[Math.floor(rng() * districts.length) % districts.length];
    if (targetDistrict === districtName) {
      matched.push({
        ...adv,
        adventurer: true,
        adventurerDay: dayIdx,
      });
    }
  }
  return matched;
}

// 供地宫内随机遭遇抽取一名冒险者（尽量避开本趟已遇过的角色）。
export function pickDungeonAdventurer(excludeIds = []) {
  const excluded = new Set(excludeIds);
  const candidates = ADVENTURER_POOL.filter((adv) => !excluded.has(adv.id));
  const pool = candidates.length ? candidates : ADVENTURER_POOL;
  return pool[Math.floor(random() * pool.length) % pool.length];
}
