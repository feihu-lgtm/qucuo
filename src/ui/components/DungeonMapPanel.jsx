import { useState } from "react";
import { DIRS } from "../../utils/mudHelpers.js";
import { THEME_VARS, chromeBtn } from "../../utils/theme.js";

// 地宫内层地图房间面板（docs/设计_地宫内层地图.md §A 呈现顺序）。
// 纯受控组件：不读 domain/store 状态，接线方传入 room/runState 与三个回调。
// room 为内层地图房间对象（genDungeonMap / mapRun 产出）：
//   {desc, exits:{n/s/e/w/u/d:目标房名}, residentNpcName?, envTag?,
//    roomEvent?:{options:[{label,...}]}, groundLoot?:[{name}|string], isTreasure?, isCheckpoint?}
// runState 目前只用于展示 hp/loot/step 等底栏信息，可缺省。
const DIR_KEYS = ["n", "s", "e", "w", "u", "d"];

export default function DungeonMapPanel({ room, runState, onMove, onAction, onText }) {
  // 唯一的调用方地牢屏每次都传主题，原先的暗夜兜底走不到；颜色统一取 CSS 变量。
  const theme = THEME_VARS;
  const [text, setText] = useState("");
  const exits = room?.exits || {};
  const options = room?.roomEvent?.options || [];
  const npcs = room?.residentNpcName ? [room.residentNpcName] : [];
  const loot = (room?.groundLoot || []).map(g => (typeof g === "string" ? g : g?.name)).filter(Boolean);

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
        {room?.isCheckpoint && <span style={{ ...chip, marginLeft: 8, color: theme.turquoise }}>◈ 检点</span>}
        {room?.envTag && <span style={{ ...chip, marginLeft: 8, color: theme.textDim }}>{room.envTag}</span>}
      </div>

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

      {/* 4. 六向按钮：有出口的亮，无出口的暗置 */}
      <div data-part="room-exits" style={{ marginBottom: options.length > 0 ? 12 : 14 }}>
        <div style={label}>出口</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DIR_KEYS.map(dir => {
            const target = exits[dir];
            const enabled = Boolean(target);
            return (
              <button
                key={dir}
                type="button"
                disabled={!enabled}
                aria-disabled={!enabled}
                onClick={() => enabled && onMove?.(dir)}
                title={enabled ? `${DIRS[dir]}：${target}` : DIRS[dir]}
                style={{
                  ...chromeBtn(theme, { active: enabled }),
                  opacity: enabled ? 1 : 0.35,
                  cursor: enabled ? "pointer" : "default",
                }}
              >
                {DIRS[dir]}
              </button>
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
              <button key={i} type="button" onClick={() => onAction?.(o.label)} style={chromeBtn(theme)}>
                {o.label}
              </button>
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
        <button type="button" onClick={submit} style={chromeBtn(theme, { active: Boolean(text.trim()) })}>行</button>
      </div>

      {/* 底栏：runState 摘要（可选） */}
      {runState && (
        <div data-part="run-state" style={{ marginTop: 10, fontSize: "var(--fs-2xs)", color: theme.textDim }}>
          {`第 ${runState.step ?? 0} 步`}{runState.hp != null && ` · 气血 ${runState.hp}`}
          {Array.isArray(runState.loot) && runState.loot.length > 0 && ` · 得物 ${runState.loot.length} 件`}
        </div>
      )}
    </div>
  );
}
