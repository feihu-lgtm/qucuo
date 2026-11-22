import React from "react";
import { Overlay, Header, Btn } from "./common.jsx";
import { checkFactionEntry } from "../../../domain/rules/character/factionEntry.js";

const hintOf = (entry, key) => ({
  rep: `· ${entry.sect}上下还不够信你。多替门里办事，把声誉攒到门墙之交。`,
  prestige: "· 江湖上名声太坏，正道名门不收。",
  trial: `· 还没过试炼。${entry.trial?.hint ?? ""}`,
  single: "· 你已在别派门下，一人不拜两师。",
  rite: `· 入门礼未成。${entry.maleRite?.hint ?? ""}`,
})[key];

// 势力拜师堂（青城、峨眉…）。结算在 features/sect/logic.js joinSect，AI 只写叙事。
export default function FactionEntryScreen({ entry, building, char, flags, varTree, zoneTheme, onClose, inline, onJoinSect }) {
  const status = checkFactionEntry(entry, { varTree, flags, char });
  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name={building?.name || entry.sect} zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ padding: "14px 16px", fontSize: 12.5, lineHeight: 1.9, color: zoneTheme.text }}>
        {status.already ? (
          <div style={{ color: "var(--clay)" }}>你已是{entry.sect}门下弟子，{entry.token}随身收好。</div>
        ) : (
          <>
            <div style={{ color: zoneTheme.textDim, marginBottom: 12 }}>{entry.intro}</div>
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
              <Btn label={entry.joinLabel} onClick={onJoinSect} zoneTheme={zoneTheme} />
            ) : (
              <>
                <Btn label="尚不够格" disabled zoneTheme={zoneTheme} />
                <div style={{ color: zoneTheme.textDim, fontSize: 11, marginTop: 8 }}>
                  {status.missing.map((key) => <div key={key}>{hintOf(entry, key)}</div>)}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Overlay>
  );
}
