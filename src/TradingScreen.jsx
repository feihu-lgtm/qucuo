// 交易界面：跟某个NPC商人做买卖。
// 布局参照传统单机RPG的交易UI范式——左边"我的物品，可以卖"，右边"商店物品，可以买"，
// 中间一条分隔线，顶部显示当前银两。所有买卖都是本地系统裁决（直接扣/加char.money），
// 不经过AI：AI不该有权决定"这次交易到底扣了多少钱"，这跟拾取/战斗掉落是同一个原则。

import React from "react";
import { QUALITY_COLOR, discountedBuyPrice } from "./equipment.js";

export default function TradingScreen({ shopName, shopItems, playerInv, playerMoney, playerWit = 5, onBuy, onSell, onClose, zoneTheme, inline, onInspect }) {
  const sellableItems = playerInv.filter(i => typeof i === "object" && i.sellPrice > 0);

  const outer = inline
    ? { borderTop: `1px solid ${zoneTheme.border}`, background: zoneTheme.panelBg || "#14161f", height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }
    : { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" };

  const inner = inline
    ? { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }
    : { width: "min(720px, 92vw)", maxHeight: "82vh", display: "flex", flexDirection: "column", background: zoneTheme.panelBg || "#14161f", border: `1px solid ${zoneTheme.border}`, borderRadius: 8, boxShadow: "0 8px 40px rgba(0,0,0,0.6)" };

  return (
    <div style={outer}>
      <div style={inner}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${zoneTheme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 14, color: zoneTheme.text || "#c8bfa0" }}>{shopName || "交易"}</div>
          <div style={{ fontSize: 12, color: "#e8c468" }}>银两：{playerMoney || 0} 两</div>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* 左侧：玩家物品，可卖 */}
          <div style={{ flex: 1, padding: 12, overflowY: "auto", borderRight: `1px solid ${zoneTheme.border}` }}>
            <div style={{ fontSize: 11, color: zoneTheme.accentDim, marginBottom: 8 }}>我的物品</div>
            {sellableItems.length === 0 && (
              <div style={{ fontSize: 11, color: "#5a5a4a", textAlign: "center", padding: "20px 0" }}>没有可出售的物品</div>
            )}
            {sellableItems.map((item, i) => (
              <div key={item.id || i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 8px", marginBottom: 4, background: "rgba(255,255,255,0.02)", borderRadius: 4,
              }}>
                <div style={{ fontSize: 11.5 }}>
                  <span
                    onClick={() => onInspect?.("item", item.name, null, item)}
                    style={{ color: QUALITY_COLOR[item.quality] || "#c8bfa0", cursor: onInspect ? "pointer" : "default", textDecoration: onInspect ? "underline" : "none", textDecorationStyle: "dotted" }}
                  >{item.name}</span>
                  {item.equipped && <span style={{ color: "#5a8a5a", marginLeft: 4 }}>[已装备]</span>}
                  <span style={{ color: "#8a8a7a", marginLeft: 6 }}>售 {item.sellPrice}两</span>
                </div>
                <span
                  onClick={() => !item.equipped && onSell(item)}
                  style={{
                    fontSize: 11, padding: "2px 10px", borderRadius: 3,
                    cursor: item.equipped ? "not-allowed" : "pointer",
                    color: item.equipped ? "#5a5a4a" : "#d4a853",
                    border: `1px solid ${item.equipped ? "#2a2a2a" : "#4a3a1a"}`,
                  }}
                  title={item.equipped ? "已装备的物品需先卸下才能卖出" : "卖出"}
                >卖出</span>
              </div>
            ))}
          </div>

          {/* 右侧：商店物品，可买 */}
          <div style={{ flex: 1, padding: 12, overflowY: "auto" }}>
            <div style={{ fontSize: 11, color: zoneTheme.accentDim, marginBottom: 8 }}>商店货品</div>
            {shopItems.map((item, i) => {
              // 智谋折扣：显示折后价，实付也是折后价。折扣时把原价划掉、标出省了多少。
              const payPrice = discountedBuyPrice(item.buyPrice, playerWit);
              const discounted = payPrice < item.buyPrice;
              const canAfford = (playerMoney || 0) >= payPrice;
              return (
                <div key={item.id || i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "6px 8px", marginBottom: 4, background: "rgba(255,255,255,0.02)", borderRadius: 4,
                }}>
                  <div style={{ fontSize: 11.5 }}>
                    <span
                      onClick={() => onInspect?.("item", item.name, null, item)}
                      style={{ color: QUALITY_COLOR[item.quality] || "#c8bfa0", cursor: onInspect ? "pointer" : "default", textDecoration: onInspect ? "underline" : "none", textDecorationStyle: "dotted" }}
                    >{item.name}</span>
                    {discounted && <span style={{ color: "#5a5a4a", marginLeft: 6, textDecoration: "line-through" }}>{item.buyPrice}</span>}
                    <span style={{ color: discounted ? "#8ac48a" : "#8a8a7a", marginLeft: 6 }}>{payPrice}两</span>
                  </div>
                  <span
                    onClick={() => canAfford && onBuy({ ...item, buyPrice: payPrice })}
                    style={{
                      fontSize: 11, padding: "2px 10px", borderRadius: 3,
                      cursor: canAfford ? "pointer" : "not-allowed",
                      color: canAfford ? "#6ec6c6" : "#5a5a4a",
                      border: `1px solid ${canAfford ? "#1a3a3a" : "#2a2a2a"}`,
                    }}
                    title={canAfford ? "购买" : "银两不足"}
                  >购买</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ padding: "10px 16px", borderTop: `1px solid ${zoneTheme.border}`, textAlign: "center", flexShrink: 0 }}>
          <span onClick={onClose} style={{ fontSize: 12, color: "#8a8a8a", cursor: "pointer", padding: "4px 16px", border: `1px solid ${zoneTheme.border}`, borderRadius: 4 }}>关闭</span>
        </div>
      </div>
    </div>
  );
}
