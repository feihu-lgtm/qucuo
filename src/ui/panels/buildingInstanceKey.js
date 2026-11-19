export function getBuildingInstanceKey(activeBuilding, tradingShop) {
  if (activeBuilding) {
    const identity = [
      activeBuilding.house,
      activeBuilding.chestId,
      activeBuilding.id,
      activeBuilding.name,
    ].filter(value => value != null && value !== "").join(":");
    return `${activeBuilding.type || "building"}:${identity || "unknown"}`;
  }
  if (tradingShop) return `trading:${tradingShop.id || tradingShop.shopName || "shop"}`;
  return null;
}
