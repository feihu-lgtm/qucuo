export const MIN_MAP_NODE_HIT_SIZE = 100;

export function makeNodeHitArea(cx, cy, width, height, minSize = MIN_MAP_NODE_HIT_SIZE) {
  const hitWidth = Math.max(width, minSize);
  const hitHeight = Math.max(height, minSize);
  return {
    x: cx - hitWidth / 2,
    y: cy - hitHeight / 2,
    width: hitWidth,
    height: hitHeight,
  };
}
