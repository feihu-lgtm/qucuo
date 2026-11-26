import React from "react";
import { SKILL_CATALOG, hasSkill } from "../../../domain/data/kungfu/qucuoKungfu.js";
import { QUALITY_COLOR } from "../../../domain/rules/economy/equipment.js";
import { skillPrice, skillUnlockStatus } from "../../../domain/rules/economy/skillUnlock.js";
import { Overlay, Header, Btn } from "./common.jsx";

const SKILL_TYPE_LABEL = { 招式: "招", 内功: "内", 轻功: "轻" };

export default function WuguanScreen({ building, char, skills, flags, questProgress, varTree, onClose, inline, onBuySkill }) {
  const skillSet = building.skillSet || "";
  const catalog = SKILL_CATALOG[skillSet] || [];
  const money = char.money || 0;

  return (
    <Overlay onClose={onClose} inline={inline}>
      <Header name={building.name} onClose={onClose} />

      <div style={{ padding: 16 }}>
        <div style={{ color: "var(--ink-text-dim)", marginBottom: 12, fontSize: "var(--fs-xs)" }}>银两 {money} 两</div>

        {catalog.length === 0
          ? <div style={{ color: "var(--ink-text-dim)" }}>此武馆暂无秘籍可购。</div>
          : catalog.map(item => {
              const owned = hasSkill(skills, item.id);
              const unlock = skillUnlockStatus({ flags, questProgress, varTree }, item);
              return (
                <div key={item.id} style={{ marginBottom: 12, padding: "10px 12px", background: "var(--bg-ink)", borderRadius: 0, border: `1px solid var(--border)` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ color: QUALITY_COLOR[item.quality] || "var(--ink-text)", fontSize: "var(--fs-md)" }}>
                      {item.name}
                      <span style={{ color: "var(--ink-text-dim)", fontSize: "var(--fs-2xs)", marginLeft: 6 }}>
                        {SKILL_TYPE_LABEL[item.type] || item.type}·{item.quality}·{item.moveType}
                      </span>
                    </span>
                    <span style={{ color: item.insight ? "var(--ink-info)" : "var(--gold-bright)", fontSize: "var(--fs-sm)" }}>
                      {item.insight ? `参悟 · ${item.insight.label}≥${item.insight.threshold}` : `${skillPrice({ flags }, item)} 两`}
                    </span>
                  </div>
                  <div style={{ color: "var(--ink-text-dim)", fontSize: "var(--fs-xs)", marginBottom: 8 }}>{item.desc}</div>
                  {owned
                    ? <span style={{ color: "var(--skill-learned)", fontSize: "var(--fs-xs)" }}>✓ 已习得</span>
                    : !unlock.ok
                      ? <span style={{ color: "var(--wuguan-locked)", fontSize: "var(--fs-xs)" }}>尚不可学：{unlock.reason}</span>
                    : item.insight
                      ? (() => {
                        // 参悟类：不花钱，看门槛。够不到就明说还差多少——
                        // 此前这类武学连界面都进不去（令狐冲墓是 TEMPLE），
                        // 玩家看着描述里写的门槛却无处可试。
                        const cur = char?.[item.insight.stat] ?? 0;
                        const ok = cur >= item.insight.threshold;
                        return ok
                          ? <Btn label="参悟" onClick={() => onBuySkill(item)} />
                          : <span style={{ color: "var(--wuguan-locked)", fontSize: "var(--fs-xs)" }}>
                              壁上剑痕看得见，看不懂——{item.insight.label} {cur}/{item.insight.threshold}
                            </span>;
                      })()
                      : <Btn
                        label="购买"
                        disabled={money < skillPrice({ flags }, item)}
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
