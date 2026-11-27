import { hasInnerMap, getResidentRoomForNpc, isNpcVisibleInInnerRoom } from "../../../domain/rules/map/innerMap.js";
import { isNpcKnown } from "../../../domain/rules/npc/npcAwareness.js";
import { npcAffectionLabel } from "../../../domain/rules/prompt/mvu.js";
import { OVERLAY, openOverlay, useOverlay } from "../../../store/uiStore.js";
import {
  useSessionUi, setInputCapsule,
  setActiveNpcMenu, setCharacterPageTarget, setPeoplePanel,
} from "../../../store/sessionUiStore.js";
import { ADVENTURER_BY_NAME, isAdventurerName } from "../../../domain/data/dungeon/adventurers.js";
import { partitionPeople } from "./peopleRoster.js";
import { useGameStore } from "../../../store/gameStore.js";
import NpcAngerLine from "../NpcAngerLine.jsx";
import NpcAvatar from "../../components/NpcAvatar.jsx";
import { npcArtUrl } from "../../art/art.js";

function adventurerClass(npcOrName) {
  const name = typeof npcOrName === "string" ? npcOrName : npcOrName?.name;
  const obj = typeof npcOrName === "object" ? npcOrName : null;
  if (!obj?.adventurer && !obj?.rainbow && !isAdventurerName(name)) return null;
  const variant = obj?.rainbowStyle || ADVENTURER_BY_NAME[name]?.rainbowStyle || "prism";
  return `adventurer-rainbow adventurer-rainbow--${variant}`;
}

