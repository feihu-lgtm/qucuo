import React, { useState } from "react";
import { QUALITY_COLOR } from "../../../domain/rules/economy/equipment.js";
import { Overlay, Header, Btn } from "./common.jsx";

// 当铺：质押物品换银两，可以赎回
export default function PawnScreen({ building, char, inv, pledgedItems, onClose, inline, onPledge, onRedeem }) {
  const [tab, setTab] = useState("pledge");
  const money = char.money || 0;

  const pawnable = inv.filter(i => typeof i === "object" && !i.equipped && i.sellPrice);

  return (
    <Overlay onClose={onClose} inline={inline}>
      <Header name="聚宝当铺" onClose={onClose} />
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid var(--border)` }}>
        {[["pledge", "质押物品"], ["redeem", `赎回（${pledgedItems.length}件）`]].map(([id, label]) => (
          <span key={id} onClick={() => setTab(id)}
            style={{ padding: "8px 16px", fontSize: "var(--fs-sm)", cursor: "pointer", userSelect: "none",
              color: tab === id ? "var(--accent)" : "var(--accent-dim)",
              borderBottom: tab === id ? `2px solid var(--accent)` : "2px solid transparent" }}
          >{label}</span>
        ))}
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ color: "var(--ink-text-dim)", marginBottom: 12, fontSize: "var(--fs-xs)" }}>
          银两 {money} 两 · 质押价 = 卖价 × 0.8，赎金 = 质押价 × 1.1
        </div>

        {tab === "pledge" && (
          pawnable.length === 0
            ? <div style={{ color: "var(--ink-text-dim)" }}>背包里没有可质押的物品。</div>
            : pawnable.map(item => {
              const pledgeValue = Math.floor(item.sellPrice * 0.8);
              return (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "8px 10px", background: "var(--bg-ink)", borderRadius: 0, border: `1px solid var(--border)` }}>
                  <div>
                    <span style={{ color: QUALITY_COLOR[item.quality] || "var(--ink-text)", fontSize: "var(--fs-sm)" }}>{item.name}</span>
                    <span style={{ color: "var(--ink-text-dim)", fontSize: "var(--fs-2xs)", marginLeft: 6 }}>({item.quality})</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "var(--gold-bright)", fontSize: "var(--fs-xs)" }}>+{pledgeValue} 两</span>
                    <Btn label="质押" onClick={() => onPledge(item, pledgeValue)} />
                  </div>
                </div>
              );
            })
        )}

        {tab === "redeem" && (
          pledgedItems.length === 0
            ? <div style={{ color: "var(--ink-text-dim)" }}>没有质押中的物品。</div>
            : pledgedItems.map((p, i) => {
              const redeemCost = Math.floor(p.pledgeValue * 1.1);
              return (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "8px 10px", background: "var(--bg-ink)", borderRadius: 0, border: `1px solid var(--border)` }}>
                  <div>
                    <span style={{ color: QUALITY_COLOR[p.item?.quality] || "var(--ink-text)", fontSize: "var(--fs-sm)" }}>{p.item?.name}</span>
                    <span style={{ color: "var(--ink-text-dim)", fontSize: "var(--fs-2xs)", marginLeft: 6 }}>质押了 {p.pledgeValue} 两</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "var(--qb-versus)", fontSize: "var(--fs-xs)" }}>-{redeemCost} 两</span>
                    <Btn label="赎回" disabled={money < redeemCost} onClick={() => onRedeem(i, redeemCost)} />
                  </div>
                </div>
              );
            })
        )}
      </div>
    </Overlay>
  );
}
