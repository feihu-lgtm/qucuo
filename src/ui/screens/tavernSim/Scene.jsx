// 像素大堂（自 TavernSimScreen 拆出）：后墙/灯笼/桌椅/跑堂/护院/客人/昼夜罩，纯展示。
import {
  SEAT_COORDS, ZONES,
} from "../../../domain/data/tavernSim/simData.js";
import { S } from "./tavernWidgets.jsx";

import React from "react";

// ── 像素大堂 ─────────────────────────────────────────────────────────
// 借 Star-Office-UI 的"状态→区域"渲染：实体位置只由 phase/岗位决定，
// 走动 = left/top 的 CSS transition，零 canvas 零逐帧 JS。
export function Scene({ sim, night, zoneTheme }) {
  const staff = sim.staff;
  return (
    <div style={S.scene(night)}>
      {/* 后墙横梁线，分出墙上墙下两个空间 */}
      <div style={{ position: "absolute", left: 0, right: 0, top: "26%", height: 2, background: "var(--ink-wood-line)", opacity: 0.8 }} />

      {/* 后墙设施：大号 emoji + 文字标签，一眼认得出是什么 */}
      <div style={{ position: "absolute", left: `${ZONES.stove.x}%`, top: `${ZONES.stove.y}%`, textAlign: "center" }}>
        <div style={{ fontSize: 30 }}>🍳</div>
        <div className="ts-steam"><i /><i /><i /></div>
        <div style={S.zoneLabel}>灶台</div>
        {staff.cook && <div style={S.token()} title={`厨子 ${staff.cook.name}`}>👨‍🍳</div>}
      </div>
      <div style={{ position: "absolute", left: `${ZONES.cellar.x}%`, top: `${ZONES.cellar.y}%`, textAlign: "center" }}>
        <div style={{ fontSize: 26 }}>🍶🍶🍶</div>
        <div style={S.zoneLabel}>酒架</div>
      </div>
      <div style={{ position: "absolute", left: `${ZONES.ledger.x}%`, top: `${ZONES.ledger.y}%`, textAlign: "center" }}>
        <div style={{ fontSize: 26 }}>🧮</div>
        <div style={S.zoneLabel}>账台</div>
        {staff.accountant && <div style={S.token()} title={`账房 ${staff.accountant.name}`}>🤓</div>}
      </div>
      <div style={{ position: "absolute", left: `${ZONES.counter.x}%`, top: `${ZONES.counter.y}%`, textAlign: "center" }}>
        <div style={{ fontSize: 26 }}>🛎</div>
        <div style={S.zoneLabel}>柜台</div>
        {staff.manager && <div style={S.token()} title={`掌柜 ${staff.manager.name}`}>🎩</div>}
      </div>

      {/* 灯笼 ×2（CSS 明灭） */}
      <div className="ts-lantern" style={{ position: "absolute", left: "46%", top: "1%", fontSize: "var(--fs-xl)" }}>🏮</div>
      <div className="ts-lantern" style={{ position: "absolute", left: "66%", top: "1%", fontSize: "var(--fs-xl)" }}>🏮</div>

      {/* 堂中桌子：CSS 画木桌，比暗色 emoji 显眼 */}
      {SEAT_COORDS.slice(0, sim.seats.length).map((c, i) => (
        <div key={`t${i}`} style={{
          position: "absolute", left: `${c.x + 1}%`, top: `${c.y + 7}%`,
          width: 34, height: 22, borderRadius: 0,
          background: "linear-gradient(180deg, var(--tavern-table-top) 0%, var(--tavern-table-bottom) 100%)",
          border: "1px solid var(--tavern-table-edge)", boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
        }} />
      ))}

      {/* 跑堂在大堂游走（CSS 动画） */}
      {staff.runner && <div className="ts-runner" title={`跑堂 ${staff.runner.name}`}>🏃</div>}

      {/* 护院站门口 */}
      {sim.guards.map((g, i) => (
        <div key={g.name} title={`护院 ${g.name}（技 ${g.skill}）`}
          style={{ position: "absolute", left: `${ZONES.door.x + 6 + i * 6}%`, top: `${ZONES.door.y - 10}%`, fontSize: "var(--fs-2xl)" }}>
          🗡
        </div>
      ))}

      {/* 客人：phase 决定坐标，transition 走出"来/走" */}
      {sim.seats.map((seat, i) => {
        if (!seat) return null;
        const atDoor = seat.phase === "arriving" ? { x: ZONES.door.x + 4, y: ZONES.door.y - 8 }
          : seat.phase === "leaving" ? { x: ZONES.door.x + 2, y: ZONES.door.y - 6 }
          : SEAT_COORDS[i];
        return (
          <div key={seat.id} style={{
            position: "absolute", left: `${atDoor.x}%`, top: `${atDoor.y}%`,
            transition: "left 1.4s ease, top 1.4s ease", textAlign: "center", zIndex: 2,
          }}>
            <div className="ts-breathe" style={{ fontSize: 26 }}>{seat.glyph}</div>
            {seat.phase === "eating" && <div className="ts-bubble">{seat.banter}</div>}
          </div>
        );
      })}

      {/* 门口与招牌 */}
      <div style={{ position: "absolute", left: `${ZONES.door.x - 1}%`, top: `${ZONES.door.y - 2}%`, fontSize: "var(--fs-2xl)", opacity: 0.85 }}>🚪</div>
      <div style={{ position: "absolute", left: `${ZONES.door.x}%`, top: `${ZONES.door.y + 8}%`, fontSize: "var(--fs-sm)", color: "var(--tavern-door-label)", letterSpacing: 2 }}>
        — 醉三江 —
      </div>
      {/* 昼夜罩 */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
        background: night ? "rgba(10,10,40,0.35)" : "rgba(255,220,150,0.06)", transition: "background 2s" }} />
    </div>
  );
}

