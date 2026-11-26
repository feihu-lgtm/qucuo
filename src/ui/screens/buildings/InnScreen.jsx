import React, { useState } from "react";
import { Overlay, Header, Btn } from "./common.jsx";
import { hospitalQuote } from "../../../features/buildings/logic.js";
import { clinicCare, clinicDoneToday, clinicOf } from "../../../features/buildings/factionClinic.js";

// 客栈：花银两住宿，气血回满，时间推进24单位（一天）
// 医馆（type=hospital）：按 healPerLiang 换算回血，回到含内功被动的有效气血上限
export default function InnScreen({ building, char, skills, time, varTree, flags, zoneTheme, onClose, onRest, onHeal, onClinic, inline }) {
  const [choice, setChoice] = useState(null); // null | "普通" | "上等"

  const isHospital = building.type === "hospital";
  const innPrice = building.innPrice || 10;
  const superPrice = innPrice * 3;
  const healPerLiang = building.healPerLiang || 3;
  const [healAmount, setHealAmount] = useState(30);

  const hp = char.hp[0];
  const money = char.money || 0;
  const { maxHp, missing, cost } = hospitalQuote({ char, skills }, healPerLiang);

  if (isHospital) {
    const care = clinicCare(varTree, building.id);
    const price = care === "free" ? 0 : cost;
    const clinic = clinicOf(building.id);
    const clinicDone = clinicDoneToday(building.id, { flags, time });
    return (
      <Overlay onClose={onClose} inline={inline}>
        <Header name={building.name} onClose={onClose} />
        <div style={{ padding: 16 }}>
          <p style={{ color: zoneTheme.text, marginBottom: 12, fontSize: "var(--fs-md)" }}>{building.desc}</p>
          <div style={{ color: "var(--ink-text-dim)", marginBottom: 12 }}>
            气血 {hp}/{maxHp} · 银两 {money} 两 · 每两回 {healPerLiang} 点气血
          </div>
          <div style={{ color: "var(--ink-text)", marginBottom: 8 }}>
            {care === "refuse" ? clinic.refuse
              : care === "free" ? `与${clinic.faction}善缘深厚，免收诊金` : `回满需花 ${cost} 两`}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {care !== "refuse" && (
              <Btn label={care === "free" ? "免费诊治" : `回满（${cost}两）`} disabled={money < price || missing <= 0} onClick={() => onHeal(price, missing, "解毒治疗")} />
            )}
            {clinic && care !== "refuse" && (
              <Btn label={clinicDone ? clinic.done : clinic.label} disabled={clinicDone || money < clinic.cost} onClick={onClinic} />
            )}
            <Btn label="关闭" secondary onClick={onClose} />
          </div>
        </div>
      </Overlay>
    );
  }

  const innDeed = clinicOf(building.id);
  const innDeedDone = innDeed && clinicDoneToday(building.id, { flags, time });
  return (
    <Overlay onClose={onClose} inline={inline}>
      <Header name={building.name} onClose={onClose} />
      <div style={{ padding: 16 }}>
        <p style={{ color: zoneTheme.text, marginBottom: 12, fontSize: "var(--fs-md)" }}>{building.desc}</p>
        <div style={{ color: "var(--ink-text-dim)", marginBottom: 16 }}>
          气血 {hp}/{maxHp} · 银两 {money} 两
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn
            label={`普通客房（${innPrice}两）`}
            disabled={money < innPrice}
            onClick={() => onRest(innPrice, "普通客房")}
          />
          <Btn
            label={`上等厢房（${superPrice}两）`}
            disabled={money < superPrice}
            onClick={() => onRest(superPrice, "上等厢房")}
          />
          {innDeed && clinicCare(varTree, building.id) !== "refuse" && (
            <Btn label={innDeedDone ? innDeed.done : innDeed.label} disabled={innDeedDone || money < innDeed.cost} onClick={onClinic} />
          )}
          <Btn label="关闭" secondary onClick={onClose} />
        </div>
        <div style={{ color: "var(--ink-text-dim)", fontSize: "var(--fs-xs)", marginTop: 12 }}>
          住宿后气血回满，时间推进一天（24单位）
        </div>
      </div>
    </Overlay>
  );
}
