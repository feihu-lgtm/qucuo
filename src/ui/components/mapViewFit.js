export const MIN_MAP_SCALE = 0.4;
export const MAX_MAP_SCALE = 3;

export function getMapFitView(nodes, { cell = 132, pad = 40, margin = 24 } = {}) {
  if (!nodes.length) return { tx: 0, ty: 0, scale: 1 };

  const allXs = nodes.map(node => node.x);
  const allYs = nodes.map(node => node.y);
  const minX = Math.min(...allXs);
  const maxX = Math.max(...allXs);
  const minY = Math.min(...allYs);
  const maxY = Math.max(...allYs);
  const width = (maxX - minX + 1) * cell + pad * 2;
  const height = (maxY - minY + 1) * cell + pad * 2;
  const targets = nodes.filter(node => node.current || node.explored);
  const fittedNodes = targets.length ? targets : nodes;
  const labelLength = node => [...(node.name?.includes("·") ? node.name.split("·").pop() : node.name || "")].length;
  const fontSize = Math.max(2, ...nodes.map(labelLength)) >= 5 ? 18
    : Math.max(2, ...nodes.map(labelLength)) >= 4 ? 19 : 21;
  const bounds = fittedNodes.map(node => {
    const x = (node.x - minX) * cell + pad + cell / 2;
    const y = (node.y - minY) * cell + pad + cell / 2;
    const halfWidth = Math.max(cell / 2, (labelLength(node) * fontSize + 28) / 2);
    const halfHeight = Math.max(cell / 2, (fontSize + 24) / 2);
    return { left: x - halfWidth, right: x + halfWidth, top: y - halfHeight, bottom: y + halfHeight };
  });
  const left = Math.min(...bounds.map(bound => bound.left));
  const right = Math.max(...bounds.map(bound => bound.right));
  const top = Math.min(...bounds.map(bound => bound.top));
  const bottom = Math.max(...bounds.map(bound => bound.bottom));
  const scale = Math.max(MIN_MAP_SCALE, Math.min(MAX_MAP_SCALE,
    (width - margin * 2) / Math.max(1, right - left),
    (height - margin * 2) / Math.max(1, bottom - top)));
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  return { tx: width / 2 - centerX * scale, ty: height / 2 - centerY * scale, scale };
}
