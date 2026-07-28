// 物品次级操作面板（⑤消耗品服用 / ⑧地上物采摘 共用）
// 打开来源：
//   ·「包袱」里消耗品的「⊙用」按钮 → 探索态物品：查看 / 服食 / 送人(选房间NPC) / 卖掉(选房间商人)
//   ·「此地之物」里地上物的名字        → 地上物：查看 / 采摘
// 送人/卖掉需要"指定房间里的人"——本面板内嵌一个房间NPC选择器（picker）。
// 一切结算仍走父组件传进来的确定性 handler，本组件只负责选择与转交，不自行改状态。
import React, { useState } from "react";
import { QUCUO_SHOPS } from "./shops/qucuoShops.js";
import { useOverlayCloseGuard } from "./utils/overlayClose.js";

export default function ItemActionMenu({
  item, mode = "inventory", roomNpcs = [], zoneTheme,
  canConsume = false,
  onClose, onInspect, onConsume, onGive, onSell, onCollect, onEquip,
}) {
  const closeGuard = useOverlayCloseGuard(onClose);
  const [picker, setPicker] = useState(null); // null | "give" | "sell"
  const name = typeof item === "object" ? item.name : item;
  const quality = typeof item === "object" ? item.quality : null;
  // 可装备判定：武器/护甲/饰品三类。右栏「装备」区本来就能点着穿脱，但玩家捡到一件甲
  // 多半是直接在「包袱」里点开它——那时这个面板若只有查看/服食/送人/卖掉，就会显得
  // "这甲穿不上"。故此处也给一个装备入口，两处同走 toggleEquip，状态一致。
  const isObj = typeof item === "object";
  const canEquip = isObj && ["weapon", "armor", "accessory"].includes(item.category);
  const equipped = isObj && !!item.equipped;
  const statLabel = isObj ? (item.atk != null ? `攻${item.atk}` : item.def != null ? `防${item.def}` : "") : "";

  const merchantsHere = roomNpcs.filter(n => QUCUO_SHOPS[n.name]);

  const overlay = { position: "fixed", inset: 0, background: "rgba(4,4,10,0.75)", zIndex: 410, display: "flex", alignItems: "center", justifyContent: "center" };
  const panel = { background: zoneTheme.bgPanel, border: `1px solid ${zoneTheme.border}`, borderRadius: 6, padding: 20, width: 320, maxWidth: "90vw" };
  const cell = (enabled) => ({
    cursor: enabled ? "pointer" : "not-allowed", padding: "12px 10px", borderRadius: 4, textAlign: "center",
    background: zoneTheme.bg, border: `1px solid ${zoneTheme.border}`, opacity: enabled ? 1 : 0.4,
  });

  // ── 房间NPC选择器（送人/卖掉）──
  if (picker) {
    const list = picker === "sell" ? merchantsHere : roomNpcs;
    const title = picker === "sell" ? "卖给谁（此地商家）" : "送给谁（此地之人）";
    const act = picker === "sell" ? onSell : onGive;
    return (
      <div style={overlay} onMouseDown={closeGuard.onMouseDown} onClick={closeGuard.onClick}>
        <div style={panel} onClick={(e) => e.stopPropagation()}>
          <div style={{ color: zoneTheme.accent, fontSize: "13px", marginBottom: 12 }}>{title}</div>
          {list.length === 0 ? (
            <div style={{ color: zoneTheme.textDim, fontSize: "11.5px", marginBottom: 12 }}>
              {picker === "sell" ? "此地没有肯收货的商家。" : "此地无人可赠。"}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {list.map((n) => (
                <div key={n.name}
                  onClick={() => { act(n, item); onClose(); }}
                  style={{ cursor: "pointer", padding: "9px 10px", borderRadius: 4, background: zoneTheme.bg, border: `1px solid ${zoneTheme.border}` }}>
                  <span style={{ color: zoneTheme.accent, fontSize: "12.5px" }}>{n.name}</span>
                  <span style={{ color: zoneTheme.textDim, fontSize: "10px", marginLeft: 6 }}>{n.brief}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ textAlign: "center", marginTop: 14 }}>
            <span onClick={() => setPicker(null)} style={{ cursor: "pointer", color: zoneTheme.textDim, fontSize: "11px" }}>返回</span>
          </div>
        </div>
      </div>
    );
  }

  // ── 主菜单 ──
  const actions = mode === "ground"
    ? [
        { key: "collect", label: "采摘", desc: "收入囊中", enabled: true, onClick: () => { onCollect(item); onClose(); } },
        { key: "look", label: "查看", desc: "端详此物", enabled: true, onClick: () => { onInspect(item); onClose(); } },
      ]
    : [
        { key: "look", label: "查看", desc: "端详此物", enabled: true, onClick: () => { onInspect(item); onClose(); } },
        // 可装备之物：把「服食」位换成「穿戴/卸下」；不可装备的照旧显示服食。
        canEquip
          ? { key: "equip", label: equipped ? "卸下" : "穿戴", desc: equipped ? "解下此物" : (statLabel ? `装备（${statLabel}）` : "装备此物"), enabled: !!onEquip, onClick: () => { if (onEquip) { onEquip(item); onClose(); } } }
          : { key: "eat", label: "服食", desc: "当场服用", enabled: canConsume, onClick: () => { if (canConsume) { onConsume(item); onClose(); } } },
        { key: "give", label: "送人", desc: "赠予此地之人", enabled: roomNpcs.length > 0, onClick: () => { if (roomNpcs.length) setPicker("give"); } },
        { key: "sell", label: "卖掉", desc: "卖给此地商家", enabled: merchantsHere.length > 0, onClick: () => { if (merchantsHere.length) setPicker("sell"); } },
      ];

  return (
    <div style={overlay} onMouseDown={closeGuard.onMouseDown} onClick={closeGuard.onClick}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ color: quality ? undefined : zoneTheme.accent, fontSize: "14px", marginBottom: 4 }}>
          {name}{quality ? <span style={{ fontSize: "11px", color: zoneTheme.textDim, marginLeft: 6 }}>（{quality}）</span> : null}
        </div>
        <div style={{ color: zoneTheme.textDim, fontSize: "11px", marginBottom: 16 }}>
          {mode === "ground" ? "地上之物"
            : canEquip ? `${{ weapon: "兵器", armor: "护身之具", accessory: "随身饰物" }[item.category]}${statLabel ? ` · ${statLabel}` : ""}${equipped ? " · 已在身" : ""}`
            : canConsume ? "可服用之物" : "随身之物"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mode === "ground" ? "1fr 1fr" : "1fr 1fr", gap: 8 }}>
          {actions.map((a) => (
            <div key={a.key} onClick={a.onClick} style={cell(a.enabled)}>
              <div style={{ color: zoneTheme.accent, fontSize: "13px", marginBottom: 3 }}>{a.label}</div>
              <div style={{ color: zoneTheme.textDim, fontSize: "10px" }}>{a.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <span onClick={onClose} style={{ cursor: "pointer", color: zoneTheme.textDim, fontSize: "11px" }}>取消</span>
        </div>
      </div>
    </div>
  );
}
