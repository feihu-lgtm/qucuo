import React, { useState } from "react";
import { Overlay, Header, Btn } from "./InnScreen.jsx";

// 铸剑坊：委托定制武器，24时间单位后取件，品质受气运影响
export default function ForgeScreen({ building, char, time, flags, zoneTheme, onClose, inline, onCommission, onPickup }) {
  const [material, setMaterial] = useState("");
  const money = char.money || 0;
  const luck = (char.special?.气运) ?? 5;
  const FORGE_COST = 120;

  // 检查是否有待取件的订单
  const pendingFlag = flags.find(f => f.startsWith("forge_pending_"));
  const pickupFlag = flags.find(f => f.startsWith("forge_ready_"));

  function qualityByLuck(l) {
    if (l >= 9) return "橙";
    if (l >= 7) return "紫";
    if (l >= 5) return "蓝";
    if (l >= 3) return "绿";
    return "白";
  }

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name="铸剑坊" zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ padding: 16 }}>
        <div style={{ color: "#7a7a6a", fontSize: 11, marginBottom: 12 }}>
          {building.desc}
        </div>
        <div style={{ color: "#8a8a7a", marginBottom: 12, fontSize: 11 }}>
          银两 {money} 两 · 气运 {luck}/10 · 定制费 {FORGE_COST} 两
        </div>

        {pickupFlag && (
          <div style={{ marginBottom: 14, padding: "10px 12px", background: "#0a140a", borderRadius: 6, border: "1px solid #2a4a2a" }}>
            <div style={{ color: "#6aaa6a", fontSize: 12, marginBottom: 6 }}>您的武器已打造完成，可以取件了！</div>
            <Btn label="取件" zoneTheme={zoneTheme} onClick={onPickup} />
          </div>
        )}

        {pendingFlag && !pickupFlag && (
          <div style={{ color: "#d4a853", fontSize: 12, marginBottom: 12 }}>
            正在打造中，24时间单位后可来取件。
          </div>
        )}

        {!pendingFlag && !pickupFlag && (
          <>
            <div style={{ color: "#c8bfa0", fontSize: 12, marginBottom: 8 }}>
              预计品质：<span style={{ color: "#b48adf" }}>{qualityByLuck(luck)}</span>（基于气运，有随机浮动）
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ color: "#7a7a6a", fontSize: 11 }}>武器名称/材料说明（可选）：</label>
              <input
                value={material} onChange={e => setMaterial(e.target.value)}
                placeholder="例：寒铁、玄冰精铁…"
                style={{ width: "100%", marginTop: 4, background: "#10121a", border: `1px solid ${zoneTheme.border}`, borderRadius: 4, color: "#c8bfa0", fontSize: 12, padding: "5px 8px" }}
              />
            </div>
            <Btn
              label={`委托打造（${FORGE_COST}两）`}
              disabled={money < FORGE_COST}
              zoneTheme={zoneTheme}
              onClick={() => onCommission(material, luck, time, FORGE_COST)}
            />
            <div style={{ color: "#4a4a4a", fontSize: 10, marginTop: 10 }}>
              24时间单位后来此取件
            </div>
          </>
        )}
      </div>
    </Overlay>
  );
}
