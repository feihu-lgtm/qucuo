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
    <div className="dungeon-map-fog">
      <div className="dungeon-map-fog-hint">
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
            return <span key={idx} className="dungeon-map-fog-empty" />;
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
                fontSize: "var(--fs-2xs)", lineHeight: 1, boxSizing: "border-box",
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


  return (
    <div className="dungeon-map-panel">
      {/* 1. 房名 */}
      <div data-part="room-name" className="dungeon-map-room-name">
        {room?.name || "无名之室"}
        {room?.isTreasure && <span className="dungeon-map-chip dungeon-map-chip-head">✦ 藏宝</span>}
        {room?.isExit && (
          <span className="dungeon-map-chip dungeon-map-chip-head">
            {room.exitUnlocked ? "◈ 已通出口" : "◇ 封堵出口"}
          </span>
        )}
        {room?.isCheckpoint && <span className="dungeon-map-chip dungeon-map-chip-head">◈ 检点</span>}
        {room?.envTag && <span className="dungeon-map-chip dungeon-map-chip-head">{room.envTag}</span>}
      </div>

      {/* 13x13 迷雾平面图（无 data-part，不影响现有契约顺序） */}
      {isGrid && <FogGrid runState={runState} theme={theme} />}

      {/* 2. 描述 */}
      <div data-part="room-desc" className="dungeon-map-desc">
        {room?.desc || ""}
      </div>

      {/* 3. 房内实体：人物 / 地面物品 */}
      {(npcs.length > 0 || loot.length > 0) && (
        <div data-part="room-entities" className="dungeon-map-entities">
          {npcs.length > 0 && (
            <div className="dungeon-map-entity-group">
              <div className="dungeon-map-label">此地之人</div>
              {npcs.map(n => <span key={n} className="dungeon-map-chip">{n}</span>)}
            </div>
          )}
          {loot.length > 0 && (
            <div>
              <div className="dungeon-map-label">地上之物</div>
              {loot.map(n => <span key={n} className="dungeon-map-chip">{n}</span>)}
            </div>
          )}
        </div>
      )}

      {/* 4. 六向按钮：有出口的亮，无出口的暗置；大平面未探之地显示 ??? */}
      <div data-part="room-exits" className={options.length > 0 ? "dungeon-map-exits" : "dungeon-map-exits-end"}>
        <div className="dungeon-map-label">出口</div>
        <div className="dungeon-map-flexrow">
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
        <div data-part="room-actions" className="dungeon-map-actions">
          <div className="dungeon-map-label">可行之事</div>
          <div className="dungeon-map-flexrow">
            {options.map((o, i) => (
              <Button variant="chrome" font="native" key={i} type="button" onClick={() => onAction?.(o.label)}>
                {o.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* 6. 自由文本输入：parseIntent / AI 意图兜底 */}
      <div data-part="room-input" className="dungeon-map-inputrow">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); }}
          placeholder="输入动作（如：推开石门 / 查看角落）"
          className="dungeon-map-input"
        />
        <Button variant="chrome" font="native" active={Boolean(text.trim())} type="button" onClick={submit}>行</Button>
      </div>

      {/* 底栏：runState 摘要（可选） */}
      {runState && (
        <div data-part="run-state" className="dungeon-map-runstate">
          {`第 ${runState.step ?? 0} 步`}{runState.hp != null && ` · 气血 ${Array.isArray(runState.hp) ? runState.hp[0] : runState.hp}`}
          {Array.isArray(runState.loot) && runState.loot.length > 0 && ` · 得物 ${runState.loot.length} 件`}
        </div>
      )}
    </div>
  );
}
