import { useState } from "react";
import { chromeBtn } from "../../utils/theme.js";

export default function GroundItemStrip({ items = [], theme, onPickUp }) {
  const [expanded, setExpanded] = useState(false);
  if (!items.length) return null;
  const visible = expanded ? items : items.slice(0, 3);
  return (
    <div className="mobile-ground-strip" aria-label="地上物品" style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 14px", flexShrink: 0, overflowX: "auto", color: theme.textDim, fontSize: "11px", borderTop: `1px solid ${theme.border}` }}>
      <span style={{ whiteSpace: "nowrap" }}>地上：</span>
      {visible.map((item, index) => (
        <button type="button" key={item?.id || index} onClick={() => onPickUp(item)} title="拾取" style={{ ...chromeBtn(theme, { active: false }), whiteSpace: "nowrap" }}>
          {typeof item === "object" ? item.name : item}
        </button>
      ))}
      {!expanded && items.length > visible.length && <button type="button" onClick={() => setExpanded(true)} aria-label="展开地上物品" style={chromeBtn(theme, { active: false })}>+{items.length - visible.length}</button>}
    </div>
  );
}
