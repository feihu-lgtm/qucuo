export default function NpcAngerLine({ angerState }) {
  if (!angerState?.active) return null;
  return (
    <div style={{ fontSize: "var(--fs-2xs)", color: "var(--qb-versus)" }}>
      ⚡ 气头上（{angerState.reason}），还剩 {angerState.turnsLeft} 回合 · 已求和 {(angerState.attempts || []).length} 次
    </div>
  );
}
