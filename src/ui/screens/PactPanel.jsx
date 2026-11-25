import React from "react";
import { Overlay, Header } from "./buildings/common.jsx";
import { useGameStore } from "../../store/gameStore.js";
import { flattenPacts, pactDeadlineLine } from "../../domain/rules/judge/pactLines.js";

// 「江湖契约」面板（WO-22B-P4b）——纯读 varTree.世界.契约，不写任何状态。
// 列表按人分组：NPC、约定、期限（剩余/已逾时辰）、状态（未了/已了/违约）、酬谢提示。
// 旧档兼容：无 place/deadlineHours/breachTurn 字段不炸。

const STATUS_LABEL = { open: "未了", settled: "已了", breached: "违约" };
const STATUS_COLOR = { open: "var(--text)", settled: "var(--text-dim)", breached: "var(--danger, #c66)" };

function PactRow({ pact, now, zoneTheme }) {
  const deadline = pactDeadlineLine(pact, now);
  return (
    <div style={{
      padding: "8px 10px", border: `1px solid ${zoneTheme.border}`,
      display: "flex", flexDirection: "column", gap: 3,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--text)", fontSize: "var(--fs-sm)", flexShrink: 0 }}>{pact.npcName}</span>
        <span style={{ color: STATUS_COLOR[pact.status] || "var(--text-dim)", fontSize: "var(--fs-2xs)" }}>
          {STATUS_LABEL[pact.status] || "未了"}
        </span>
        {deadline && <span style={{ color: "var(--text-dim)", fontSize: "var(--fs-2xs)" }}>{deadline}</span>}
        {pact.place ? <span style={{ color: "var(--text-dim)", fontSize: "var(--fs-2xs)", marginLeft: "auto" }}>立约于{pact.place}</span> : null}
      </div>
      <div style={{ color: "var(--text)", fontSize: "var(--fs-xs)" }}>「{pact.promise}」</div>
      {String(pact.rewardHint || "").trim() ? (
        <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-2xs)" }}>允诺酬谢：{pact.rewardHint}</div>
      ) : null}
    </div>
  );
}

export default function PactPanel({ zoneTheme, onClose, inline }) {
  const varTree = useGameStore((s) => s.varTree);
  const now = useGameStore((s) => s.time);
  const pacts = flattenPacts(varTree).sort((a, b) => (a.bindTurn || 0) - (b.bindTurn || 0));
  const open = pacts.filter((p) => p.status !== "settled");
  const closed = pacts.filter((p) => p.status === "settled");

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name={`江湖契约${open.length ? `（未了 ${open.length}）` : ""}`} zoneTheme={zoneTheme} onClose={onClose} />
      <div className="mobile-overlay-content" style={{ padding: 16 }}>
        {!pacts.length && (
          <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)" }}>
            你还没有与人立下带期限的约定。当面说定的事，会记在这里。
          </div>
        )}
        {open.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {open.map((p) => <PactRow key={`${p.npcName}/${p.pactKey}`} pact={p} now={now} zoneTheme={zoneTheme} />)}
          </div>
        )}
        {closed.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-2xs)", marginBottom: 4 }}>已了</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, opacity: 0.6 }}>
              {closed.map((p) => <PactRow key={`${p.npcName}/${p.pactKey}`} pact={p} now={now} zoneTheme={zoneTheme} />)}
            </div>
          </div>
        )}
      </div>
    </Overlay>
  );
}
