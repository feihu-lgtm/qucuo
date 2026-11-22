// 势力伏击：合稿「不共戴天」档（声誉 ≤ -60）的敌对势力会截杀玩家。
// 移动时按合稿条件判定一次——命中即强制开战（forcedDuelNpc 通道，
// 切磋结算照常写战报/掉落）。叛出本派扣 -60 后自然落入此通道（如叛出唐门 → 暗杀组）。
// 三种形态都照合稿原文登记，一条 squad 可混用：
//   chance —— 游走伏击：任意移动都可能命中（唐门暗杀组）。
//   at:{district,inner} —— 踏进指定内层房判定（欢喜教香行）。
//   places —— 多地点锁定：键是外层据点名（"鱼定土司"）或「据点·内层房」（"雅江·青城山山门"），
//             值是命中概率，合稿写「必遭/即遭」的记 1。外层键走大地图判定，复合键走房间判定。
// 只登记合稿写清触发条件+地点的伏击方；别家照此表加条目即可，不用动机制。
// 注意：defectedFlag 必须在文件顶层求值之后才可用，所以登记表在 import 之后。
import { factionRepOf } from "../economy/factionRep.js";
import { defectedFlag } from "../character/factionEntry.js";
import { ensureNpcCombatData } from "../npc/npcGeneration.js";
import { seededRand } from "../../../utils/seededRandom.js";

export const AMBUSH_SQUADS = [
  {
    faction: "唐门",
    // 合稿·唐门：叛出/逐出扣 -60，声誉跌破 -60 后「派出暗杀组在大地图随机伏击」；
    // 强入蜀南唐堡或锦官城暗巷铺面「触发唐门护卫与暗器死士主动截杀」。
    member: {
      name: "唐门暗弩手",
      levelCap: 3,
      brief: "唐门暗杀组，玄衣蒙面，袖藏连珠毒弩，奉命清理门户。",
      faction: "唐门",
      tag: "tangmen_assassin",
    },
    approach: "一支淬毒的弩矢擦着耳畔钉进土里——玄衣人自暗处掠出，唐门的暗杀组寻到了你！",
    chance: 0.35,
    places: { 蜀南唐堡: 1, "锦官城·唐门暗巷": 1 },
    // 叛出本派者按合稿就该被追杀——叛出只把声誉重置到 -40（不到 -60 线），
    // 拿叛出旗另开一道门，不改 DEFECT_REP 既定数值。
    traitorFlag: defectedFlag("唐门"),
  },
  {
    faction: "欢喜教",
    // 合稿·欢喜教：声誉 ≤ -60「踏入天都香行前厅即触发老何率内院弟子持械截杀」——按房间判定，踏入必中。
    at: { district: "天都镇", inner: "天都香行" },
    member: {
      name: "欢喜教内院弟子",
      levelCap: 2,
      brief: "老何手下的内院弟子，粗布短褂，腰插擦得雪亮的短弯刀，袖里藏着迷香。",
      faction: "欢喜教",
      tag: "huanxi_guard",
    },
    approach: "柜台后的算盘声戛然而止——老何从竹帘后踱出，一挥手，几名内院弟子拔出短弯刀围了上来：「香行不做你的生意，命留下！」",
    chance: 1,
  },
  {
    faction: "鱼定土司府",
    // 合稿·土司府 ≤ -60：踏入府门即遭巡捕营主动截杀；白玛次仁带队在大草甸/鱼定村外围截击。
    member: {
      name: "巡捕营校尉",
      levelCap: 3,
      brief: "土司府巡捕营的带队校尉，白玛次仁麾下，挎长矛背海捕文书。",
      faction: "鱼定土司府",
      tag: "tusi_patrol",
    },
    approach: "坡下马蹄声卷来——白玛次仁麾下的巡捕营校尉抖开海捕文书：「通缉在案，拿下！」",
    places: { 鱼定土司: 1, 大草甸: 0.35, 鱼定村: 0.35 },
  },
  {
    faction: "雪山派",
    // 合稿·雪山派 ≤ -60：山门彻底封禁，强闯触发陆寒枝与门派弟子联合截杀。
    member: {
      name: "雪山派截杀弟子",
      levelCap: 4,
      brief: "随陆寒枝守山的雪山弟子，白衣负剑，结阵封住山口。",
      faction: "雪山派",
      tag: "xueshan_warrior",
    },
    approach: "雪雾里数道白影掠出结阵——陆寒枝按剑立在阵前：「封山已下，擅入者死！」",
    places: { 雪山派: 1 },
  },
  {
    faction: "喇嘛庙",
    // 合稿·喇嘛庙 ≤ -60：强闯山门与白塔必遭罗布桑率守塔僧团截杀。
    member: {
      name: "守塔武僧",
      levelCap: 3,
      brief: "罗布桑率领的守塔僧团成员，持镔铁禅杖，守山门与白塔。",
      faction: "喇嘛庙",
      tag: "lama_guard",
    },
    approach: "诵经声骤止——罗布桑率守塔僧团持杖列阵：「毁佛恶魔，也敢踏入圣地！」",
    places: { 喇嘛庙: 1, 白塔: 1 },
  },
  {
    faction: "锦官城",
    // 合稿·锦官城官府 ≤ -60：列入《西路甲等海捕文书》，进入锦官城北必遭裴九江率快班围捕。
    member: {
      name: "快班捕头",
      levelCap: 3,
      brief: "锦官城都事府快班捕头，奉裴九江之命围捕甲等通缉犯。",
      faction: "锦官城",
      tag: "jinguan_constable",
    },
    approach: "街口梆子声急响——裴九江的快班捕头带人围拢：「海捕文书上的人，拿下！」",
    places: { 锦官城: 1 },
  },
  {
    faction: "五仙教",
    // 合稿·五仙教 ≤ -60：踏入雾隐寨即触发守卫截杀。
    member: {
      name: "雾隐寨守卫",
      levelCap: 3,
      brief: "守在五仙教北坛藤桥隘口的守卫，袖缠蛊铃，见外人便放信虫。",
      faction: "五仙教",
      tag: "wuxian_guard",
    },
    approach: "蛊铃急响惊起满林虫鸣——雾隐寨守卫拦住藤桥：「外人不许入寨，杀无赦！」",
    places: { 雾隐寨: 1 },
  },
  {
    faction: "黑风寨",
    // 合稿·黑风寨 ≤ -60：踏入黑风寨即触发寨门刀口主动截杀。
    member: {
      name: "寨门刀口",
      levelCap: 3,
      brief: "黑风寨寨门上值守的刀口，脸罩兽皮，握环首宽刀。",
      faction: "黑风寨",
      tag: "heifeng_blade",
    },
    approach: "寨门上一声哨响——蒙面刀口翻身拦路，环首宽刀劈头就砍：「哪来的肥羊！」",
    places: { 黑风寨: 1 },
  },
  {
    faction: "丐帮三星分舵",
    // 合稿·丐帮 ≤ -60：强闯破庙触发胡三爷带执法弟子主动截杀。
    member: {
      name: "丐帮执法弟子",
      levelCap: 3,
      brief: "跟胡三爷守分舵的执法弟子，竹杖青布，眼神不善。",
      faction: "丐帮三星分舵",
      tag: "gaibang_enforcer",
    },
    approach: "破庙里数条竹杖顿地——胡三爷领着执法弟子围上：「帮里通缉的人，也敢闯分舵？」",
    places: { "广汉·破庙前院·粥棚与竹坪": 1 },
  },
  {
    faction: "青城派",
    // 合稿·青城派 ≤ -60：严禁踏过安澜索桥进入青城山门，强闯触发松鹤道长率弟子布阵截杀。
    member: {
      name: "青城剑阵弟子",
      levelCap: 3,
      brief: "松鹤道长座下守山弟子，青袍双剑，在山门列剑阵。",
      faction: "青城派",
      tag: "qingcheng_sword",
    },
    approach: "山门口剑光织成一片——松鹤道长的守山弟子列阵拦路：「青城禁地，退下！」",
    places: { "雅江·青城山山门": 1 },
  },
];