export default function NpcsModule({ room, innerRoomName, varTree, char, addLog, inputRef, uiGreen, uiPink }) {
  const pigeonTarget = useSessionUi(s => s.pigeonTarget);
  const peoplePanel = useSessionUi(s => s.peoplePanel);
  const showDebug = useOverlay(OVERLAY.DEBUG);
  const companionState = useGameStore(s => s.companionState);
  // 随行队友（雪豹/小马/入队的 OC…）走到哪都算此地在场；留守队友只在留守房间在场，
  // 带 stationed 标记给动作菜单出「跟上我」。划分口径见 peopleRoster。
  const everSeen = varTree.世界?.曾经出现人物 || [];
  const { present, nearby = [], absent } = partitionPeople({ room, innerRoomName, companionState, everSeen });
  const crowd = (room.crowd || []).filter(c => !c.innerRoom || !innerRoomName || c.innerRoom === innerRoomName).map(c => c.label);
  const dbgPeople = showDebug && (
    <div style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)", background: "var(--bg-panel)", border: `1px solid var(--border)`, borderRadius: 0, padding: "4px 6px", marginBottom: 6, lineHeight: 1.5, wordBreak: "break-all" }}>
      <div>当前内层房间: {innerRoomName || "(无/全显示)"} · room.npcs 共 {room.npcs.length} 人</div>
      {room.npcs.map((n, i) => {
        const bound = hasInnerMap(room.name) ? getResidentRoomForNpc(room.name, n.name) : null;
        const vis = isNpcVisibleInInnerRoom(room.name, innerRoomName, n);
        return <div key={i}>{vis ? "●" : "○"} {n.name} · 驻{bound || "-"} · 落{n.innerRoom || "-"}</div>;
      })}
    </div>
  );
  const header = (label, count, key, color, rightContent) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--fs-xs)", marginBottom: 4 }}>
      <span onClick={() => setPeoplePanel(p => ({ ...p, [key]: !p[key] }))}
        style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none", flex: 1 }}>
        <span style={{ color: "var(--text-dim)", fontSize: "var(--fs-2xs)" }}>{peoplePanel[key] ? "▾" : "▸"}</span>
        <span style={{ color }}>{label}</span>
        <span style={{ color: "var(--text-dim)", fontSize: "var(--fs-2xs)" }}>（{count}）</span>
      </span>
      {rightContent}
    </div>
  );
  // 夜班急修小修：飞鸽入口提取共享——在附近（同据点别处）与不在此地两处同口径可寄信。
  const pigeonEntry = (name) => (
    <span onClick={() => {
        if ((char.pigeons || 0) <= 0) { addLog([{ t: "sys", text: `  没有信鸽——去驿站买鸽子，或到驿站直接寄信/送礼给${name}。` }]); return; }
        setInputCapsule({ kind: "pigeon", name }); setTimeout(() => inputRef.current?.focus(), 0);
      }}
      title={(char.pigeons || 0) > 0 ? `飞鸽传书（现有信鸽 ${char.pigeons} 只，寄一封耗一只·只送信）` : "需先去驿站买信鸽"}
      style={{ fontSize: "var(--fs-2xs)", color: (char.pigeons || 0) <= 0 ? "var(--text-dim)" : (pigeonTarget === name ? "var(--accent)" : "var(--text-sub)"), cursor: "pointer", flexShrink: 0 }}>飞鸽</span>
  );
  const pigeonBadge = (
    <span style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)", flexShrink: 0 }} title={`现有信鸽 ${char.pigeons || 0} 只`}>
      信鸽 {char.pigeons || 0}
    </span>
  );
  // WO-23C4：契约与宿敌面板入口——此前只有契约落账回执的「阅契」能开，
  // 只有宿敌没有契约的玩家连面板都进不去（招抚无路）。
  const pactsEntry = (
    <span onClick={() => openOverlay(OVERLAY.PACTS)}
      title="江湖契约与宿敌谱"
      style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)", flexShrink: 0, cursor: "pointer" }}>
      契
    </span>
  );
  const unreadLetters = useGameStore((s) => (s.varTree?.世界?.来信箱 || []).filter((l) => !l.read).length);
  const lettersEntry = (
    <span onClick={() => openOverlay(OVERLAY.LETTERS)}
      title="看全部来信，回信走飞鸽"
      style={{ fontSize: "var(--fs-2xs)", color: unreadLetters > 0 ? "var(--accent)" : "var(--text-dim)", flexShrink: 0, cursor: "pointer" }}>
      信{unreadLetters > 0 ? `×${unreadLetters}` : ""}
    </span>
  );
  return (
    <div style={{ marginBottom: 10 }}>
      {dbgPeople}
      {header("此地 · 在场", present.length, "present", "var(--text-dim)",
        <span style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>{pactsEntry}{lettersEntry}{pigeonBadge}</span>)}
      {peoplePanel.present && (present.length === 0
        ? <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)", marginBottom: 8, paddingLeft: 16 }}>空无一人</div>
        : <div style={{ marginBottom: 8 }}>{present.map((n, i) => {
            const known = isNpcKnown(varTree, n.name);
            const attrs = varTree.角色?.[n.name] || {};
            const hasAffection = known && typeof attrs.好感度 === "number";
            return (
              <div key={i} className="npc-present-row" data-last={i === present.length - 1}>
                <NpcAvatar
                  name={n.name}
                  src={n.passerArt && npcArtUrl(n)}
                  size="md"
                  onClick={() => setActiveNpcMenu({ ...n, zoom: true })}
                  title="放大立绘，并打开互动菜单：细看/切磋/偷窃/对话/送礼/拜师"
                />
                <div className="npc-present-main">
                  <div className="npc-present-head">
                    <span className="npc-present-name" style={{ color: uiGreen }}>
                      {(() => {
                        const cls = adventurerClass(n);
                        return cls ? <span className={cls}>{n.name}</span> : n.name;
                      })()}
                      <span className="npc-present-brief">{n.brief}</span>
                    </span>
                    {hasAffection ? (
                      <span className="npc-present-aff" title={`好感度 ${attrs.好感度}/100`}>
                        <span className="npc-present-aff-label">{npcAffectionLabel(attrs.好感度)}</span>
                        <span className="npc-present-aff-num">{attrs.好感度}</span>
                      </span>
                    ) : (
                      <span className="npc-present-unmet">{known ? "" : "尚未认识"}</span>
                    )}
                  </div>
                  <span onClick={() => setActiveNpcMenu(n)} title="打开互动菜单：细看/切磋/偷窃/对话/送礼/拜师"
                    className="npc-present-panel-btn">角色面板</span>{known && <NpcAngerLine angerState={attrs.生气状态} />}
                </div>
              </div>
            );
          })}</div>)}
      {peoplePanel.present && crowd.length > 0 && (
        <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)", marginBottom: 8, paddingLeft: 16 }}>路人 {crowd.join("、")}</div>
      )}
      {nearby.length > 0 && (
        <div style={{ paddingTop: 6, borderTop: `1px solid var(--hairline)` }}>
          {header("在附近（本据点别处）", nearby.length, "nearby", "var(--text-dim)")}
          {peoplePanel.nearby && nearby.map((n) => {
            // D6 Review 修：只有真有好感档案（认识过的人）才开得了详情页——
            // CharacterPage 按好感度选人，陌生人点进去只会掉到关系列表。
            const hasProfile = typeof varTree.角色?.[n.name]?.好感度 === "number";
            return (
            <div key={n.name} className="npc-compact-row">
              <NpcAvatar name={n.name} src={n.passerArt && npcArtUrl(n)} size="xs" />
              <span onClick={hasProfile ? () => { setCharacterPageTarget(n.name); openOverlay(OVERLAY.CHARACTER_PAGE); } : undefined}
                title={hasProfile ? "打开此人详情面板" : "尚未认识——走到他所在之处再交谈"}
                className="npc-compact-info" data-clickable={Boolean(hasProfile)}>
                {n.name}
                <span className="npc-compact-brief">{n.brief || ""}</span>
                {!hasProfile && <span className="npc-compact-brief">尚未认识</span>}
              </span>
              {pigeonEntry(n.name)}
            </div>
            );
          })}
        </div>
      )}
      {absent.length > 0 && (
        <div style={{ paddingTop: 6, borderTop: `1px solid var(--hairline)` }}>
          {header("不在此地", absent.length, "absent", "var(--text-dim)")}
          {peoplePanel.absent && absent.map(name => {
            const known = isNpcKnown(varTree, name);
            const attrs = varTree.角色?.[name] || {};
            const hasAff = known && typeof attrs.好感度 === "number";
            return (
              <div key={name} className="npc-absent-item">
                <div className="npc-absent-head">
                  <NpcAvatar name={name} size="xs" dim />
                  <span onClick={() => { setCharacterPageTarget(name); openOverlay(OVERLAY.CHARACTER_PAGE); }} title="打开此人详情面板"
                    className="npc-absent-name">
                    {(() => {
                      const cls = adventurerClass(name);
                      return cls ? <span className={cls}>{name}</span> : name;
                    })()}
                  </span>
                  {pigeonEntry(name)}
                  {hasAff ? (
                    <span className="npc-present-aff" title={`好感度 ${attrs.好感度}/100`}>
                      <span className="npc-present-aff-label">{npcAffectionLabel(attrs.好感度)}</span>
                      <span className="npc-present-aff-num">{attrs.好感度}</span>
                    </span>
                  ) : (
                    <span className="npc-present-unmet">{known ? "" : "尚未认识"}</span>
                  )}
                </div>
                {known && attrs.态度 && <div className="npc-absent-att">{attrs.态度}</div>}
                {known && <NpcAngerLine angerState={attrs.生气状态} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
