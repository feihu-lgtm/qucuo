import React, { useState } from "react";
import { SKILL_CATALOG, hasSkill, makeSkillEntry, nextBreakthroughReq, STAGE_ORDER } from "../kungfu/qucuoKungfu.js";
import { QUALITY_COLOR } from "../equipment.js";
import { Overlay, Header, Btn } from "./InnScreen.jsx";

const SKILL_TYPE_LABEL = { 招式: "招", 内功: "内", 轻功: "轻" };

export default function WuguanScreen({ building, char, skills, zoneTheme, onClose, inline, onBuySkill, onBreakthrough }) {
  const [tab, setTab] = useState("buy"); // "buy" | "breakthrough"
  const skillSet = building.skillSet || "";
  const catalog = SKILL_CATALOG[skillSet] || [];
  const money = char.money || 0;

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name={building.name} zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${zoneTheme.border}` }}>
        {[["buy", "购买秘籍"], ["breakthrough", "阶段突破"]].map(([id, label]) => (
          <span
            key={id} onClick={() => setTab(id)}
            style={{
              padding: "8px 18px", fontSize: 12, cursor: "pointer", userSelect: "none",
              color: tab === id ? zoneTheme.accent : zoneTheme.accentDim,
              borderBottom: tab === id ? `2px solid ${zoneTheme.accent}` : "2px solid transparent",
            }}
          >{label}</span>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ color: "#8a8a7a", marginBottom: 12, fontSize: 11 }}>银两 {money} 两</div>

        {tab === "buy" && (
          catalog.length === 0
            ? <div style={{ color: "#5a5a4a" }}>此武馆暂无秘籍可购。</div>
            : catalog.map(item => {
              const owned = hasSkill(skills, item.id);
              return (
                <div key={item.id} style={{ marginBottom: 12, padding: "10px 12px", background: "#10121a", borderRadius: 6, border: `1px solid ${zoneTheme.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ color: QUALITY_COLOR[item.quality] || "#c8bfa0", fontSize: 13 }}>
                      {item.name}
                      <span style={{ color: "#5a5a4a", fontSize: 10, marginLeft: 6 }}>
                        {SKILL_TYPE_LABEL[item.type] || item.type}·{item.quality}·{item.moveType}
                      </span>
                    </span>
                    <span style={{ color: "#e8c468", fontSize: 12 }}>{item.price} 两</span>
                  </div>
                  <div style={{ color: "#7a7a6a", fontSize: 11, marginBottom: 8 }}>{item.desc}</div>
                  {owned
                    ? <span style={{ color: "#3a5a3a", fontSize: 11 }}>✓ 已习得</span>
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
        )}

        {tab === "breakthrough" && (
          skills.length === 0
            ? <div style={{ color: "#5a5a4a" }}>尚未习得任何武学。</div>
            : skills.map(s => {
              const req = nextBreakthroughReq(s);
              const canBreak = req && s.level >= req.minLevel && money >= req.price;
              const maxed = !req;
              return (
                <div key={s.id} style={{ marginBottom: 10, padding: "10px 12px", background: "#10121a", borderRadius: 6, border: `1px solid ${zoneTheme.border}` }}>
                  <div style={{ color: "#c8bfa0", fontSize: 13, marginBottom: 4 }}>
                    {s.name}
                    <span style={{ color: "#5a5a4a", fontSize: 11, marginLeft: 6 }}>{s.stage} Lv.{s.level}</span>
                  </div>
                  {maxed
                    ? <div style={{ color: "#4a8a4a", fontSize: 11 }}>已达最高境界</div>
                    : <div>
                      <div style={{ color: "#7a7a6a", fontSize: 11, marginBottom: 6 }}>
                        → {req.nextStage}｜需 Lv.{req.minLevel}（当前 Lv.{s.level}）｜需 {req.price} 两
                      </div>
                      <Btn
                        label={`突破至${req.nextStage}（${req.price}两）`}
                        disabled={!canBreak}
                        zoneTheme={zoneTheme}
                        onClick={() => onBreakthrough(s, req)}
                      />
                      {s.level < req.minLevel && (
                        <div style={{ color: "#5a4a4a", fontSize: 10, marginTop: 4 }}>
                          等级不足，还需 {req.minLevel - s.level} 级
                        </div>
                      )}
                    </div>
                  }
                </div>
              );
            })
        )}
      </div>
    </Overlay>
  );
}
