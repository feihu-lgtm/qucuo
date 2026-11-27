import { useState } from "react";

export default function GroundItemStrip({ items = [], onPickUp }) {
  const [expanded, setExpanded] = useState(false);
  if (!items.length) return null;
  const visible = expanded ? items : items.slice(0, 3);
  return (
    <div className="mobile-ground-strip ground-strip" aria-label="地上物品">
      <span className="ground-strip-label">地上</span>
      {visible.map((item, index) => (
        <button type="button" className="ground-chip" key={item?.id || index} onClick={() => onPickUp(item)} title="拾取">
          {typeof item === "object" ? item.name : item}
        </button>
      ))}
      {!expanded && items.length > visible.length && (
        <button type="button" className="ground-chip ground-chip--more" onClick={() => setExpanded(true)} aria-label="展开地上物品">
          +{items.length - visible.length}
        </button>
      )}
    </div>
  );
}
