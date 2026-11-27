// 按游戏字段查美术素材的 URL。查不到返回 null，调用方只显示文字。
// 关系约定（设计稿·夜色精修 §四「地点头图与建筑头图放哪」）：
//   天地栏小图 = 外层据点图，只在换据点时变；它和江湖栏「进场横幅」是同一张图、同一构图。
//   建筑图只出现在打开的建筑面板顶部：先查个别建筑专图，再查类型图。
//   内层房间不换小图——房间与建筑并非一一同名（村口绑着鸽子笼、后山温泉绑着医馆类型），
//   用通用类型图当「我在哪」会画错，房间身份交给地名与村图·内九宫格。
import { BUILDING_ART, BUILDING_ID_ART, HOME_ART, MAP_ART, PLACE_ART } from "../../domain/data/art/artManifest.js";

const BASE = ((import.meta.env && import.meta.env.BASE_URL) || "/") + "art/";

export function placeArtUrl(district, manifest = PLACE_ART) {
  const file = district && manifest[district];
  return file ? `${BASE}place/${file}.webp` : null;
}

export function buildingArtUrl(building, { byId = BUILDING_ID_ART, byType = BUILDING_ART } = {}) {
  if (!building) return null;
  const file = (building.id && byId[building.id]) || (building.type && byType[building.type]);
  return file ? `${BASE}building/${file}.webp` : null;
}

export function homeArtUrl(featureId, manifest = HOME_ART) {
  const file = featureId && manifest[featureId];
  return file ? `${BASE}building/${file}.webp` : null;
}

// 舆图底卷：大地图外层视图铺在节点与连线底下；没跑图时返回 null。
export function mapArtUrl(file = MAP_ART) {
  return file ? `${BASE}map/${file}.webp` : null;
}

// 主栏地名行 → 外层据点名：「    鱼定村·歇马居」「    天都镇（马车）」都归到前半段。
export function districtOfRoomLine(text) {
  const name = String(text || "").trim().replace(/（[^）]*）$/, "");
  return name ? name.split("·")[0].trim() : "";
}
