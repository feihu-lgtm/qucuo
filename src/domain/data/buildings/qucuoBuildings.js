// 曲措乡建筑系统：每个据点拥有的固定建筑。
// 建筑不由AI生成，跟地图节点一样是手写的固定拓扑——
// AI负责在建筑框架里描述细节和NPC对话，不负责决定"这个地方有没有铁匠铺"。
import { BUILDING_TYPE, BUILDING_TYPE_LABEL } from "./buildingType.js";
import { BUILDINGS_BY_LOCATION } from "./locations/index.js";

export { BUILDING_TYPE, BUILDING_TYPE_LABEL, BUILDINGS_BY_LOCATION };

// 各据点建筑清单
// innPrice：普通客房单夜价格
// shopKey：对应 qucuoShops.js 里的 QUCUO_SHOPS 键名
// skillSet：对应 qucuoKungfu.js 里的 SKILL_CATALOG 键名
export function getBuildingsForLocation(locationName) {
  if (!locationName) return [];
  const key = locationName.includes("·") ? locationName.split("·").pop() : locationName;
  return BUILDINGS_BY_LOCATION[key] || [];
}

// 返回建筑类型对应的中文标签
