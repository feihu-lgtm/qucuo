export function getMapDragUpdate(drag, clientX, clientY) {
  const dx = clientX - drag.startX;
  const dy = clientY - drag.startY;
  return {
    tx: drag.baseTx + dx,
    ty: drag.baseTy + dy,
    moved: drag.moved || Math.abs(dx) > 3 || Math.abs(dy) > 3,
  };
}
