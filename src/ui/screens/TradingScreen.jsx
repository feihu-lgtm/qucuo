// 交易界面：跟某个NPC商人做买卖。
// 布局参照传统单机RPG的交易UI范式——左边"我的物品，可以卖"，右边"商店物品，可以买"，
// 中间一条分隔线，顶部显示当前银两。所有买卖都是本地系统裁决（直接扣/加char.money），
// 不经过AI：AI不该有权决定"这次交易到底扣了多少钱"，这跟拾取/战斗掉落是同一个原则。

import React from "react";
import { QUALITY_COLOR, discountedBuyPrice } from "../../domain/rules/economy/equipment.js";
import { THEME_VARS, chromeBtn } from "../../utils/theme.js";
import { cherishHearts } from "../../domain/rules/npc/npcCarry.js";
import ModalShell from "../primitives/ModalShell.jsx";

export default function TradingScreen({ shopName, shopItems = [], playerInv, playerMoney, playerWit = 5, repCoef = 1, onBuy, onSell, onClose, inline, onInspect, queueCount = 0,
  // 随身货架三分区（身上装备/行囊/挂载伙伴）：传了 carrySections 时 shopItems
  // 里 non-displayOnly 的部分已经在分区里渲染过了，平铺只留店里陈列。
  carrySections = null,
  // 节气大促标识：{term, discount}，界面上打个「大促」角标。
  promo = null,
  // NPC 回购系数（元朵朵冤种溢价/奸商折/好感加成）：面板卖价必须与
  // sellToNpcCarry 的实付一致——不然显示 50 实收 35。
  sellCoef = 1,
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
  const displayItems = carrySections ? shopItems.filter(i => i.displayOnly) : shopItems;

  // 内嵌（所有现存调用方都是 inline）时铺在中栏里；浮出时由 ModalShell 负责遮罩与层级。
  const outer = { borderTop: `1px solid var(--border)`, background: "var(--building-panel-bg)", height: "100%", minHeight: 0, display: "flex", flexDirection: "column" };

  const inner = inline
    ? { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }
    : { width: "min(720px, 92vw)", maxHeight: "82vh", display: "flex", flexDirection: "column", background: "var(--building-panel-bg)", border: `1px solid var(--border)`, borderRadius: 0, boxShadow: "0 8px 40px rgba(0,0,0,0.6)" };

  const body = (
    <div className="mobile-trading-panel" style={inner}>
      {inline && queueCount > 0 && (
        <div role="status" aria-live="polite"
          style={{ ...chromeBtn(THEME_VARS), alignSelf: "flex-start", flexShrink: 0, margin: "4px 12px", cursor: "default" }}>
          ⏳ 排队中 {queueCount} · 等待落盘后执行
        </div>
      )}
      <div className="mobile-trading-header" style={{ padding: "12px 16px", borderBottom: `1px solid var(--border)`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        {headerContent}
        <div style={{ fontSize: "var(--fs-base)", color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
          {shopName || "交易"}
          {promo && (
            <span role="status" style={{ fontSize: "var(--fs-2xs)", padding: "1px 6px", border: "1px solid var(--gold-bright)", color: "var(--gold-bright)", borderRadius: 2 }}>
              {promo.term}大促
            </span>
          )}
        </div>
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--gold-bright)" }}>{currencyName}：{playerMoney || 0} {currencyUnit}</div>
        <span className="mobile-overlay-close mobile-only-close" onClick={onClose} aria-label="关闭交易">×</span>
      </div>

      <div className="mobile-trading-content" style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* 左侧：玩家物品，可卖。功德商店不收货，整半边不渲染 */}
        {canSell && (
        <div className="mobile-trading-column" style={{ flex: 1, padding: 12, overflowY: "auto", borderRight: `1px solid var(--border)` }}>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--accent-dim)", marginBottom: 8 }}>我的物品</div>
          {sellableItems.length === 0 && (
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", textAlign: "center", padding: "20px 0" }}>没有可出售的物品</div>
          )}
          {sellableItems.map((item, i) => (
            <div key={item.id || i} className="mobile-trading-item" style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "6px 8px", marginBottom: 4, background: "rgba(255,255,255,0.02)", borderRadius: 0,
            }}>
              <div style={{ fontSize: "var(--fs-sm)" }}>
                <span className="mobile-touch-target"
                  onClick={() => onInspect?.("item", item.name, null, item)}
                  style={{ color: QUALITY_COLOR[item.quality] || "var(--text)", cursor: onInspect ? "pointer" : "default", textDecoration: onInspect ? "underline" : "none", textDecorationStyle: "dotted" }}
                >{item.name}</span>
                {item.equipped && <span style={{ color: "var(--good)", marginLeft: 4 }}>[已装备]</span>}
                <span style={{ color: "var(--text-dim)", marginLeft: 6 }}>售 {Math.max(1, Math.round(item.sellPrice * sellCoef))}{currencyUnit}</span>
              </div>
              <span className="mobile-touch-target trading-screen-1"
                onClick={() => !item.equipped && onSell(item)} data-on={Boolean(item.equipped)}
                title={item.equipped ? "已装备的物品需先卸下才能卖出" : "卖出"}
              >卖出</span>
            </div>
          ))}
        </div>
        )}

        {/* 右侧：商店物品，可买 */}
        <div className="mobile-trading-column" style={{ flex: 1, padding: 12, overflowY: "auto" }}>
          {carrySections && (
            <div style={{ marginBottom: displayItems.length ? 14 : 0 }}>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--accent-dim)", marginBottom: 6 }}>随身之物</div>
              {[
                { key: "equipment", label: "身上装备" },
                { key: "bag", label: "行囊" },
                { key: "mount", label: "挂载伙伴" },
              ].map(({ key, label }) => {
                const items = carrySections[key] || [];
                if (!items.length) return null;
                return (
                  <div key={key} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)", marginBottom: 4 }}>{label}</div>
                    {items.map((entry, i) => {
                      // buildCarryShelf 已把钟爱/割爱价档折成终价 buyPrice，
                      // notForSale 覆盖 mount/挚爱/不卖三态——这里只照渲染。
                      const notForSale = entry.notForSale || entry.buyPrice == null;
                      const hearts = cherishHearts(entry.cherish);
                      const affordable = (playerMoney || 0) >= (entry.buyPrice ?? Infinity);
                      return (
                        <div key={entry.name + i} className="mobile-trading-item" style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "6px 8px", marginBottom: 4, background: "rgba(255,255,255,0.02)", borderRadius: 0,
                          opacity: notForSale ? 0.55 : 1,
                        }}>
                          <div style={{ fontSize: "var(--fs-sm)" }}>
                            <span className="mobile-touch-target"
                              onClick={() => onInspect?.("item", entry.name, null, entry)}
                              style={{ color: QUALITY_COLOR[entry.quality] || "var(--text)", cursor: onInspect ? "pointer" : "default", textDecoration: onInspect ? "underline" : "none", textDecorationStyle: "dotted" }}
                            >{entry.name}</span>
                            {hearts && <span style={{ color: "var(--pink)", marginLeft: 4, fontSize: "var(--fs-2xs)" }} title={`钟爱 ${entry.cherish}`}>{hearts}</span>}
                            {!notForSale && <span style={{ color: "var(--text-dim)", marginLeft: 6 }}>{entry.buyPrice}{currencyUnit}</span>}
                            {entry.quoteMode === "geai" && <span style={{ color: "var(--clay)", marginLeft: 4, fontSize: "var(--fs-2xs)" }}>割爱</span>}
                          </div>
                          {notForSale
                            ? <span style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)", padding: "2px 6px" }} title={entry.slot === "mount" ? "生死之交，不卖" : "钟爱之物，给多少钱都不卖"}>{entry.slot === "mount" ? "不卖" : "舍不得"}</span>
                            : <span className="mobile-touch-target trading-screen-2"
                                onClick={() => affordable && onBuy(entry)} data-on={Boolean(affordable)}
                                title={affordable ? "买下" : `${currencyName}不足`}
                              >买下</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
          {displayItems.length > 0 && <div style={{ fontSize: "var(--fs-xs)", color: "var(--accent-dim)", marginBottom: 8 }}>{carrySections ? "店里陈列" : "商店货品"}</div>}
          {displayItems.map((item, i) => {
            // 智谋折扣：显示折后价，实付也是折后价。折扣时在现价后标「原价」——不用删除线，
            // 像素字体里横线正好压在 8/6/9 的腰上，划掉的 18 会被看成 10。
            // 随身货 fixedPrice：钟爱/割爱曲线已是终价，不再叠智谋折/声望折。
            const payPrice = item.fixedPrice
              ? item.buyPrice
              : Math.max(1, Math.ceil(discountedBuyPrice(item.buyPrice, playerWit) * repCoef));
            const discounted = !item.fixedPrice && payPrice < item.buyPrice;
            const canAfford = (playerMoney || 0) >= payPrice;
            const notForSale = item.notForSale || item.displayOnly;
            return (
              <div key={item.id || i} className="mobile-trading-item" style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 8px", marginBottom: 4, background: "rgba(255,255,255,0.02)", borderRadius: 0,
              }}>
                <div style={{ fontSize: "var(--fs-sm)" }}>
                  <span className="mobile-touch-target"
                    onClick={() => onInspect?.("item", item.name, null, item)}
                    style={{ color: QUALITY_COLOR[item.quality] || "var(--text)", cursor: onInspect ? "pointer" : "default", textDecoration: onInspect ? "underline" : "none", textDecorationStyle: "dotted" }}
                  >{item.name}</span>
                  {item.cherish >= 50 && <span title={`钟爱 ${item.cherish}`} style={{ marginLeft: 4, fontSize: "var(--fs-2xs)", color: "var(--red-soft)" }}>♥</span>}
                  {item.displayOnly
                    ? <span style={{ color: "var(--text-dim)", marginLeft: 6, fontSize: "var(--fs-xs)" }}>陈列 {item.buyPrice ?? "—"}{currencyUnit}</span>
                    : notForSale
                      ? null
                      : <span style={{ color: discounted ? "var(--clay)" : "var(--ink-text-dim)", marginLeft: 6 }}>{payPrice}{currencyUnit}</span>}
                  {discounted && <span style={{ color: "var(--text-dim)", marginLeft: 6, fontSize: "var(--fs-xs)" }}>原价{item.buyPrice}</span>}
                </div>
                {notForSale
                  ? <span style={{ fontSize: "var(--fs-xs)", padding: "2px 10px", color: "var(--text-dim)", border: "1px solid var(--building-disabled-edge)", borderRadius: 0, cursor: "default" }}>{item.displayOnly ? "陈列" : "不卖"}</span>
                  : <span className="mobile-touch-target trading-screen-3"
                    onClick={() => canAfford && onBuy({ ...item, buyPrice: payPrice })} data-on={Boolean(canAfford)}
                    title={canAfford ? "购买" : `${currencyName}不足`}
                  >购买</span>}
              </div>
            );
          })}
        </div>
      </div>

      {footer && (
        <div style={{ borderTop: `1px solid var(--border)`, flexShrink: 0, maxHeight: "45%", overflowY: "auto" }}>
          {footer}
        </div>
      )}
      <div style={{ padding: "10px 16px", borderTop: `1px solid var(--border)`, textAlign: "center", flexShrink: 0 }}>
        <span className="mobile-touch-target trading-screen-4" onClick={onClose}>关闭</span>
      </div>
    </div>
  );

  if (inline) return <div className="mobile-trading-root" style={outer}>{body}</div>;
  // 浮出分支：原 z 200、遮罩 rgba(0,0,0,0.75)，并入 screen 档与 soft 遮罩；面板样式在 inner 里，外壳去壳。
  return (
    <ModalShell onClose={onClose} layer="screen" backdrop="soft" mobile="none" chrome={false} showClose={false}
      className="mobile-trading-root" ariaLabel={shopName || "交易"}>
      {body}
    </ModalShell>
  );
}
