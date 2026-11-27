import { ITEM_CATEGORY, CATEGORY_LABEL, toggleEquip } from "../../../domain/rules/economy/equipment.js";
import { effectBrief } from "../../../domain/rules/economy/itemEffectText.js";
import { QUALITY_COLOR } from "../../../domain/data/items/qualityColor.js";
import { statLabel } from "../../format/itemStats.js";
import { Icon } from "../../primitives/index.js";
import ItemIcon from "../../components/ItemIcon.jsx";

const SLOT_ICON = {
  [ITEM_CATEGORY.WEAPON]: "招式",
  [ITEM_CATEGORY.ARMOR]: "防御",
  [ITEM_CATEGORY.ACCESSORY]: "饰品",
};

export default function EquipmentModule({ inv, setInv }) {
  return (
    <div className="right-section">
      <div className="panel-sec-label">
        装备 <span className="panel-sec-sub">点物品切换装备/卸下</span>
      </div>
      <div className="equip-slot-list">
        {[ITEM_CATEGORY.WEAPON, ITEM_CATEGORY.ARMOR, ITEM_CATEGORY.ACCESSORY].map(cat => {
          const itemsInCat = inv.filter(i => typeof i === "object" && i.category === cat);
          const equipped = itemsInCat.filter(i => i.equipped);
          const spare = itemsInCat.filter(i => !i.equipped);
          const iconName = SLOT_ICON[cat];
          return (
            <div key={cat} className="equip-cat-group">
              {equipped.length === 0 ? (
                <div className="equip-slot equip-slot--empty">
                  <span className="equip-slot-ib"><Icon name={iconName} size={17} /></span>
                  <span className="equip-slot-empty-text">{CATEGORY_LABEL[cat]}　空着</span>
                </div>
              ) : equipped.map(item => {
                const stat = statLabel(item);
                const eff = effectBrief(item.effect, item.sixDim);
                const qc = QUALITY_COLOR[item.quality] || "var(--text)";
                return (
                  <div key={item.id} className="equip-slot" onClick={() => setInv(v => toggleEquip(v, item.id))}>
                    <span className="equip-slot-ib"><ItemIcon item={item} size="md" fallbackIcon={iconName} /></span>
                    <div className="equip-slot-body">
                      <div className="equip-slot-name">{item.name}</div>
                      <div className="equip-slot-meta">
                        <span>{CATEGORY_LABEL[cat]}</span>
                        <span style={{ color: qc }}>{item.quality || "白"}</span>
                        {stat && <span>{stat}</span>}
                      </div>
                      {eff && <div className="equip-slot-eff">{eff}</div>}
                    </div>
                  </div>
                );
              })}
              {spare.map(item => {
                const stat = statLabel(item);
                const eff = effectBrief(item.effect, item.sixDim);
                return (
                  <div key={item.id} className="equip-spare-row" onClick={() => setInv(v => toggleEquip(v, item.id))}>
                    <div className="equip-spare-title">
                      <span>{item.name}</span>
                      <span className="equip-spare-meta">({item.quality || "白"}{stat ? `·${stat}` : ""})</span>
                    </div>
                    {eff && <div className="equip-spare-eff">{eff}</div>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
