import { useState } from "react";
import { DIRS } from "../../utils/mudHelpers.js";
import { THEME_VARS } from "../../utils/theme.js";
import { Button } from "../primitives/index.js";

// 地宫内层地图房间面板（docs/设计_地宫内层地图.md §A 呈现顺序）。
// 纯受控组件：不读 domain/store 状态，接线方传入 room/runState 与三个回调。
const DIR_KEYS = ["n", "s", "e", "w", "u", "d"];

const KIND_GLYPH = {
  entry: "入",
  exit: "出",
  boss: "王",
  merchant: "商",
  trade: "易",
  supply: "补",
  puzzle: "谜",
  chest: "箱",
  trap_chest: "险",
  combat: "战",
  neutral: "·",
};

function FogGrid({ runState, theme }) {
  const size = runState?.map?.gridSize;
  const rooms = runState?.map?.rooms;
  if (!size || !rooms) return null;

  const visited = new Set(runState.visited || []);
  const revealed = new Set(runState.revealedExits || []);
  const unlocked = new Set(runState.unlockedExits || []);
  const byCoord = new Map();
  for (const [name, r] of Object.entries(rooms)) {
    if (Number.isInteger(r.x) && Number.isInteger(r.y)) {
      byCoord.set(`${r.x},${r.y}`, { name, room: r });
    }
  }
  const isAdjacentToVisited = (r) =>
    Object.values(r?.exits || {}).some((target) => visited.has(target));

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: "var(--fs-2xs)", color: theme.textDim, marginBottom: 4 }}>
        内层平面迷雾（{size}×{size} · @当前 / ?未知路 / 出已探出口 · 中心待探）
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${size}, 18px)`,
        gap: 2,
        padding: 6,
        background: "rgba(0,0,0,0.28)",
        border: `1px solid ${theme.border}`,
        width: "fit-content",
      }}>
        {Array.from({ length: size * size }, (_, idx) => {
          const x = idx % size;
          const y = Math.floor(idx / size);
          const entry = byCoord.get(`${x},${y}`);
          if (!entry) {
            return <span key={idx} style={{ width: 18, height: 18, display: "inline-block", opacity: 0.12, background: "#000" }} />;
          }
          const { name, room: r } = entry;
          const isCur = name === runState.current;
          const isVis = visited.has(name);
          const isRev = revealed.has(name) || unlocked.has(name);
          const isAdj = !isVis && isAdjacentToVisited(r);

          let ch = "";
          let color = theme.textDim;
          let bg = "rgba(255,255,255,0.03)";
          let border = `1px solid ${theme.border}`;

          if (isCur) {
            ch = "@";
            color = theme.bgPanel || "#111";
            bg = theme.accent;
            border = `1px solid ${theme.accent}`;
          } else if (isVis) {
            ch = KIND_GLYPH[r.roomKind] || "·";
            if (r.roomKind === "exit" || r.roomKind === "entry") color = theme.turquoise || theme.green;
            else if (r.roomKind === "chest" || r.roomKind === "merchant") color = theme.gold;
            else if (r.roomKind === "boss") color = theme.accent;
            else color = theme.text;
            bg = "rgba(255,255,255,0.08)";
          } else if (isRev) {
            ch = "出";
            color = theme.gold;
            border = `1px dashed ${theme.gold}`;
          } else if (isAdj) {
            ch = "?";
            color = theme.textDim;
            border = `1px dashed ${theme.border}`;
          } else {
            border = "1px solid transparent";
            bg = "rgba(0,0,0,0.22)";
          }

          return (
            <span
              key={idx}
              title={isVis || isRev ? name : isAdj ? "???" : ""}
              style={{
                width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: "10px", lineHeight: 1, boxSizing: "border-box",
                color, background: bg, border,
              }}
            >
              {ch}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function DungeonMapPanel({ room, runState, onMove, onAction, onText }) {
  const theme = THEME_VARS;
  const [text, setText] = useState("");
  const exits = room?.exits || {};
  const options = room?.roomEvent?.options || [];
  const npcs = room?.residentNpcName ? [room.residentNpcName] : [];
  const loot = (room?.groundLoot || []).map(g => (typeof g === "string" ? g : g?.name)).filter(Boolean);
  const isGrid = Boolean(runState?.map?.gridSize);
  const visitedSet = isGrid ? new Set(runState.visited || []) : null;

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onText?.(t);
    setText("");
  };

  const label = { fontSize: "var(--fs-xs)", letterSpacing: "1px", color: theme.accentDim, marginBottom: 5 };
  const chip = {
    display: "inline-flex", alignItems: "center", padding: "1px 7px", marginRight: 6,
    fontSize: "var(--fs-xs)", border: `1px solid ${theme.border}`, color: theme.text, whiteSpace: "nowrap",
  };

  return (
    <div style={{ padding: "10px 12px", background: theme.bgPanel, border: `1px solid ${theme.border}`, color: theme.text, fontSize: "var(--fs-sm)", lineHeight: 1.6 }}>
      {/* 1. 房名 */}
      <div data-part="room-name" style={{ fontSize: "var(--fs-md)", color: theme.accent, letterSpacing: "2px", marginBottom: 6 }}>
        {room?.name || "无名之室"}
        {room?.isTreasure && <span style={{ ...chip, marginLeft: 8, color: theme.gold }}>✦ 藏宝</span>}
        {room?.isExit && (
          <span style={{ ...chip, marginLeft: 8, color: room.exitUnlocked ? theme.green : theme.gold }}>
            {room.exitUnlocked ? "◈ 已通出口" : "◇ 封堵出口"}
          </span>
        )}
        {room?.isCheckpoint && <span style={{ ...chip, marginLeft: 8, color: theme.turquoise }}>◈ 检点</span>}
        {room?.envTag && <span style={{ ...chip, marginLeft: 8, color: theme.textDim }}>{room.envTag}</span>}
      </div>

      {/* 13x13 迷雾平面图（无 data-part，不影响现有契约顺序） */}
      {isGrid && <FogGrid runState={runState} theme={theme} />}

      {/* 2. 描述 */}
      <div data-part="room-desc" style={{ color: theme.textDim, marginBottom: 12, whiteSpace: "pre-wrap" }}>
        {room?.desc || ""}
      </div>

      {/* 3. 房内实体：人物 / 地面物品 */}
      {(npcs.length > 0 || loot.length > 0) && (
        <div data-part="room-entities" style={{ marginBottom: 12 }}>
          {npcs.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={label}>此地之人</div>
              {npcs.map(n => <span key={n} style={{ ...chip, color: theme.green }}>{n}</span>)}
            </div>
          )}
          {loot.length > 0 && (
            <div>
              <div style={label}>地上之物</div>
              {loot.map(n => <span key={n} style={{ ...chip, color: theme.gold }}>{n}</span>)}
            </div>
          )}
        </div>
      )}

      {/* 4. 六向按钮：有出口的亮，无出口的暗置；大平面未探之地显示 ??? */}
      <div data-part="room-exits" style={{ marginBottom: options.length > 0 ? 12 : 14 }}>
        <div style={label}>出口</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DIR_KEYS.map(dir => {
            const target = exits[dir];
            const enabled = Boolean(target);
            const targetLabel = !enabled
              ? DIRS[dir]
              : (visitedSet && !visitedSet.has(target))
                ? `${DIRS[dir]}：???`
                : `${DIRS[dir]}：${target}`;
            return (
              <Button
                variant="chrome"
                font="native"
                active={enabled}
                key={dir}
                type="button"
                disabled={!enabled}
                aria-disabled={!enabled}
                onClick={() => enabled && onMove?.(dir)}
                title={targetLabel}
                style={{ opacity: enabled ? 1 : 0.35, cursor: enabled ? "pointer" : "default" }}
              >
                {DIRS[dir]}
              </Button>
            );
          })}
        </div>
      </div>

      {/* 5. 房间事件动作按钮 */}
      {options.length > 0 && (
        <div data-part="room-actions" style={{ marginBottom: 14 }}>
          <div style={label}>可行之事</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {options.map((o, i) => (
              <Button variant="chrome" font="native" key={i} type="button" onClick={() => onAction?.(o.label)}>
                {o.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* 6. 自由文本输入：parseIntent / AI 意图兜底 */}
      <div data-part="room-input" style={{ display: "flex", gap: 6 }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); }}
          placeholder="输入动作（如：推开石门 / 查看角落）"
          style={{
            flex: 1, height: 24, padding: "0 8px", fontSize: "var(--fs-xs)", boxSizing: "border-box",
            background: "transparent", border: `1px solid ${theme.border}`, color: theme.text, outline: "none",
          }}
        />
        <Button variant="chrome" font="native" active={Boolean(text.trim())} type="button" onClick={submit}>行</Button>
      </div>

      {/* 底栏：runState 摘要（可选） */}
      {runState && (
        <div data-part="run-state" style={{ marginTop: 10, fontSize: "var(--fs-2xs)", color: theme.textDim }}>
          {`第 ${runState.step ?? 0} 步`}{runState.hp != null && ` · 气血 ${Array.isArray(runState.hp) ? runState.hp[0] : runState.hp}`}
          {Array.isArray(runState.loot) && runState.loot.length > 0 && ` · 得物 ${runState.loot.length} 件`}
        </div>
      )}
    </div>
  );
}
