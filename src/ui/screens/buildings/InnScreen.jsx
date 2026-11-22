import React, { useState } from "react";
import { Overlay, Header, Btn } from "./common.jsx";

// 客栈：花银两住宿，气血回满，时间推进24单位（一天）
// healOnly=true 时作为医馆使用：不推时间，按 healPerLiang 换算回血
export default function InnScreen({ building, char, time, zoneTheme, onClose, onRest, onHeal, inline }) {
  const [choice, setChoice] = useState(null); // null | "普通" | "上等"

  const isHospital = building.type === "hospital";
  const innPrice = building.innPrice || 10;
  const superPrice = innPrice * 3;
  const healPerLiang = building.healPerLiang || 3;
  const [healAmount, setHealAmount] = useState(30);

  const hp = char.hp[0];
  const maxHp = char.hp[1];
  const money = char.money || 0;

  if (isHospital) {
    const cost = Math.ceil((maxHp - hp) / healPerLiang);
    return (
      <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
        <Header name={building.name} zoneTheme={zoneTheme} onClose={onClose} />
        <div style={{ padding: 16 }}>
          <p style={{ color: zoneTheme.text, marginBottom: 12, fontSize: 13 }}>{building.desc}</p>
          <div style={{ color: "var(--text-dim)", marginBottom: 12 }}>
            气血 {hp}/{maxHp} · 银两 {money} 两 · 每两回 {healPerLiang} 点气血
          </div>
          <div style={{ color: "var(--text)", marginBottom: 8 }}>回满需花 {cost} 两</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn label={`回满（${cost}两）`} disabled={money < cost || hp >= maxHp}
              zoneTheme={zoneTheme} onClick={() => onHeal(cost, maxHp - hp, "解毒治疗")} />
            <Btn label="关闭" zoneTheme={zoneTheme} secondary onClick={onClose} />
          </div>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name={building.name} zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ padding: 16 }}>
        <p style={{ color: zoneTheme.text, marginBottom: 12, fontSize: 13 }}>{building.desc}</p>
        <div style={{ color: "var(--text-dim)", marginBottom: 16 }}>
          气血 {hp}/{maxHp} · 银两 {money} 两
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn
            label={`普通客房（${innPrice}两）`}
            disabled={money < innPrice}
            zoneTheme={zoneTheme}
            onClick={() => onRest(innPrice, "普通客房")}
          />
          <Btn
            label={`上等厢房（${superPrice}两）`}
            disabled={money < superPrice}
            zoneTheme={zoneTheme}
            onClick={() => onRest(superPrice, "上等厢房")}
          />
          <Btn label="关闭" zoneTheme={zoneTheme} secondary onClick={onClose} />
        </div>
        <div style={{ color: "var(--text-dim)", fontSize: 11, marginTop: 12 }}>
          住宿后气血回满，时间推进一天（24单位）
        </div>
      </div>
    </Overlay>
  );
}
