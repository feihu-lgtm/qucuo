import { ITEM_CATEGORY, CATEGORY_LABEL, toggleEquip } from "../../../domain/rules/economy/equipment.js";
import { effectBrief } from "../../../domain/rules/economy/itemEffectText.js";
import { QUALITY_COLOR } from "../../../domain/data/items/qualityColor.js";
import { statLabel } from "../../format/itemStats.js";

export default function EquipmentModule({ inv, setInv }) {
  return (
    <div style={{ borderTop: `1px solid var(--border)`, paddingTop: 8, marginBottom: 10 }}>
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--accent-dim)", marginBottom: 4 }}>装备 <span style={{ color: "var(--text-dim)", fontSize: "var(--fs-2xs)" }}>点物品切换装备/卸下</span></div>
      {[ITEM_CATEGORY.WEAPON, ITEM_CATEGORY.ARMOR, ITEM_CATEGORY.ACCESSORY].map(cat => {
        const itemsInCat = inv.filter(i => typeof i === "object" && i.category === cat);
        const equippedCount = itemsInCat.filter(i => i.equipped).length;
        return (
          <div key={cat} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginBottom: 3 }}>
              {CATEGORY_LABEL[cat]} <span style={{ color: "var(--text-dim)" }}>（{itemsInCat.length}件，{equippedCount}件已装备）</span>
            </div>
            {itemsInCat.length === 0 && <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", paddingLeft: 8 }}>无</div>}
            {itemsInCat.map(item => {
              // 特效与七维加成也要显示。此前这一行只有 (紫·攻35)，玩家拿到红档神兵
              // 看不出它跟普通武器差在哪，只好得出"只加了攻防"的结论（群友实测反馈）。
              const stat = statLabel(item);
              const eff = effectBrief(item.effect, item.sixDim);
              return (
                <div
                  key={item.id}
                  onClick={() => setInv(v => toggleEquip(v, item.id))}
                  style={{ fontSize: "var(--fs-xs)", cursor: "pointer", paddingLeft: 8, marginBottom: 3,
                  color: item.equipped ? QUALITY_COLOR[item.quality] : "var(--text-dim)",
                  fontWeight: item.equipped ? "bold" : "normal",
                  wordBreak: "break-word", }}
                >
                  <div>
                    {item.equipped ? "▶" : "○"} {item.name} <span style={{ fontSize: "var(--fs-2xs)" }}>({item.quality}{stat ? `·${stat}` : ""})</span>
                  </div>
                  {eff && (
                    <div style={{ fontSize: "var(--fs-2xs)", paddingLeft: 14, color: item.equipped ? "var(--clay)" : "var(--building-desc)" }}>{eff}</div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
