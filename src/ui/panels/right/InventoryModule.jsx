import { QUALITY_COLOR } from "../../../domain/economy/equipment.js";
import { CATALOG_INDEX } from "../../../domain/items/catalog.js";

export default function InventoryModule({ zoneTheme, inv, setActiveItemMenu }) {
  return (
    <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 8, marginBottom: 10 }}>
      <div style={{ fontSize: "11px", color: zoneTheme.accentDim, marginBottom: 4 }}>包袱 <span style={{ color: zoneTheme.textDim }}>{inv.length}件 · 点击看介绍</span></div>
      {inv.map((it, i) => {
        const isObj = typeof it === "object";
        const name = isObj ? it.name : it;
        const quality = isObj ? (it.quality || "白") : null;
        const color = isObj ? (QUALITY_COLOR[quality] || "#c4a040") : "#c4a040";
        const canConsume = !!((isObj && it.consumable) || CATALOG_INDEX[name]?.consumable);
        return (
          <div
            key={isObj ? (it.id || i) : i}
            onClick={() => setActiveItemMenu({ item: it, mode: "inventory", canConsume })}
            style={{ fontSize: "11.5px", color, cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted", textDecorationColor: color, display: "flex", alignItems: "center", gap: 4 }}
          >
            <span style={{ flex: 1 }}>· {name}{isObj ? ` (${quality})` : ""}{isObj && it.equipped ? " [已装备]" : ""}</span>
            {canConsume && <span style={{ fontSize: "10px", color: zoneTheme.accentDim, flexShrink: 0 }}>⊙用</span>}
            {isObj && !canConsume && ["weapon", "armor", "accessory"].includes(it.category) &&
              <span style={{ fontSize: "10px", color: zoneTheme.accentDim, flexShrink: 0 }}>{it.equipped ? "⊙卸" : "⊙穿"}</span>}
          </div>
        );
      })}
      {inv.length === 0 && <div style={{ color: zoneTheme.textDim, fontSize: "11.5px" }}>空空如也</div>}
    </div>
  );
}
