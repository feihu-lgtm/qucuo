import "../content/loadDefaultContent.js";
import { contentEntries } from "../content/registry.js";
// 内层据点箱庭地图（两层地图架构的第二层）
// 对应总纲v3第十章设计。外层 QUCUO_MAP（qucuoMap.js）解决"曲措乡境内从哪
// 到哪"，这一层解决"在某个据点内部具体待在哪个角落"。
//
// 【本轮范围】只实现鱼定村一个据点，作为垂直切片先跑通"数据结构→resolveExit
// 改造→room state改造"这一整条链路，验证无误后再照同样模式铺开到其余13个
// 据点。不要因为看到这里只有一个据点就以为是遗漏——这是有意为之的分阶段策略，
// 见路线图相关讨论。
//
// 【坐标系统】每个据点内部坐标独立，跟外层大地图的(x,y)坐标不是一回事，
// 不能混用、不能直接比较。方向键沿用外层同一套 n/s/e/w/u/d 语义。
//
// 【锚点】district 对象上的 anchor 字段，是玩家从大地图进入这个据点时的
// 默认落脚房间，也是内层向外走回大地图时经过的房间。
//
// 【与建筑系统的关系】这里的房间只是给已有 BUILDING_TYPE 建筑（见
// buildings/qucuoBuildings.js）加一层地图外壳（坐标+出口+解锁条件），
// 不重新定义建筑本身的功能（点菜/住店/购物等仍由原有building数据和
// Screen组件负责）。房间的 buildingId 字段（若有）关联到对应建筑id。
//
// 【隐藏房间】unlockCondition 字段：值为 { type: "questCompleted", questId }
// 或 { type: "flag", flag }。房间锁定时，不出现在其父房间的可选出口列表里
// （不是"存在但打不开"，是"根本不呈现"），避免玩家瞎猜隐藏地名。判定逻辑见
// isInnerExitUnlocked()，复用与外层 unlockCondition 相同的判定语义。

import { invHasItemNamed } from "./safeHouse.js";

export const INNER_MAP = Object.fromEntries(contentEntries("district"));


// 反查：给定据点名+房间名，返回房间完整数据；不存在则返回 null
export function getInnerRoom(districtName, roomName) {
  const district = INNER_MAP[districtName];
  if (!district) return null;
  return district.rooms[roomName] || null;
}

// 给定据点名+NPC名字，返回这个NPC被登记为常驻的内层房间名；如果这个NPC
// 没有在任何内层房间被登记为 residentNpcName（游走NPC、或者这个据点根本
// 没有内层数据），返回 null。渲染层用这个函数判断"当前该不该显示这个
// NPC"——只有明确绑定了某个房间的NPC，才需要按"玩家是否站在那个房间"
// 过滤；没有绑定的NPC（游走NPC池那批、或者剧情临时加入的NPC）在整个
// 据点范围内都可能出现，不受内层房间切换影响。
// 驻场人物的内层落点：房间上的 residentNpcName 绑定优先（一间房只能绑一个人），
// 其次读驻场数据里的 innerRoom（同一间房住好几个人时用，比如峨眉剑庐的弟子们）。
// 两处都没写的驻场人物会落到锚点——数据校验测试要求有内层地图的据点必须写清。
let residentHomes = null;
function residentHome(districtName, npcName) {
  if (!residentHomes) {
    residentHomes = new Map();
    for (const [district, list] of contentEntries("residentGroup")) {
      for (const npc of list || []) if (npc?.innerRoom) residentHomes.set(`${district}|${npc.name}`, npc.innerRoom);
    }
  }
  return residentHomes.get(`${districtName}|${npcName}`) || null;
}

export function getResidentRoomForNpc(districtName, npcName) {
  const district = INNER_MAP[districtName];
  if (!district) return null;
  for (const [roomName, roomData] of Object.entries(district.rooms)) {
    if (roomData.residentNpcName === npcName) return roomName;
  }
  return residentHome(districtName, npcName);
}

