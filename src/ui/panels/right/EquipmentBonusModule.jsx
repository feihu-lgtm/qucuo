import { computeEquippedStats } from "../../../domain/rules/economy/equipment.js";

export default function EquipmentBonusModule({ inv }) {
  return (
    <div style={{ marginBottom: 10 }}>
      {(() => {
        const es = computeEquippedStats(inv);
        return <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>装备总加成：攻{es.totalAtk} 防{es.totalDef}</div>;
      })()}
    </div>
  );
}
