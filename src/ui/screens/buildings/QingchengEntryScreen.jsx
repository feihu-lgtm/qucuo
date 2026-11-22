import React from "react";
import { Overlay, Header, Btn } from "./common.jsx";
import { QINGCHENG_ENTRY, checkQingchengEntry } from "../../../domain/rules/character/qingchengEntry.js";

const HINTS = {
  rep: "· 青城上下还不够信你。去剑坪切磋、替山门办事，把声誉攒到门墙之交。",
  prestige: "· 江湖上名声太坏，正道名门不收。",
  trial: "· 还没过试剑。去剑坪堂堂正正胜青玄或松鹤道长一场，不许用毒。",
  single: "· 你已在别派门下，一人不拜两师。",
};

// 青城山山门：拜入青城派。结算在 features/sect/logic.js joinSect，AI 只写叙事。
export default function QingchengEntryScreen({ building, flags, varTree, zoneTheme, onClose, inline, onJoinSect }) {
  const status = checkQingchengEntry({ varTree, flags });
  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name={building?.name || "青城山山门"} zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ padding: "14px 16px", fontSize: 12.5, lineHeight: 1.9, color: zoneTheme.text }}>
        {status.already ? (
          <div style={{ color: "var(--clay)" }}>你已是{QINGCHENG_ENTRY.sect}门下弟子，竹牌随身收好。</div>
        ) : (
          <>
            <div style={{ color: zoneTheme.textDim, marginBottom: 12 }}>
              牌坊下摆着登记名册与一筐竹制腰牌。持堂道人说，欲入玄门，先在此明志试心，再由{QINGCHENG_ENTRY.master}点头。
            </div>
            <div style={{ border: `1px solid ${zoneTheme.border}`, padding: "10px 12px", marginBottom: 12, background: "rgba(255,255,255,.02)" }}>
              <div style={{ color: zoneTheme.accentDim, fontSize: 11, marginBottom: 6 }}>入门之限</div>
              {status.reqs.map((r) => (
                <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                  <span style={{ color: r.ok ? "var(--clay)" : "#c47070", width: 12 }}>{r.ok ? "✓" : "✗"}</span>
                  <span style={{ flex: 1, color: r.ok ? zoneTheme.text : zoneTheme.textDim }}>{r.label}</span>
                  <span style={{ color: r.ok ? "var(--clay)" : "#c47070", fontSize: 11 }}>{r.have}</span>
                </div>
              ))}
            </div>
            {status.eligible ? (
              <Btn label={`明志试心，拜入${QINGCHENG_ENTRY.sect}`} onClick={onJoinSect} zoneTheme={zoneTheme} />
            ) : (
              <>
                <Btn label="尚不够格" disabled zoneTheme={zoneTheme} />
                <div style={{ color: zoneTheme.textDim, fontSize: 11, marginTop: 8 }}>
                  {status.missing.map((key) => <div key={key}>{HINTS[key]}</div>)}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Overlay>
  );
}
