import { CATALOG_INDEX } from "../../../domain/data/items/catalog.js";
import { setActiveItemMenu } from "../../../store/sessionUiStore.js";
import { QUALITY_COLOR } from "../../../domain/data/items/qualityColor.js";
import ItemIcon from "../../components/ItemIcon.jsx";

export default function InventoryModule({ inv }) {
  const rows = inv.map((it, i) => {
    const isObj = typeof it === "object";
    const name = isObj ? it.name : it;
    const quality = isObj ? (it.quality || "白") : null;
    const color = isObj ? (QUALITY_COLOR[quality] || "var(--warn)") : "var(--text)";
    const canConsume = !!((isObj && it.consumable) || CATALOG_INDEX[name]?.consumable);
    const tag = isObj && it.equipped ? "已披挂"
      : canConsume ? "用"
      : (isObj && ["weapon", "armor", "accessory"].includes(it.category)) ? "穿"
      : "";
    return (
      <div
        key={isObj ? (it.id || i) : i}
        onClick={() => setActiveItemMenu({ item: it, mode: "inventory", canConsume })}
        className="pack-row"
      >
        <button
          type="button"
          className="pack-row-art"
          onClick={(e) => { e.stopPropagation(); setActiveItemMenu({ item: it, mode: "inventory", canConsume, zoom: true }); }}
          title="放大看看"
          aria-label={`放大看看${name}`}
        >
          <ItemIcon item={it} size="xs" />
        </button>
        <span className="pack-row-name" style={{ color }}>
          {name}{isObj && quality !== "白" ? <span className="pack-row-q">（{quality}）</span> : ""}
        </span>
        {tag && <span className="pack-row-tag">{tag}</span>}
      </div>
    );
  });

  return (
    <div className="right-section">
      <div className="panel-sec-label">
        包袱 <span className="panel-sec-sub">{inv.length}件 · 点击看介绍</span>
      </div>
      {rows}
      {inv.length === 0 && <div className="panel-empty-dim">空空如也</div>}
    </div>
  );
}
