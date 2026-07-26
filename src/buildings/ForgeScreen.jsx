import React, { useState } from "react";
import { Overlay, Header, Btn } from "./InnScreen.jsx";

// 铸剑坊：委托定制武器，24时间单位后取件，品质受气运影响
export default function ForgeScreen({ building, char, time, flags, zoneTheme, onClose, inline, onCommission, onPickup }) {
  const [material, setMaterial] = useState("");
  const money = char.money || 0;
  const luck = (char.special?.气运) ?? 5;
  const FORGE_COST = 120;

  // 是否有在造订单（forge_pending_<下单time>_<luck>）。打好后由主循环自动送货入袋，
  // 不再有"取件"态，所以只看 pending。
  const pendingFlag = flags.find(f => f.startsWith("forge_pending_"));

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

        {pendingFlag && (() => {
          // 实时倒计时：从 pending flag 里解出下单时间，算还剩几时辰。到点会由主循环
          // 自动交付入袋（面板承诺"打好有人送来"），所以这里不再有"取件"按钮。
          // flag 第5段是材料编码，解出来在倒计时里报一句"你定的XX兵器"，增代入感。
          const fp = pendingFlag.split("_");
          const orderedAt = Number(fp[2]);
          const elapsed = Number.isFinite(orderedAt) ? Math.max(0, time - orderedAt) : 0;
          const remain = Math.max(0, 24 - elapsed);
          let mat = "";
          if (fp[4] && fp[4] !== "-") { try { mat = decodeURIComponent(fp[4]); } catch { mat = fp[4]; } }
          const what = mat ? `你定制的「${mat}」兵器` : "你定制的兵器";
          return (
            <div style={{ color: "#d4a853", fontSize: 12, marginBottom: 12, padding: "10px 12px", background: "#14100a", borderRadius: 6, border: "1px solid #4a3a1a" }}>
              {remain > 0
                ? `${what}正在赶工，铁匠说还需 ${remain} 个时辰方能打成。打好后自有伙计寻来送到你手上，不必守在这里。`
                : `${what}已打成，铺子里的伙计正给你送来，稍候便到手上。`}
            </div>
          );
        })()}

        {!pendingFlag && (
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
              约 24 个时辰后打成，届时自有伙计送货上门，不必再跑一趟
            </div>
          </>
        )}
      </div>
    </Overlay>
  );
}
