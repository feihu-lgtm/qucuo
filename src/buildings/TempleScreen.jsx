import React from "react";
import { Overlay, Header, Btn } from "./InnScreen.jsx";

const SEVEN_DIMS = ["根骨", "悟性", "体魄", "魅力", "智谋", "身法", "气运"];

// 大殿：花 karma 拜佛，随机七维属性 +1（上限10）
export default function TempleScreen({ building, char, dao, zoneTheme, onClose, inline, onPray }) {
  const karma = dao?.karma ?? 0;
  const karmaPerPray = building.karmaPerPray || 10;
  const special = char.special || {};

  const available = SEVEN_DIMS.filter(d => (special[d] ?? 0) < 10);

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name={building.name} zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ padding: 16 }}>
        <div style={{ color: "#8f8a7c", marginBottom: 12, fontSize: 11 }}>
          功德 {karma} · 每次拜佛消耗 {karmaPerPray} 功德
        </div>
        <div style={{ color: "#8f8a7c", fontSize: 12, marginBottom: 12 }}>
          {building.desc}
        </div>
        <div style={{ color: "#e8e4d6", fontSize: 11, marginBottom: 8 }}>七维当前值：</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 12px", fontSize: 12, marginBottom: 14 }}>
          {SEVEN_DIMS.map(d => (
            <div key={d} style={{ color: (special[d] ?? 0) >= 10 ? "#4a6a4a" : "#e8e4d6" }}>
              {d} <span style={{ color: "#888" }}>{special[d] ?? 0}</span>
              {(special[d] ?? 0) >= 10 && <span style={{ color: "#4a6a4a", fontSize: 10 }}> 已满</span>}
            </div>
          ))}
        </div>
        {available.length === 0
          ? <div style={{ color: "#4a6a4a", fontSize: 12 }}>七维皆已圆满，无需再求佛。</div>
          : <Btn
            label={`拜佛（消耗 ${karmaPerPray} 功德）`}
            disabled={karma < karmaPerPray}
            zoneTheme={zoneTheme}
            onClick={onPray}
          />
        }
        {karma < karmaPerPray && available.length > 0 && (
          <div style={{ color: "#5a4a4a", fontSize: 10, marginTop: 8 }}>功德不足，多做善事积功德。</div>
        )}
      </div>
    </Overlay>
  );
}
