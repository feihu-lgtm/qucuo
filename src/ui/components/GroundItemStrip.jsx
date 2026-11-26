import { useState } from "react";
import { Button } from "../primitives/index.js";

export default function GroundItemStrip({ items = [], theme, onPickUp }) {
  const [expanded, setExpanded] = useState(false);
  if (!items.length) return null;
  const visible = expanded ? items : items.slice(0, 3);
  return (
    <div className="mobile-ground-strip" aria-label="地上物品" style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 14px", flexShrink: 0, overflowX: "auto", color: "var(--center-outside-text)", fontSize: "var(--fs-center-meta)", borderTop: `1px solid ${theme.border}` }}>
      <span style={{ whiteSpace: "nowrap" }}>地上</span>
      {visible.map((item, index) => (
        <Button variant="chrome" font="native" active={false} type="button" key={item?.id || index} onClick={() => onPickUp(item)} title="拾取" style={{ whiteSpace: "nowrap" }}>
          {typeof item === "object" ? item.name : item}
        </Button>
      ))}
      {!expanded && items.length > visible.length && <Button variant="chrome" font="native" active={false} type="button" onClick={() => setExpanded(true)} aria-label="展开地上物品">+{items.length - visible.length}</Button>}
    </div>
  );
}