// 返回某据点的锚点房间名；据点没有内层数据则返回 null（调用方应据此判断
// 这个据点是否已经完成内层箱庭改造，未改造的据点继续走原有单房间逻辑）
export function getDistrictAnchor(districtName) {
  return INNER_MAP[districtName]?.anchor || null;
}

// 判断某据点是否已经有内层箱庭数据（用于新旧两套逻辑并存期间的判断分支）
export function hasInnerMap(districtName) {
  return !!INNER_MAP[districtName];
}

// 返回某据点某内层房间关联的建筑 id（房间数据里的 buildingId 字段）；没有则 null。
// 建筑按内层房间过滤的依据：站在"歇马居"就只显示 inn_yiding，站在"村口广场"这种
// 没有 buildingId 的房间就没有建筑。
export function getBuildingIdForInnerRoom(districtName, roomName) {
  return INNER_MAP[districtName]?.rooms?.[roomName]?.buildingId || null;
}

// 判断NPC是否显示，优先级依次为：
//   1. 追踪覆写（pursuitInnerRoom）→ 只在追到的房间。
//   2. 驻场绑定（residentNpcName）→ 只在绑定房间。
//   3. 游走落点（innerRoom）→ 只在该房间。
//   4. 无上述位置时，仅在锚点显示；无追踪覆写且无内层地图时不过滤。
export function isNpcVisibleInInnerRoom(districtName, innerRoomName, npc) {
  if (typeof npc?.pursuitInnerRoom === "string") return npc.pursuitInnerRoom === innerRoomName;
  if (!hasInnerMap(districtName)) return true;
  if (!innerRoomName) return true;
  const bound = getResidentRoomForNpc(districtName, npc.name);
  if (bound) return bound === innerRoomName;
  if (npc.innerRoom) return npc.innerRoom === innerRoomName;
  return innerRoomName === getDistrictAnchor(districtName);
}

// 列出某据点内所有小地点（内层房间）名；没有内层数据则返回空数组。供调试传送等场景枚举。
export function getInnerRoomNames(districtName) {
  return Object.keys(INNER_MAP[districtName]?.rooms || {});
}

// 只列**公共**房间：把带 unlockCondition 的房间剔掉。
//
// 【为什么需要它·「乞丐与老7滚勿入」那块牌子】游走池NPC（npcPool）每天按据点
// 随机抽一个内层房间当落点，抽的是 getInnerRoomNames 的全集——包括玩家自己那间
// 上了锁的溪边小屋。于是乞丐老七大摇大摆地出现在玩家家里，而篱笆上明明钉着
// 「乞丐与老7滚勿入」的木牌：牌子是契诃夫之枪，游戏答应过他进不来。
// 同理还有白塔地宫、荤食地下室、雪山崖底、贡措海密室、欢喜堂——上了锁的地方
// 本来就不该有闲人随机溜达进去。四栋安全屋全在这 11 间里，一并解决。
// 注意这不影响**常驻NPC**：驻场人有 residentNpcName 绑定房间，走的是另一条路，
// 该在锁房里的（比如别院里的人）照旧在。
// privateHome 标的是别人家（大娘家、才旦家这类）：不上锁，玩家能进，但闲人不该天天坐在里头。
export function getPublicInnerRoomNames(districtName) {
  const rooms = INNER_MAP[districtName]?.rooms || {};
  return Object.keys(rooms).filter(n => !rooms[n].unlockCondition && !rooms[n].privateHome);
}

// 检查某据点内某房间的某方向是否有效出口，返回目的房间名或 null。
// 注意：这里只做纯查表，不做 unlockCondition 判定——跟外层 resolveExit 保持
// 同样的职责划分（查表 vs 业务判断分离），解锁判定交给下面的
// isInnerExitUnlocked 单独处理，调用方组合使用。
export function resolveInnerExit(districtName, roomName, dir) {
  const room = getInnerRoom(districtName, roomName);
  if (!room) return null;
  return room.exits[dir] || null;
}