const isHostile = (state, squad) => factionRepOf(state.varTree, squad.faction) <= -60
  || Boolean(squad.traitorFlag && (state.flags || []).includes(squad.traitorFlag));

// 伏击者不进 room.npcs，开打前先把 combat 数据补齐（moveset/战力/随身物），
// 不然决斗屏拿空招式集，回合全被挡。
const ambushOf = (squad) => ({ npc: ensureNpcCombatData({ ...squad.member }), text: squad.approach });

// 大地图/外层据点判定：places 的外层据点名键优先，其次游走 chance；
// 只写了 at/复合 places 的据点锁 squad 不参与大地图掷骰。
// 纯判定便于测试：rng 可注入；命中返回伏击成员 NPC 或 null。
export function pickAmbusher(state, rng = seededRand(Math.floor((state.time || 0) / 24), state.room?.name || "")) {
  for (const squad of AMBUSH_SQUADS) {
    if (!isHostile(state, squad)) continue;
    const chance = squad.places?.[state.room?.name] ?? (squad.at ? null : squad.chance);
    if (!chance) continue;
    if (rng() < chance) return ambushOf(squad);
  }
  return null;
}

// 内层房判定：places 的「据点·内层房」复合键，或 at:{district,inner} 单点登记。
// 踏进指定房间才判定，不随大地图移动掷骰。
export function pickRoomAmbusher(state, rng = seededRand(Math.floor((state.time || 0) / 24), `${state.room?.name || ""}/${state.innerRoomName || ""}`)) {
  const district = state.room?.name;
  const placeKey = `${district}·${state.innerRoomName}`;
  for (const squad of AMBUSH_SQUADS) {
    if (!isHostile(state, squad)) continue;
    const chance = squad.places?.[placeKey]
      ?? (squad.at?.district === district && squad.at?.inner === state.innerRoomName ? squad.chance : null);
    if (!chance) continue;
    if (rng() < chance) return ambushOf(squad);
  }
  return null;
}

const toAmbushResult = (hit) => hit && { logs: [{ t: "err", text: `  ${hit.text}` }], forcedDuelNpc: hit.npc };

export const factionAmbushRule = {
  id: "map.faction-ambush",
  deps: (state) => [state.room?.name],
  run(state) {
    if (!state.room?.name) return null;
    return toAmbushResult(pickAmbusher(state));
  },
};

export const factionRoomAmbushRule = {
  id: "map.faction-room-ambush",
  deps: (state) => [state.room?.name, state.innerRoomName],
  run(state) {
    if (!state.room?.name || !state.innerRoomName) return null;
    return toAmbushResult(pickRoomAmbusher(state));
  },
};
