// 交易界面：跟某个NPC商人做买卖。
// 布局参照传统单机RPG的交易UI范式——左边"我的物品，可以卖"，右边"商店物品，可以买"，
// 中间一条分隔线，顶部显示当前银两。所有买卖都是本地系统裁决（直接扣/加char.money），
// 不经过AI：AI不该有权决定"这次交易到底扣了多少钱"，这跟拾取/战斗掉落是同一个原则。

import React from "react";
import { QUALITY_COLOR, discountedBuyPrice } from "../../domain/rules/economy/equipment.js";
import { chromeBtn } from "../../utils/theme.js";
import { cherishHearts } from "../../domain/rules/npc/npcCarry.js";

export default function TradingScreen({ shopName, shopItems = [], playerInv, playerMoney, playerWit = 5, repCoef = 1, onBuy, onSell, onClose, zoneTheme, inline, onInspect, queueCount = 0,
  // 随身交易三分区（OC 冒险者 carry）：{equipment, bag, mount}，挂在商店货品上方
  carrySections = null, onBuyCarry,
  headerContent,
  // 货币名。雪山派门派商坊用功德（QUCUO_SHOPS 里 currency:"karma"），调用方
  // 传进来的 playerMoney 与各件的 buyPrice 都是功德值——但此前本组件五处
  // 都把单位写死成"银两/两"，于是界面显示「银两：37 两」，玩家一对自己的实际
  // 银两就发现对不上（实测反馈）。数值一直是对的，错的只是这几个字。
  currencyName = "银两", currencyUnit = "两",
  // 能不能卖。功德商店只出不进（CenterPanel 的 onSell 里 isKarma 直接 return），
  // 但界面此前照样渲染整个"我的物品/卖出"半边，还把售价标成功德单位——
  // 玩家点了没反应，看着像坏了。整半边隐掉，并把可买区铺满。
  canSell = true,
  // 可选底栏内容（如镖局的护镖任务板）：嵌在交易面板内部，移动端 fixed 全屏下也可见。
  footer,
}) {
  const sellableItems = playerInv.filter(i => typeof i === "object" && i.sellPrice > 0);

  const outer = inline
    ? { borderTop: `1px solid ${zoneTheme.border}`, background: zoneTheme.panelBg || "var(--building-panel-bg)", height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }
    : { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" };

  const inner = inline
    ? { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }
    : { width: "min(720px, 92vw)", maxHeight: "82vh", display: "flex", flexDirection: "column", background: zoneTheme.panelBg || "var(--building-panel-bg)", border: `1px solid ${zoneTheme.border}`, borderRadius: 0, boxShadow: "0 8px 40px rgba(0,0,0,0.6)" };

  return (
    <div className="mobile-trading-root" style={outer}>
      <div className="mobile-trading-panel" style={inner}>
        {inline && queueCount > 0 && (
          <div role="status" aria-live="polite"
            style={{ ...chromeBtn(zoneTheme), alignSelf: "flex-start", flexShrink: 0, margin: "4px 12px", cursor: "default" }}>
            ⏳ 排队中 {queueCount} · 等待落盘后执行
          </div>
        )}
        <div className="mobile-trading-header" style={{ padding: "12px 16px", borderBottom: `1px solid ${zoneTheme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          {headerContent}
          <div style={{ fontSize: 14, color: zoneTheme.text || "var(--text)" }}>{shopName || "交易"}</div>
          <div style={{ fontSize: 12, color: "var(--gold-bright)" }}>{currencyName}：{playerMoney || 0} {currencyUnit}</div>
          <span className="mobile-overlay-close mobile-only-close" onClick={onClose} aria-label="关闭交易">×</span>
        </div>

        <div className="mobile-trading-content" style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* 左侧：玩家物品，可卖。功德商店不收货，整半边不渲染 */}
          {canSell && (
          <div className="mobile-trading-column" style={{ flex: 1, padding: 12, overflowY: "auto", borderRight: `1px solid ${zoneTheme.border}` }}>
            <div style={{ fontSize: 11, color: zoneTheme.accentDim, marginBottom: 8 }}>我的物品</div>
            {sellableItems.length === 0 && (
              <div style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "center", padding: "20px 0" }}>没有可出售的物品</div>
            )}
            {sellableItems.map((item, i) => (
              <div key={item.id || i} className="mobile-trading-item" style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 8px", marginBottom: 4, background: "rgba(255,255,255,0.02)", borderRadius: 0,
              }}>
                <div style={{ fontSize: 11.5 }}>
                  <span className="mobile-touch-target"
                    onClick={() => onInspect?.("item", item.name, null, item)}
                    style={{ color: QUALITY_COLOR[item.quality] || "var(--text)", cursor: onInspect ? "pointer" : "default", textDecoration: onInspect ? "underline" : "none", textDecorationStyle: "dotted" }}
                  >{item.name}</span>
                  {item.equipped && <span style={{ color: "var(--good)", marginLeft: 4 }}>[已装备]</span>}
                  <span style={{ color: "var(--text-dim)", marginLeft: 6 }}>售 {item.sellPrice}{currencyUnit}</span>
                </div>
                <span className="mobile-touch-target"
                  onClick={() => !item.equipped && onSell(item)}
                  style={{
                    fontSize: 11, padding: "2px 10px", borderRadius: 0,
                    cursor: item.equipped ? "not-allowed" : "pointer",
                    color: item.equipped ? "var(--text-dim)" : "var(--warn)",
                    border: `1px solid ${item.equipped ? "var(--building-disabled-edge)" : "var(--gold-deep)"}`,
                  }}
                  title={item.equipped ? "已装备的物品需先卸下才能卖出" : "卖出"}
                >卖出</span>
              </div>
            ))}
          </div>
          )}

          {/* 右侧：商店物品，可买 */}
          <div className="mobile-trading-column" style={{ flex: 1, padding: 12, overflowY: "auto" }}>
            {carrySections && (
              <div style={{ marginBottom: shopItems.length ? 14 : 0 }}>
                <div style={{ fontSize: 11, color: zoneTheme.accentDim, marginBottom: 6 }}>随身之物</div>
                {[
                  { key: "equipment", label: "身上装备" },
                  { key: "bag", label: "行囊" },
                  { key: "mount", label: "挂载伙伴" },
                ].map(({ key, label }) => {
                  const items = carrySections[key] || [];
                  if (!items.length) return null;
                  return (
                    <div key={key} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: zoneTheme.textDim, marginBottom: 4 }}>{label}</div>
                      {items.map((entry, i) => {
                        const notForSale = entry.slot === "mount" || entry.sellable === false;
                        const hearts = cherishHearts(entry.cherish);
                        return (
                          <div key={entry.name + i} className="mobile-trading-item" style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "6px 8px", marginBottom: 4, background: "rgba(255,255,255,0.02)", borderRadius: 0,
                            opacity: notForSale ? 0.55 : 1,
                          }}>
                            <div style={{ fontSize: 11.5 }}>
                              <span className="mobile-touch-target"
                                onClick={() => onInspect?.("item", entry.name, null, entry)}
                                style={{ color: QUALITY_COLOR[entry.quality] || "var(--text)", cursor: onInspect ? "pointer" : "default", textDecoration: onInspect ? "underline" : "none", textDecorationStyle: "dotted" }}
                              >{entry.name}</span>
                              {hearts && <span style={{ color: "var(--pink)", marginLeft: 4, fontSize: 10 }} title={`钟爱 ${entry.cherish}`}>{hearts}</span>}
                              {!notForSale && <span style={{ color: "var(--text-dim)", marginLeft: 6 }}>{entry.price ?? 0}{currencyUnit}</span>}
                            </div>
                            {notForSale
                              ? <span style={{ fontSize: 10, color: "var(--text-dim)", padding: "2px 6px" }} title={entry.slot === "mount" ? "生死之交，不卖" : "钟爱之物，给多少钱都不卖"}>{entry.slot === "mount" ? "不卖" : "舍不得"}</span>
                              : <span className="mobile-touch-target"
                                  onClick={() => (playerMoney || 0) >= (entry.price ?? 0) && onBuyCarry?.(entry)}
                                  style={{
                                    fontSize: 11, padding: "2px 10px", borderRadius: 0,
                                    cursor: (playerMoney || 0) >= (entry.price ?? 0) ? "pointer" : "not-allowed",
                                    color: (playerMoney || 0) >= (entry.price ?? 0) ? "var(--accent)" : "var(--text-dim)",
                                    border: `1px solid ${(playerMoney || 0) >= (entry.price ?? 0) ? "var(--trading-buy-edge)" : "var(--building-disabled-edge)"}`,
                                  }}
                                  title={(playerMoney || 0) >= (entry.price ?? 0) ? "买下" : `${currencyName}不足`}
                                >买下</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
            {shopItems.length > 0 && <div style={{ fontSize: 11, color: zoneTheme.accentDim, marginBottom: 8 }}>商店货品</div>}
            {shopItems.map((item, i) => {
              // 智谋折扣：显示折后价，实付也是折后价。折扣时在现价后标「原价」——不用删除线，
              // 像素字体里横线正好压在 8/6/9 的腰上，划掉的 18 会被看成 10。
              const payPrice = Math.max(1, Math.ceil(discountedBuyPrice(item.buyPrice, playerWit) * repCoef));
              const discounted = payPrice < item.buyPrice;
              const canAfford = (playerMoney || 0) >= payPrice;
              return (
                <div key={item.id || i} className="mobile-trading-item" style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "6px 8px", marginBottom: 4, background: "rgba(255,255,255,0.02)", borderRadius: 0,
                }}>
                  <div style={{ fontSize: 11.5 }}>
                    <span className="mobile-touch-target"
                      onClick={() => onInspect?.("item", item.name, null, item)}
                      style={{ color: QUALITY_COLOR[item.quality] || "var(--text)", cursor: onInspect ? "pointer" : "default", textDecoration: onInspect ? "underline" : "none", textDecorationStyle: "dotted" }}
                    >{item.name}</span>
                    <span style={{ color: discounted ? "var(--clay)" : "var(--ink-text-dim)", marginLeft: 6 }}>{payPrice}{currencyUnit}</span>
                    {discounted && <span style={{ color: "var(--text-dim)", marginLeft: 6, fontSize: 10.5 }}>原价{item.buyPrice}</span>}
                  </div>
                  <span className="mobile-touch-target"
                    onClick={() => canAfford && onBuy({ ...item, buyPrice: payPrice })}
                    style={{
                      fontSize: 11, padding: "2px 10px", borderRadius: 0,
                      cursor: canAfford ? "pointer" : "not-allowed",
                      color: canAfford ? "var(--accent)" : "var(--text-dim)",
                      border: `1px solid ${canAfford ? "var(--trading-buy-edge)" : "var(--building-disabled-edge)"}`,
                    }}
                    title={canAfford ? "购买" : `${currencyName}不足`}
                  >购买</span>
                </div>
              );
            })}
          </div>
        </div>

        {footer && (
          <div style={{ borderTop: `1px solid ${zoneTheme.border}`, flexShrink: 0, maxHeight: "45%", overflowY: "auto" }}>
            {footer}
          </div>
        )}
        <div style={{ padding: "10px 16px", borderTop: `1px solid ${zoneTheme.border}`, textAlign: "center", flexShrink: 0 }}>
          <span className="mobile-touch-target" onClick={onClose} style={{ fontSize: 12, color: "var(--trading-close)", cursor: "pointer", padding: "4px 16px", border: `1px solid ${zoneTheme.border}`, borderRadius: 0 }}>关闭</span>
        </div>
      </div>
    </div>
  );
}