// 返回某房间当前实际"可见"的出口方向列表（过滤掉未解锁的隐藏房间方向）。
// questProgress/flags 由调用方（MudRPG.jsx）传入当前游戏状态。
// stat 类型的房间不过滤——它们在地图上始终可见（按钮可点），由移动判定拦截。
export function visibleInnerExits(districtName, roomName, { questProgress, flags, inv, char } = {}) {
  const room = getInnerRoom(districtName, roomName);
  if (!room) return {};
  const result = {};
  for (const [dir, destName] of Object.entries(room.exits)) {
    const destRoom = getInnerRoom(districtName, destName);
    if (destRoom?.unlockCondition && destRoom.unlockCondition.type !== "stat" && !isInnerExitUnlocked(destRoom.unlockCondition, { questProgress, flags, inv, char })) {
      continue; // 未解锁的隐藏房间：根本不出现在出口列表里
    }
    result[dir] = destName;
  }
  return result;
}

// 解锁条件判定。不新造一套判定逻辑——questCompleted 直接对应
// questEngine.js 里 questProgress 的真实字段（status === "completed"，
// 不是 completed 布尔），跟外层 qucuoMap.js 黑风寨的 unlockCondition
// 判定语义保持完全一致，将来 resolveExit 补判定时可以共用同一个函数。
// 本轮鱼定村切片没有隐藏房间用到这个函数，先按总纲10.3节的约定写好，
// 供后续白塔地宫/贡措海密室等据点接入时直接复用。
export function isInnerExitUnlocked(unlockCondition, { questProgress, flags, inv, char } = {}) {
  if (!unlockCondition) return true;
  if (unlockCondition.type === "questCompleted") {
    return questProgress?.[unlockCondition.questId]?.status === "completed";
  }
  if (unlockCondition.type === "flag") {
    return (flags || []).includes(unlockCondition.flag);
  }
  if (unlockCondition.type === "anyFlag") {
    return (unlockCondition.flags || []).some(f => (flags || []).includes(f));
  }
  // 钥匙锁（安全屋四栋用）：按物品**名字**匹配，不是 id。
  // 背包里物品的 id 是入袋那一刻拼的（`${name}_${Date.now()}`），同一把钥匙
  // 每次拿到 id 都不同，拿 id 比对永远为假。name 才是全项目物品的稳定标识
  // （百物录 CATALOG_INDEX 也按 name 索引）。背包条目可能是字符串也可能是
  // 对象，两种都要认。
  if (unlockCondition.type === "item") {
    return invHasItemNamed(inv, unlockCondition.itemName);
  }
  if (unlockCondition.type === "stat") {
    const val = unlockCondition.stat === "waigong" ? char?.waigong : char?.neigong;
    return (val || 0) >= unlockCondition.threshold;
  }
  return true;
}

// 把 unlockCondition 翻成给玩家看的一句话（走到锁着的门前时提示用）。
// 只说"缺什么"，不泄露门后是什么——跟"隐藏房间根本不呈现"的原则一致：
// 玩家已经站到门口了才会看到这句，此时告知缺物是必要反馈，但仍不剧透里面。
export function describeInnerLock(unlockCondition) {
  if (!unlockCondition) return "";
  if (unlockCondition.type === "item") return `门锁着，你没有「${unlockCondition.itemName}」。`;
  if (unlockCondition.type === "flag") return "门锁着，此刻还进不去。";
  if (unlockCondition.type === "questCompleted") return "门锁着，似乎还有事没了结。";
  if (unlockCondition.type === "stat") {
    const label = unlockCondition.stat === "waigong" ? "外功" : "内功";
    return `${label}不足${unlockCondition.threshold}，强行闯入只会摔个半死。`;
  }
  return "门锁着。";
}
