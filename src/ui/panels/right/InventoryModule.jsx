import { CATALOG_INDEX } from "../../../domain/data/items/catalog.js";
import { setActiveItemMenu } from "../../../store/sessionUiStore.js";
import { QUALITY_COLOR } from "../../../domain/data/items/qualityColor.js";

export default function InventoryModule({ inv }) {
  return (
    <div style={{ borderTop: `1px solid var(--border)`, paddingTop: 8, marginBottom: 10 }}>
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--accent-dim)", marginBottom: 4 }}>包袱 <span style={{ color: "var(--text-dim)" }}>{inv.length}件 · 点击看介绍</span></div>
      {inv.map((it, i) => {
        const isObj = typeof it === "object";
        const name = isObj ? it.name : it;
        const quality = isObj ? (it.quality || "白") : null;
        const color = isObj ? (QUALITY_COLOR[quality] || "var(--gold)") : "var(--gold)";
        const canConsume = !!((isObj && it.consumable) || CATALOG_INDEX[name]?.consumable);
        return (
          <div
            key={isObj ? (it.id || i) : i}
            onClick={() => setActiveItemMenu({ item: it, mode: "inventory", canConsume })}
            style={{ fontSize: "var(--fs-sm)", color, cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted", textDecorationColor: color, display: "flex", alignItems: "center", gap: 4 }}
          >
            <span style={{ flex: 1 }}>· {name}{isObj ? ` (${quality})` : ""}{isObj && it.equipped ? " [已装备]" : ""}</span>
            {canConsume && <span style={{ fontSize: "var(--fs-2xs)", color: "var(--accent-dim)", flexShrink: 0 }}>⊙用</span>}
            {isObj && !canConsume && ["weapon", "armor", "accessory"].includes(it.category) &&
              <span style={{ fontSize: "var(--fs-2xs)", color: "var(--accent-dim)", flexShrink: 0 }}>{it.equipped ? "⊙卸" : "⊙穿"}</span>}
          </div>
        );
      })}
      {inv.length === 0 && <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-sm)" }}>空空如也</div>}
    </div>
  );
}
