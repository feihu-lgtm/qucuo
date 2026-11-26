// ── WO-22A 容器坍缩（纯函数层）──────────────────────────────────
// 底稿 2.4：每个房间的容器在第一次被翻时才定下内容，定下即记为事实；
// collapsed:true 之后再翻只会得到「翻不出新东西」。
// 状态落点：varTree.世界.容器[据点/房名][容器名] = { collapsed, presetItems? }
// ——懒初始化：旧档没有该字段不炸，首次用到才补；引擎/domain 不直写 store，
// 坍缩写一律经判官事实 COLLAPSE_CONTAINER → materializeFacts → applyPatches。
//
// 容器清单由房间内容表声明（district 房间定义的可选 containers 数组）：
//   containers: [{ name, presetItems?: [{id?,name,desc?,quality?,category?}] }]
// 未声明的房间没有任何容器——前哨不渲染、翻找无从谈起，不编造。

// 房间声明的容器清单（规整化；非法条目丢弃）
// ── D2 容器默认模板/归属人 owner/翻箱目击 ─────────────────────────
// 未声明 containers 的房间按五类性质赋默认容器表；owner 确定性推导，
// 无主为 ""。模板容器条目带 isTemplate:true——翻空兜底走 65/25/10 三档，
// 不再 100% 残页（见 inspectContainer.js）。
// D2 Review 修：不直引 innerMap.js——其行首副作用 import loadDefaultContent 会在
// 判官模块图上拖入全量 content 形成循环（FIELDS 未初始化）。同源替代：INNER_MAP
// 本就 built from contentEntries("district")，这里直查 registry 同一份数据。
function hasInnerMap(districtName) {
  return contentEntries("district").some(([k]) => k === districtName);
}
import { getHomestead } from "../map/homestead.js";
import { BUILDINGS_BY_LOCATION, BUILDING_TYPE } from "../../data/buildings/qucuoBuildings.js";
import { contentEntries } from "../content/registry.js";

const FOOD_TYPES = new Set([BUILDING_TYPE.RESTAURANT, BUILDING_TYPE.TEAHOUSE, BUILDING_TYPE.KITCHEN]);
const SHOP_TYPES = new Set([
  BUILDING_TYPE.SHOP, BUILDING_TYPE.SMITHY, BUILDING_TYPE.MEDICINE, BUILDING_TYPE.HOSPITAL,
  BUILDING_TYPE.GAMBLESTONE, BUILDING_TYPE.PAWN, BUILDING_TYPE.TRANSPORT, BUILDING_TYPE.ANTIQUE,
  BUILDING_TYPE.GROCERY, BUILDING_TYPE.CLOTH, BUILDING_TYPE.JEWELRY, BUILDING_TYPE.FORGE,
  BUILDING_TYPE.SECTSHOP, BUILDING_TYPE.BLACKMARKET, BUILDING_TYPE.AUCTION, BUILDING_TYPE.ESCORT,
  BUILDING_TYPE.INN, BUILDING_TYPE.BANK, BUILDING_TYPE.GAMBLING, BUILDING_TYPE.THEATER, BUILDING_TYPE.LIBRARY,
]);
const FOOD_NAME_RE = /酒馆|茶肆|茶馆|饭馆|食肆|庖厨|后厨|小馆/;
const SHOP_NAME_RE = /商号|铺|坊|行|阁|堂|肆/;
const HOME_NAME_RE = /家|居|屋|卧房|厢房|闺房|小院|禅房|弟子房/;
const WILD_DISTRICT_RE = /草甸|山|洞|峰|谷|林|海|滩|崖|口|道|坡/;
const WILD_ROOM_RE = /后山|崖|洞|林|草|溪|潭/;

const TEMPLATES = {
  food: { names: ["灶台", "酒坛", "后厨"] },
  shop: { names: ["货架", "柜台", "库房角落"] },
  home: { names: ["木箱", "柜子", "床底", "灶台"] },
  wild: { names: ["草丛", "石缝", "树洞"] },
  street: { names: ["墙角", "路边", "井台"] },
};

function buildingTypesFor(districtName) {
  const key = (districtName || "").includes("·") ? districtName.split("·").pop() : (districtName || "");
  return new Set((BUILDINGS_BY_LOCATION[key] || []).map((b) => b?.type).filter(Boolean));
}

