import { npcAffectionLabel } from "../../../domain/rules/prompt/mvu.js";
import { unlockedCompanions, activeCompanionKey } from "../../../domain/rules/companion/companion.js";
import { INNER_MAP, getPublicInnerRoomNames } from "../../../domain/rules/map/innerMap.js";
import { setActiveNpcMenu } from "../../../store/sessionUiStore.js";

// 留守落点清单：每个据点的外场（district 名本身）+ 全部公共内层房，
// 私宅/上锁房不列——把队友塞进别人家里说不过去。
const STATION_SPOTS = Object.keys(INNER_MAP).flatMap((d) => [
  { district: d, roomId: d, roomName: d, label: d },
  ...getPublicInnerRoomNames(d).map((r) => ({ district: d, roomId: r, roomName: r, label: `${d}·${r}` })),
]);

export default function TeamModule({ zoneTheme, companionState, varTree, onSwitchCompanion, onStationCompanion }) {
  if (!unlockedCompanions(companionState).length) return null;
  // 队伍栏：已解锁的队友都列出来，点头像换出战（单槽互斥）。
  // 【为什么要能换】战斗引擎是 2v2，同时只带一个；明日香入队时会自动顶掉雪豹，
  // 玩家得有地方换回去，否则等于永久失去雪豹。
  const activeKey = activeCompanionKey(companionState);
  const ICON = { snowLeopard: "🐆", asuka: "🔴" };
  const BRIEF = {
    snowLeopard: "格桑的雪豹，通体雪白的灵兽，随行在侧",
    asuka: "红衣长枪的女侠，自称本女侠，跟你从心灵之海一路回来",
  };
  return (
    <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 8, marginBottom: 10 }}>
      <div style={{ fontSize: "11px", color: zoneTheme.accentDim, marginBottom: 4, display: "flex", alignItems: "center" }}>
        <span>队伍</span>
        <span style={{ flex: 1 }} />
        {unlockedCompanions(companionState).length > 1 && (
          <span style={{ fontSize: "9px", color: zoneTheme.textDim }}>只能带一个 · 点名字换</span>
        )}
      </div>
      {unlockedCompanions(companionState).map(slot => {
        const data = companionState[slot.key].data;
        const isOn = activeKey === slot.key;
        const stationedAt = companionState[slot.key].stationed;
        const aff = varTree.角色?.[slot.label]?.好感度;
        return (
          <div key={slot.key} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            {/* 换出战：点整行左侧区域 */}
            <div
              onClick={() => onSwitchCompanion?.(isOn ? null : slot.key)}
              title={isOn ? "点一下让他留守" : `换 ${slot.label} 出战`}
              style={{
                flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                padding: "6px 8px", borderRadius: 0,
                background: isOn ? zoneTheme.accent + "18" : zoneTheme.bgPanel,
                border: `1px solid ${isOn ? zoneTheme.accent : zoneTheme.border}`,
              }}
            >
              <span style={{ fontSize: "15px", opacity: isOn ? 1 : 0.45 }}>{ICON[slot.key] || "◈"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "11.5px", color: isOn ? zoneTheme.text : zoneTheme.textDim }}>
                  {slot.label}
                  {isOn && <span style={{ fontSize: "9px", color: zoneTheme.accent, marginLeft: 4 }}>出战</span>}
                  {stationedAt && <span style={{ fontSize: "9px", color: zoneTheme.textDim, marginLeft: 4 }}>留守于{stationedAt.roomName || stationedAt.district}</span>}
                </div>
                {typeof aff === "number" ? (
                  <div style={{ fontSize: "10px", color: "var(--pink)" }}>{npcAffectionLabel(aff)} · {aff}/100</div>
                ) : (
                  <div style={{ fontSize: "10px", color: zoneTheme.textDim }}>{isOn ? "随行在侧" : "留守"}</div>
                )}
              </div>
            </div>
            {/* 非出战位：跟随/留守在某处的切换——留守点可选任意据点的公共房间，
                落位后出现在该房间 NPC 列表里可被唤回 */}
            {!isOn && onStationCompanion && (
              <select
                value={stationedAt ? `${stationedAt.district}|${stationedAt.roomId}` : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) { onStationCompanion(slot.key, null); return; }
                  const [district, roomId] = v.split("|");
                  const spot = STATION_SPOTS.find((s) => s.district === district && s.roomId === roomId);
                  if (spot) onStationCompanion(slot.key, spot);
                }}
                title="随行在侧，或留守在某处"
                style={{
                  fontSize: "10px", color: zoneTheme.textDim, background: zoneTheme.bgPanel,
                  border: `1px solid ${zoneTheme.border}`, borderRadius: 0, padding: "3px 2px", maxWidth: 84,
                }}
              >
                <option value="">{stationedAt ? "唤回随行" : "随行"}</option>
                {STATION_SPOTS.map((s) => (
                  <option key={`${s.district}|${s.roomId}`} value={`${s.district}|${s.roomId}`}>守·{s.label}</option>
                ))}
                {stationedAt && !STATION_SPOTS.some((s) => s.district === stationedAt.district && s.roomId === stationedAt.roomId) && (
                  <option value={`${stationedAt.district}|${stationedAt.roomId}`}>守·{stationedAt.roomName || stationedAt.district}</option>
                )}
              </select>
            )}
            {/* 互动菜单：单独一个入口，免得跟"换出战"抢点击 */}
            <span
              onClick={() => setActiveNpcMenu({ ...data, brief: BRIEF[slot.key] || slot.label })}
              title="细看/切磋/送礼等"
              style={{
                cursor: "pointer", fontSize: "10px", color: zoneTheme.accentDim,
                padding: "5px 7px", borderRadius: 0, border: `1px solid ${zoneTheme.border}`,
              }}
            >◈</span>
          </div>
        );
      })}
    </div>
  );
}
