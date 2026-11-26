import React, { useState } from "react";
import { Overlay, Header, Btn } from "./common.jsx";
import { checkFactionEntry } from "../../../domain/rules/character/factionEntry.js";
import { useGameStore } from "../../../store/gameStore.js";

const hintOf = (entry, key) => ({
  rep: `· ${entry.sect}上下还不够信你。多替门里办事，把声誉攒到门墙之交。`,
  prestige: "· 江湖上名声太坏，正道名门不收。",
  trial: `· 还没过试炼。${entry.trial?.hint ?? ""}`,
  single: "· 你已在别派门下，一人不拜两师。",
  rite: `· 入门礼未成。${entry.maleRite?.hint ?? ""}`,
  defected: `· 你叛出过${entry.sect}，门墙永闭。`,
})[key];

// 叛出本派：点两下才生效，防误触。
export function LeaveSectButton({ sect, onLeaveSect }) {
  const [armed, setArmed] = useState(false);
  if (!onLeaveSect) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <Btn label={armed ? `确认叛出${sect}（声誉重置 -40，门墙永闭）` : `叛出${sect}`}
        onClick={() => (armed ? onLeaveSect(sect) : setArmed(true))} />
      {armed && <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)", marginTop: 6 }}>交还信物，已学招式保留，本门高阶武学从此不再突破。</div>}
    </div>
  );
}

// 势力拜师堂（青城、峨眉…）。结算在 features/sect/logic.js joinSect，AI 只写叙事。
export default function FactionEntryScreen({ entry, building, char, flags, varTree, questProgress, onClose, inline, onJoinSect, onLeaveSect }) {
  const inv = useGameStore((s) => s.inv);
  const skills = useGameStore((s) => s.skills);
  const status = checkFactionEntry(entry, { varTree, flags, char, questProgress, inv, skills });
  return (
    <Overlay onClose={onClose} inline={inline}>
      <Header name={building?.name || entry.sect} onClose={onClose} />
      <div style={{ padding: "14px 16px", fontSize: "var(--fs-md)", lineHeight: 1.9, color: "var(--text)" }}>
        {status.already ? (
          <>
            <div style={{ color: "var(--clay)" }}>你已是{entry.sect}门下弟子，{entry.token}随身收好。</div>
            <LeaveSectButton sect={entry.sect} onLeaveSect={onLeaveSect} />
          </>
        ) : (
          <>
            <div style={{ color: "var(--text-dim)", marginBottom: 12 }}>{entry.intro}</div>
            <div style={{ border: `1px solid var(--border)`, padding: "10px 12px", marginBottom: 12, background: "rgba(255,255,255,.02)" }}>
              <div style={{ color: "var(--accent-dim)", fontSize: "var(--fs-xs)", marginBottom: 6 }}>入门之限</div>
              {status.reqs.map((r) => (
                <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--fs-sm)" }}>
                  <span style={{ color: r.ok ? "var(--clay)" : "var(--ink-danger-soft)", width: 12 }}>{r.ok ? "✓" : "✗"}</span>
                  <span style={{ flex: 1, color: r.ok ? "var(--text)" : "var(--text-dim)" }}>{r.label}</span>
                  <span style={{ color: r.ok ? "var(--clay)" : "var(--ink-danger-soft)", fontSize: "var(--fs-xs)" }}>{r.have}</span>
                </div>
              ))}
            </div>
            {status.eligible ? (
              <Btn label={entry.joinLabel} onClick={onJoinSect} />
            ) : (
              <>
                <Btn label="尚不够格" disabled />
                <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)", marginTop: 8 }}>
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