// 五类房间性质归类（唯一顺序：饭馆→商铺→民居→野外→村口街道兜底）
export function classifyRoomNature({ districtName = "", innerRoomName = null, innerDef = null } = {}) {
  const roomName = innerRoomName || districtName || "";
  const types = buildingTypesFor(districtName);
  // 内层房间的建筑归属优先：innerDef.buildingId 对应的建筑类型
  let innerTypes = new Set();
  if (innerDef?.buildingId) {
    for (const list of Object.values(BUILDINGS_BY_LOCATION)) {
      for (const b of list || []) {
        if (b?.id === innerDef.buildingId && b?.type) innerTypes.add(b.type);
      }
    }
  }
  // 据点级建筑类型仅外层房间（innerRoomName 为空）作数——内层房间只认自身
  // buildingId 关联，否则村里有酒楼就把所有民居错归饭馆。
  const effTypes = innerTypes.size ? innerTypes : (innerRoomName == null ? types : new Set());
  if ([...effTypes].some((t) => FOOD_TYPES.has(t)) || FOOD_NAME_RE.test(roomName)) return "food";
  if ([...effTypes].some((t) => SHOP_TYPES.has(t)) || (SHOP_NAME_RE.test(roomName) && !FOOD_NAME_RE.test(roomName))) return "shop";
  if (innerDef?.privateHome === true || getHomestead(innerRoomName || "") || HOME_NAME_RE.test(roomName)) return "home";
  // 野外：无内层箱庭且据点属山野地名；或内层房名带后山/崖/洞/林/草/溪/潭
  if ((!hasInnerMap(districtName) && WILD_DISTRICT_RE.test(districtName || ""))
    || (innerRoomName && WILD_ROOM_RE.test(innerRoomName))) return "wild";
  return "street";
}

// owner 确定性推导：房间绑定常驻人物优先，再扫 residentGroup innerRoom 命中；
// 玩家自有安全屋 owner 置空串（翻自己家不算偷翻）；皆无则 ""。
export function deriveContainerOwner({ districtName = "", innerRoomName = null, innerDef = null, nature = "" } = {}) {
  if (nature === "wild" || nature === "street") return "";
  if (innerRoomName && getHomestead(innerRoomName)) return ""; // 自己家
  if (innerDef?.residentNpcName) return innerDef.residentNpcName;
  if (innerRoomName) {
    for (const [district, list] of contentEntries("residentGroup")) {
      if (district !== districtName) continue;
      for (const npc of list || []) {
        if (npc?.innerRoom === innerRoomName && npc?.name) return npc.name;
      }
    }
  }
  return "";
}

// 房间有效容器表：显式声明优先（未写 owner 的按本房归属补齐），未声明按性质赋模板。
// 输出 [{ name, presetItems, isTemplate, owner }]
export function effectiveContainers({ districtName = "", innerRoomName = null, innerDef = null } = {}) {
  const nature = classifyRoomNature({ districtName, innerRoomName, innerDef });
  const owner = deriveContainerOwner({ districtName, innerRoomName, innerDef, nature });
  const declared = declaredContainers(innerDef);
  if (declared.length) {
    return declared.map((c) => ({ ...c, isTemplate: false, owner: c.owner ?? owner }));
  }
  return TEMPLATES[nature].names.map((name) => ({ name, presetItems: [], isTemplate: true, owner: nature === "wild" || nature === "street" ? "" : owner }));
}

// D2 翻箱目击检定：NPC 无 alertness 字段，纯函数推导。
export function computeNpcAlertness(npc) {
  let v = 6 + Math.min(4, Number(npc?.levelCap) || 0);
  const text = `${npc?.personality || ""}${npc?.brief || ""}`;
  if (/精明|多疑|阴鸷|警觉|老辣|谨慎/.test(text)) v += 2;
  if (/憨厚|粗豪|迷糊|醉/.test(text)) v -= 1;
  return v;
}

