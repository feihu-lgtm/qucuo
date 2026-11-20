import { hasInnerMap, getResidentRoomForNpc, isNpcVisibleInInnerRoom } from "../../../domain/map/innerMap.js";
import { isNpcKnown } from "../../../domain/npc/npcAwareness.js";
import { npcAffectionLabel } from "../../../domain/prompt/mvu.js";
import { OVERLAY, openOverlay, useOverlay } from "../../../store/uiStore.js";
import NpcAngerLine from "../NpcAngerLine.jsx";

export default function NpcsModule({ room, innerRoomName, varTree, zoneTheme, peoplePanel, setPeoplePanel, char, setActiveNpcMenu, setCharacterPageTarget, addLog, setPigeonTarget, setInteractMode, inputRef, pigeonTarget, uiGreen, uiPink }) {
  const showDebug = useOverlay(OVERLAY.DEBUG);
  const present = room.npcs.filter(n => isNpcVisibleInInnerRoom(room.name, innerRoomName, n));
  const everSeen = varTree.世界?.曾经出现人物 || [];
  const presentNames = new Set(room.npcs.map(n => n.name));
  const absent = everSeen.filter(nm => !presentNames.has(nm));
  const dbgPeople = showDebug && (
    <div style={{ fontSize: "9.5px", color: zoneTheme.textDim, background: zoneTheme.bgPanel, border: `1px solid ${zoneTheme.border}`, borderRadius: 0, padding: "4px 6px", marginBottom: 6, lineHeight: 1.5, wordBreak: "break-all" }}>
      <div>当前内层房间: {innerRoomName || "(无/全显示)"} · room.npcs 共 {room.npcs.length} 人</div>
      {room.npcs.map((n, i) => {
        const bound = hasInnerMap(room.name) ? getResidentRoomForNpc(room.name, n.name) : null;
        const vis = isNpcVisibleInInnerRoom(room.name, innerRoomName, n);
        return <div key={i}>{vis ? "●" : "○"} {n.name} · 驻{bound || "-"} · 落{n.innerRoom || "-"}</div>;
      })}
    </div>
  );
  const header = (label, count, key, color, rightContent) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "11px", marginBottom: 4 }}>
      <span onClick={() => setPeoplePanel(p => ({ ...p, [key]: !p[key] }))}
        style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none", flex: 1 }}>
        <span style={{ color: zoneTheme.textDim, fontSize: "10px" }}>{peoplePanel[key] ? "▾" : "▸"}</span>
        <span style={{ color }}>{label}</span>
        <span style={{ color: zoneTheme.textDim, fontSize: "10px" }}>（{count}）</span>
      </span>
      {rightContent}
    </div>
  );
  const pigeonBadge = (
    <span style={{ fontSize: "10px", color: (char.pigeons || 0) > 0 ? zoneTheme.accentDim : zoneTheme.textDim, flexShrink: 0 }} title={`现有信鸽 ${char.pigeons || 0} 只`}>
      信鸽 {char.pigeons || 0}
    </span>
  );
  return (
    <div style={{ marginBottom: 10 }}>
      {dbgPeople}
      {header("此地之人 · 在场", present.length, "present", zoneTheme.accentDim, pigeonBadge)}
      {peoplePanel.present && (present.length === 0
        ? <div style={{ color: zoneTheme.textDim, fontSize: "11px", marginBottom: 8, paddingLeft: 16 }}>空无一人</div>
        : <div style={{ marginBottom: 8 }}>{present.map((n, i) => {
            const known = isNpcKnown(varTree, n.name);
            const attrs = varTree.角色?.[n.name] || {};
            const hasAffection = known && typeof attrs.好感度 === "number";
            return (
              <div key={i} style={{ marginBottom: 6, paddingBottom: 6, borderBottom: i < present.length - 1 ? `1px solid ${zoneTheme.border}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: uiGreen, flex: 1 }}>
                    {n.name}<span style={{ color: zoneTheme.textDim, fontSize: "11px", marginLeft: 6 }}>{n.brief}</span>
                  </span>
                  {hasAffection ? (
                    <span style={{ fontSize: "10.5px", flexShrink: 0, textAlign: "right", whiteSpace: "nowrap" }} title={`好感度 ${attrs.好感度}/100`}>
                      <span style={{ color: uiPink }}>{npcAffectionLabel(attrs.好感度)}</span>
                      <span style={{ color: zoneTheme.textDim, marginLeft: 4 }}>{attrs.好感度}</span>
                    </span>
                  ) : (
                    <span style={{ fontSize: "10px", color: zoneTheme.textDim, flexShrink: 0, whiteSpace: "nowrap" }}>{known ? "" : "尚未认识"}</span>
                  )}
                </div>
                <span onClick={() => setActiveNpcMenu(n)} title="打开互动菜单：细看/切磋/偷窃/对话/送礼/拜师"
                  style={{ fontSize: "10px", color: zoneTheme.accent, cursor: "pointer", display: "block", marginTop: 2 }}>◈ 角色面板</span>{known && <NpcAngerLine angerState={attrs.生气状态} />}
              </div>
            );
          })}</div>)}
      {absent.length > 0 && (
        <div style={{ paddingTop: 6, borderTop: `1px solid ${zoneTheme.border}` }}>
          {header("曾遇 · 不在场", absent.length, "absent", "var(--text)")}
          {peoplePanel.absent && absent.map(name => {
            const known = isNpcKnown(varTree, name);
            const attrs = varTree.角色?.[name] || {};
            const hasAff = known && typeof attrs.好感度 === "number";
            return (
              <div key={name} style={{ marginBottom: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span onClick={() => { setCharacterPageTarget(name); openOverlay(OVERLAY.CHARACTER_PAGE); }} title="打开此人详情面板"
                    style={{ cursor: "pointer", color: "var(--text)", flex: 1, fontSize: "11px" }}>{name}</span>
                  <span onClick={() => {
                      if ((char.pigeons || 0) <= 0) { addLog([{ t: "sys", text: `  没有信鸽——去驿站买鸽子，或到驿站直接寄信/送礼给${name}。` }]); return; }
                      setPigeonTarget(name); setInteractMode("pigeon"); setTimeout(() => inputRef.current?.focus(), 0);
                    }}
                    title={(char.pigeons || 0) > 0 ? `飞鸽传书（现有信鸽 ${char.pigeons} 只，寄一封耗一只·只送信）` : "需先去驿站买信鸽"}
                    style={{ fontSize: "10px", color: (char.pigeons || 0) <= 0 ? zoneTheme.textDim : (pigeonTarget === name ? zoneTheme.accent : zoneTheme.accentDim), cursor: "pointer", flexShrink: 0 }}>飞鸽</span>
                  {hasAff ? (
                    <span style={{ fontSize: "10px", flexShrink: 0, whiteSpace: "nowrap" }} title={`好感度 ${attrs.好感度}/100`}>
                      <span style={{ color: uiPink }}>{npcAffectionLabel(attrs.好感度)}</span>
                      <span style={{ color: zoneTheme.textDim, marginLeft: 4 }}>{attrs.好感度}</span>
                    </span>
                  ) : (
                    <span style={{ fontSize: "10px", color: zoneTheme.textDim, flexShrink: 0, whiteSpace: "nowrap" }}>{known ? "" : "尚未认识"}</span>
                  )}
                </div>
                {known && attrs.态度 && <div style={{ fontSize: "9.5px", color: "var(--text-dim)" }}>{attrs.态度}</div>}
                {known && <NpcAngerLine angerState={attrs.生气状态} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
