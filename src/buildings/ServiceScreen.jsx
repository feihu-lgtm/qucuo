import React, { useState } from "react";
import { SERVICE_MENUS } from "./menuData.js";
import { Overlay, Header, Btn } from "./InnScreen.jsx";

// 饭馆/酒楼/戏楼：点菜/点单，生成 buff flag，消耗银两
export default function ServiceScreen({ building, char, time, flags, zoneTheme, onClose, inline, onOrder, onEnterBasement }) {
  const menuKey = building.menuKey || "饭馆";
  const isRestaurant = building.type === "restaurant";
  const money = char.money || 0;

  // 素斋地下室入口（仅 hasBasement 建筑显示）
  const menu = SERVICE_MENUS[menuKey] || [];
  const visibleMenu = menu.filter(item => !item.isHidden);

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name={building.name} zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ padding: 16 }}>
        <div style={{ color: "#8a8a7a", marginBottom: 12, fontSize: 11 }}>
          银两 {money} 两
        </div>
        <div style={{ color: "#7a7a6a", fontSize: 11, marginBottom: 10 }}>
          {building.desc}
        </div>

        {visibleMenu.map(item => (
          <div key={item.name} style={{ marginBottom: 10, padding: "10px 12px", background: "#10121a", borderRadius: 6, border: `1px solid ${zoneTheme.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ color: "#c8bfa0", fontSize: 13 }}>{item.name}</span>
              <span style={{ color: "#e8c468", fontSize: 12 }}>{item.price} 两</span>
            </div>
            <div style={{ color: "#7a7a6a", fontSize: 11, marginBottom: 6 }}>{item.desc}</div>
            <div style={{ color: "#6a8a6a", fontSize: 10, marginBottom: 6 }}>
              +{item.buff} {item.val} · 持续 {item.duration} 时间单位
            </div>
            <Btn
              label={`点${item.name}`}
              disabled={money < item.price}
              zoneTheme={zoneTheme}
              onClick={() => onOrder(item)}
            />
          </div>
        ))}

        {building.hasBasement && (
          <div style={{ marginTop: 16, borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 12 }}>
            <div
              onClick={onEnterBasement}
              style={{ color: "#6a4a3a", fontSize: 11, cursor: "pointer", opacity: 0.6 }}
            >
              ∿ 往里走走…
            </div>
          </div>
        )}
      </div>
    </Overlay>
  );
}

// 素斋地下室（荤食）
export function BasementScreen({ char, time, zoneTheme, onClose, inline, onOrder }) {
  const money = char.money || 0;
  const menu = SERVICE_MENUS["荤食地下室"] || [];

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name="素斋地下室" zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ padding: 16 }}>
        <div style={{ color: "#8a5a3a", fontSize: 12, marginBottom: 12 }}>
          嗯…这里和楼上大不一样。香气扑鼻，烛光昏黄，不问来路，不问因由。
        </div>
        <div style={{ color: "#8a8a7a", marginBottom: 12, fontSize: 11 }}>
          银两 {money} 两（消耗功德，在此用餐 karma -2）
        </div>
        {menu.map(item => (
          <div key={item.name} style={{ marginBottom: 10, padding: "10px 12px", background: "#14100a", borderRadius: 6, border: `1px solid #4a3a2a` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: "#e8c068", fontSize: 13 }}>{item.name}</span>
              <span style={{ color: "#e8c468" }}>{item.price} 两</span>
            </div>
            <div style={{ color: "#7a6a5a", fontSize: 11, marginBottom: 6 }}>{item.desc}</div>
            <Btn
              label="点这个"
              disabled={money < item.price}
              zoneTheme={zoneTheme}
              onClick={() => onOrder(item, -2)}
            />
          </div>
        ))}
      </div>
    </Overlay>
  );
}