export function declaredContainers(roomDef) {
  const list = Array.isArray(roomDef?.containers) ? roomDef.containers : [];
  return list
    .filter((c) => c && typeof c.name === "string" && c.name.trim())
    .map((c) => ({
      name: c.name.trim(),
      presetItems: (Array.isArray(c.presetItems) ? c.presetItems : [])
        .filter((it) => it && typeof it.name === "string" && it.name.trim())
        .map((it) => ({ ...it })),
    }));
}

// 读 varTree 里某房间某容器的坍缩状态；未记录/旧档无字段一律 false（未坍缩）
export function isContainerCollapsed(varTree, place, containerName) {
  return !!varTree?.世界?.容器?.[place]?.[containerName]?.collapsed;
}

// 组装判官 envelope 的容器视图：declared 声明 ∪ varTree 已记录状态。
// 输出 { [容器名]: { collapsed, presetItems } }——presetItems 只来自内容表
// 声明（剧本写死的东西），坍缩状态只来自 varTree（事实账本）。
export function containerViewForRoom(varTree, place, roomDef, env = null) {
  const view = {};
  const recorded = varTree?.世界?.容器?.[place] || {};
  // D2：env 提供 district/inner 上下文时，未声明房间按五类性质出模板容器；
  // 显式声明维持原样（只补 owner），保证旧剧本房行为不变。
  const list = env
    ? effectiveContainers({ districtName: env.districtName, innerRoomName: env.innerRoomName, innerDef: roomDef })
    : declaredContainers(roomDef).map((c) => ({ ...c, isTemplate: false, owner: "" }));
  for (const decl of list) {
    view[decl.name] = {
      collapsed: !!recorded[decl.name]?.collapsed,
      presetItems: decl.presetItems,
      isTemplate: decl.isTemplate === true,
      owner: decl.owner || "",
    };
  }
  return view;
}

// 备料候选容器名单（#524 Review：prompt/ingest/runner 三处同源的单一口径）：
// 未坍缩 且 无预设物——有预设物的容器首翻必中预设+即坍缩（judgeTurn 第一关），
// 备料物永不兑现，列给模型只会产出被 ingest 丢弃的废草案。
export function prepEligibleContainerNames(containerView) {
  return Object.entries(containerView || {})
    .filter(([, c]) => c && c.collapsed !== true && !(Array.isArray(c.presetItems) && c.presetItems.length))
    .map(([name]) => name);
}

// 前哨「可翻找容器」名单：只列未坍缩的——已坍缩的翻了也白翻，
// 列出来只会诱导模型反复写翻箱。无声明/全坍缩返回空数组。
// WO-22B-P2 裁决例外：有未定悬空秘宝（hasFloating）时，已坍缩容器仍列为
// 可翻落点——秘宝是地域级落点事件而非容器普通内容物；无秘宝时维持 WO-22A 原样。
export function intakeContainerLines(varTree, place, roomDef, { hasFloating = false, env = null } = {}) {
  const view = containerViewForRoom(varTree, place, roomDef, env);
  return Object.entries(view)
    .filter(([, v]) => !v.collapsed || hasFloating)
    .map(([name, v]) => (v.owner ? `${name}(有主:${v.owner})` : name));
}

// 判官容器上下文一站解析（runTurn 真实判官与 shadowJudge 影子共用同一入口——
// 同源口径只能靠"只此一处计算"钉死，各算各的迟早漂移）。
// 入参：districtName（room.name 据点名）、innerRoomName、varTree、roomDefLookup。
// 输出 { containerPlace, containerView, openContainers }。
export function resolveContainerContext({ districtName, innerRoomName, varTree, roomDefLookup, hasFloating = false }) {
  const innerDef = innerRoomName != null && typeof roomDefLookup === "function"
    ? roomDefLookup(districtName, innerRoomName)
    : null;
  // D2：外层野外据点 innerDef 恒 null——模板判定不看 innerDef 而看
  // districtName/innerRoomName 双层（classifyRoomNature 内部处理），外层不再零容器。
  const env = { districtName: districtName || "", innerRoomName: innerRoomName ?? null };
  const containerPlace = innerRoomName != null
    ? `${districtName || ""}/${innerRoomName}`
    : (districtName || "");
  return {
    containerPlace,
    containerView: containerViewForRoom(varTree, containerPlace, innerDef, env),
    openContainers: intakeContainerLines(varTree, containerPlace, innerDef, { hasFloating, env }),
  };
}
