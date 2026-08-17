import React, { useState } from "react";
import { QUALITY_COLOR } from "../equipment.js";
import { Overlay, Header, Btn } from "./InnScreen.jsx";

// 当铺：质押物品换银两，可以赎回
export default function PawnScreen({ building, char, inv, pledgedItems, zoneTheme, onClose, inline, onPledge, onRedeem }) {
  const [tab, setTab] = useState("pledge");
  const money = char.money || 0;

  const pawnable = inv.filter(i => typeof i === "object" && !i.equipped && i.sellPrice);

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name="聚宝当铺" zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${zoneTheme.border}` }}>
        {[["pledge", "质押物品"], ["redeem", `赎回（${pledgedItems.length}件）`]].map(([id, label]) => (
          <span key={id} onClick={() => setTab(id)}
            style={{ padding: "8px 16px", fontSize: 12, cursor: "pointer", userSelect: "none",
              color: tab === id ? zoneTheme.accent : zoneTheme.accentDim,
              borderBottom: tab === id ? `2px solid ${zoneTheme.accent}` : "2px solid transparent" }}
          >{label}</span>
        ))}
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ color: "#8f8a7c", marginBottom: 12, fontSize: 11 }}>
          银两 {money} 两 · 质押价 = 卖价 × 0.8，赎金 = 质押价 × 1.1
        </div>

        {tab === "pledge" && (
          pawnable.length === 0
            ? <div style={{ color: "#8f8a7c" }}>背包里没有可质押的物品。</div>
            : pawnable.map(item => {
              const pledgeValue = Math.floor(item.sellPrice * 0.8);
              return (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "8px 10px", background: "#161510", borderRadius: 0, border: `1px solid ${zoneTheme.border}` }}>
                  <div>
                    <span style={{ color: QUALITY_COLOR[item.quality] || "#e8e4d6", fontSize: 12 }}>{item.name}</span>
                    <span style={{ color: "#8f8a7c", fontSize: 10, marginLeft: 6 }}>({item.quality})</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#e8c468", fontSize: 11 }}>+{pledgeValue} 两</span>
                    <Btn label="质押" zoneTheme={zoneTheme} onClick={() => onPledge(item, pledgeValue)} />
                  </div>
                </div>
              );
            })
        )}

        {tab === "redeem" && (
          pledgedItems.length === 0
            ? <div style={{ color: "#8f8a7c" }}>没有质押中的物品。</div>
            : pledgedItems.map((p, i) => {
              const redeemCost = Math.floor(p.pledgeValue * 1.1);
              return (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "8px 10px", background: "#161510", borderRadius: 0, border: `1px solid ${zoneTheme.border}` }}>
                  <div>
                    <span style={{ color: QUALITY_COLOR[p.item?.quality] || "#e8e4d6", fontSize: 12 }}>{p.item?.name}</span>
                    <span style={{ color: "#8f8a7c", fontSize: 10, marginLeft: 6 }}>质押了 {p.pledgeValue} 两</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#e0526a", fontSize: 11 }}>-{redeemCost} 两</span>
                    <Btn label="赎回" disabled={money < redeemCost} zoneTheme={zoneTheme} onClick={() => onRedeem(i, redeemCost)} />
                  </div>
                </div>
              );
            })
        )}
      </div>
    </Overlay>
  );
}
