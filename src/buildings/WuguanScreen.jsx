import React from "react";
import { SKILL_CATALOG, hasSkill } from "../kungfu/qucuoKungfu.js";
import { QUALITY_COLOR } from "../equipment.js";
import { Overlay, Header, Btn } from "./InnScreen.jsx";

const SKILL_TYPE_LABEL = { 招式: "招", 内功: "内", 轻功: "轻" };

export default function WuguanScreen({ building, char, skills, zoneTheme, onClose, inline, onBuySkill }) {
  const skillSet = building.skillSet || "";
  const catalog = SKILL_CATALOG[skillSet] || [];
  const money = char.money || 0;

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name={building.name} zoneTheme={zoneTheme} onClose={onClose} />

      <div style={{ padding: 16 }}>
        <div style={{ color: "#8f8a7c", marginBottom: 12, fontSize: 11 }}>银两 {money} 两</div>

        {catalog.length === 0
          ? <div style={{ color: "#8f8a7c" }}>此武馆暂无秘籍可购。</div>
          : catalog.map(item => {
              const owned = hasSkill(skills, item.id);
              return (
                <div key={item.id} style={{ marginBottom: 12, padding: "10px 12px", background: "#161510", borderRadius: 0, border: `1px solid ${zoneTheme.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ color: QUALITY_COLOR[item.quality] || "#e8e4d6", fontSize: 13 }}>
                      {item.name}
                      <span style={{ color: "#8f8a7c", fontSize: 10, marginLeft: 6 }}>
                        {SKILL_TYPE_LABEL[item.type] || item.type}·{item.quality}·{item.moveType}
                      </span>
                    </span>
                    <span style={{ color: item.insight ? "#8ac8b8" : "#e8c468", fontSize: 12 }}>
                      {item.insight ? `参悟 · ${item.insight.label}≥${item.insight.threshold}` : `${item.price} 两`}
                    </span>
                  </div>
                  <div style={{ color: "#8f8a7c", fontSize: 11, marginBottom: 8 }}>{item.desc}</div>
                  {owned
                    ? <span style={{ color: "#3a5a3a", fontSize: 11 }}>✓ 已习得</span>
                    : item.insight
                      ? (() => {
                        // 参悟类：不花钱，看门槛。够不到就明说还差多少——
                        // 此前这类武学连界面都进不去（令狐冲墓是 TEMPLE），
                        // 玩家看着描述里写的门槛却无处可试。
                        const cur = char?.[item.insight.stat] ?? 0;
                        const ok = cur >= item.insight.threshold;
                        return ok
                          ? <Btn label="参悟" zoneTheme={zoneTheme} onClick={() => onBuySkill(item)} />
                          : <span style={{ color: "#6a5a4a", fontSize: 11 }}>
                              壁上剑痕看得见，看不懂——{item.insight.label} {cur}/{item.insight.threshold}
                            </span>;
                      })()
                      : <Btn
                        label="购买"
                        disabled={money < item.price}
                        zoneTheme={zoneTheme}
                        onClick={() => onBuySkill(item)}
                      />
                  }
                </div>
              );
            })
        }
      </div>
    </Overlay>
  );
}
