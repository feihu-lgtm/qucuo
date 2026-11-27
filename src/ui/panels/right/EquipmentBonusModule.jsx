import { computeEquippedStats } from "../../../domain/rules/economy/equipment.js";
import { Icon } from "../../primitives/index.js";

export default function EquipmentBonusModule({ inv }) {
  const es = computeEquippedStats(inv);
  return (
    <div className="equip-bonus-line">
      <Icon name="装备加成" size={13} />
      <span>装备总加成：攻{es.totalAtk} 防{es.totalDef}</span>
    </div>
  );
}
