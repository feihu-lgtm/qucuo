import React from "react";
import { Overlay, Header, Btn } from "./common.jsx";
import { clinicCare, clinicDoneToday, clinicOf, clinicWeekFull } from "../../../features/buildings/factionClinic.js";

const SEVEN_DIMS = ["根骨", "悟性", "体魄", "魅力", "智谋", "身法", "气运"];

// 大殿：花 karma 拜佛，随机七维属性 +1（上限10）
export default function TempleScreen({ building, char, dao, varTree, flags, time, zoneTheme, onClose, inline, onPray, onClinic }) {
  const karma = dao?.karma ?? 0;
  const karmaPerPray = building.karmaPerPray || 10;
  const special = char.special || {};

  const available = SEVEN_DIMS.filter(d => (special[d] ?? 0) < 10);
  const offering = clinicOf(building.id);
  const offeringRefused = offering && clinicCare(varTree, building.id) === "refuse";
  const offeringDone = offering && (clinicDoneToday(building.id, { flags, time }) || clinicWeekFull(building.id, { flags, time }));

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name={building.name} zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ padding: 16 }}>
        <div style={{ color: "var(--ink-text-dim)", marginBottom: 12, fontSize: "var(--fs-xs)" }}>
          功德 {karma} · 每次拜佛消耗 {karmaPerPray} 功德
        </div>
        <div style={{ color: "var(--ink-text-dim)", fontSize: "var(--fs-sm)", marginBottom: 12 }}>
          {building.desc}
        </div>
        <div style={{ color: "var(--ink-text)", fontSize: "var(--fs-xs)", marginBottom: 8 }}>七维当前值：</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 12px", fontSize: "var(--fs-sm)", marginBottom: 14 }}>
          {SEVEN_DIMS.map(d => (
            <div key={d} style={{ color: (special[d] ?? 0) >= 10 ? "var(--temple-full)" : "var(--ink-text)" }}>
              {d} <span style={{ color: "var(--attr-value)" }}>{special[d] ?? 0}</span>
              {(special[d] ?? 0) >= 10 && <span style={{ color: "var(--temple-full)", fontSize: "var(--fs-2xs)" }}> 已满</span>}
            </div>
          ))}
        </div>
        {available.length === 0
          ? <div style={{ color: "var(--temple-full)", fontSize: "var(--fs-sm)" }}>七维皆已圆满，无需再求佛。</div>
          : <Btn
            label={`拜佛（消耗 ${karmaPerPray} 功德）`}
            disabled={karma < karmaPerPray}
            zoneTheme={zoneTheme}
            onClick={onPray}
          />
        }
        {karma < karmaPerPray && available.length > 0 && (
          <div style={{ color: "var(--temple-hint)", fontSize: "var(--fs-2xs)", marginTop: 8 }}>功德不足，多做善事积功德。</div>
        )}
        {offering && (
          <div style={{ marginTop: 14 }}>
            {offeringRefused
              ? <div style={{ color: "var(--temple-hint)", fontSize: "var(--fs-xs)" }}>{offering.refuse}</div>
              : <Btn label={offeringDone ? offering.done : offering.label}
                disabled={offeringDone || (char.money ?? 0) < offering.cost}
                zoneTheme={zoneTheme} onClick={onClinic} />}
          </div>
        )}
      </div>
    </Overlay>
  );
}
