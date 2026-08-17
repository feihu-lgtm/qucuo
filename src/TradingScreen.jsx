// 交易界面：跟某个NPC商人做买卖。
// 布局参照传统单机RPG的交易UI范式——左边"我的物品，可以卖"，右边"商店物品，可以买"，
// 中间一条分隔线，顶部显示当前银两。所有买卖都是本地系统裁决（直接扣/加char.money），
// 不经过AI：AI不该有权决定"这次交易到底扣了多少钱"，这跟拾取/战斗掉落是同一个原则。

import React from "react";
import { QUALITY_COLOR, discountedBuyPrice } from "./equipment.js";

export default function TradingScreen({ shopName, shopItems, playerInv, playerMoney, playerWit = 5, onBuy, onSell, onClose, zoneTheme, inline, onInspect,
  // 货币名。雪山派门派商坊用功德（QUCUO_SHOPS 里 currency:"karma"），调用方
  // 传进来的 playerMoney 与各件的 buyPrice 都是功德值——但此前本组件五处
  // 都把单位写死成"银两/两"，于是界面显示「银两：37 两」，玩家一对自己的实际
  // 银两就发现对不上（实测反馈）。数值一直是对的，错的只是这几个字。
  currencyName = "银两", currencyUnit = "两",
  // 能不能卖。功德商店只出不进（CenterPanel 的 onSell 里 isKarma 直接 return），
  // 但界面此前照样渲染整个"我的物品/卖出"半边，还把售价标成功德单位——
  // 玩家点了没反应，看着像坏了。整半边隐掉，并把可买区铺满。
  canSell = true,
}) {
  const sellableItems = playerInv.filter(i => typeof i === "object" && i.sellPrice > 0);

  const outer = inline
    ? { borderTop: `1px solid ${zoneTheme.border}`, background: zoneTheme.panelBg || "#14161f", height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }
    : { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" };

  const inner = inline
    ? { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }
    : { width: "min(720px, 92vw)", maxHeight: "82vh", display: "flex", flexDirection: "column", background: zoneTheme.panelBg || "#14161f", border: `1px solid ${zoneTheme.border}`, borderRadius: 0, boxShadow: "0 8px 40px rgba(0,0,0,0.6)" };

  return (
    <div style={outer}>
      <div style={inner}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${zoneTheme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 14, color: zoneTheme.text || "#e8e4d6" }}>{shopName || "交易"}</div>
          <div style={{ fontSize: 12, color: "#e8c468" }}>{currencyName}：{playerMoney || 0} {currencyUnit}</div>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* 左侧：玩家物品，可卖。功德商店不收货，整半边不渲染 */}
          {canSell && (
          <div style={{ flex: 1, padding: 12, overflowY: "auto", borderRight: `1px solid ${zoneTheme.border}` }}>
            <div style={{ fontSize: 11, color: zoneTheme.accentDim, marginBottom: 8 }}>我的物品</div>
            {sellableItems.length === 0 && (
              <div style={{ fontSize: 11, color: "#8f8a7c", textAlign: "center", padding: "20px 0" }}>没有可出售的物品</div>
            )}
            {sellableItems.map((item, i) => (
              <div key={item.id || i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 8px", marginBottom: 4, background: "rgba(255,255,255,0.02)", borderRadius: 0,
              }}>
                <div style={{ fontSize: 11.5 }}>
                  <span
                    onClick={() => onInspect?.("item", item.name, null, item)}
                    style={{ color: QUALITY_COLOR[item.quality] || "#e8e4d6", cursor: onInspect ? "pointer" : "default", textDecoration: onInspect ? "underline" : "none", textDecorationStyle: "dotted" }}
                  >{item.name}</span>
                  {item.equipped && <span style={{ color: "#5a8a5a", marginLeft: 4 }}>[已装备]</span>}
                  <span style={{ color: "#8f8a7c", marginLeft: 6 }}>售 {item.sellPrice}{currencyUnit}</span>
                </div>
                <span
                  onClick={() => !item.equipped && onSell(item)}
                  style={{
                    fontSize: 11, padding: "2px 10px", borderRadius: 0,
                    cursor: item.equipped ? "not-allowed" : "pointer",
                    color: item.equipped ? "#8f8a7c" : "#d4a853",
                    border: `1px solid ${item.equipped ? "#2a2a2a" : "#4a3a1a"}`,
                  }}
                  title={item.equipped ? "已装备的物品需先卸下才能卖出" : "卖出"}
                >卖出</span>
              </div>
            ))}
          </div>
          )}

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
                  padding: "6px 8px", marginBottom: 4, background: "rgba(255,255,255,0.02)", borderRadius: 0,
                }}>
                  <div style={{ fontSize: 11.5 }}>
                    <span
                      onClick={() => onInspect?.("item", item.name, null, item)}
                      style={{ color: QUALITY_COLOR[item.quality] || "#e8e4d6", cursor: onInspect ? "pointer" : "default", textDecoration: onInspect ? "underline" : "none", textDecorationStyle: "dotted" }}
                    >{item.name}</span>
                    {discounted && <span style={{ color: "#8f8a7c", marginLeft: 6, textDecoration: "line-through" }}>{item.buyPrice}</span>}
                    <span style={{ color: discounted ? "#c07050" : "#8f8a7c", marginLeft: 6 }}>{payPrice}{currencyUnit}</span>
                  </div>
                  <span
                    onClick={() => canAfford && onBuy({ ...item, buyPrice: payPrice })}
                    style={{
                      fontSize: 11, padding: "2px 10px", borderRadius: 0,
                      cursor: canAfford ? "pointer" : "not-allowed",
                      color: canAfford ? "#c8323a" : "#8f8a7c",
                      border: `1px solid ${canAfford ? "#1a3a3a" : "#2a2a2a"}`,
                    }}
                    title={canAfford ? "购买" : `${currencyName}不足`}
                  >购买</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ padding: "10px 16px", borderTop: `1px solid ${zoneTheme.border}`, textAlign: "center", flexShrink: 0 }}>
          <span onClick={onClose} style={{ fontSize: 12, color: "#8a8a8a", cursor: "pointer", padding: "4px 16px", border: `1px solid ${zoneTheme.border}`, borderRadius: 0 }}>关闭</span>
        </div>
      </div>
    </div>
  );
}
