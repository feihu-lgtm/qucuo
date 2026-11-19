export const MOBILE_DRAWER_EDGE_PX = 24;
export const MOBILE_DRAWER_SWIPE_PX = 56;

export function getMobileDrawerSwipeAction({
  startX,
  endX,
  startY = 0,
  endY = 0,
  width,
  drawer = null,
  edge = MOBILE_DRAWER_EDGE_PX,
  threshold = MOBILE_DRAWER_SWIPE_PX,
}) {
  const dx = endX - startX;
  const dy = endY - startY;
  if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy)) return null;

  if (drawer === "left" && dx < 0) return "close";
  if (drawer === "right" && dx > 0) return "close";

  if (!drawer && startX <= edge && dx >= threshold) return "left";
  if (!drawer && startX >= width - edge && dx <= -threshold) return "right";

  return null;
}
