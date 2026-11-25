import React from "react";
import { Overlay, Header } from "./buildings/common.jsx";
import { useGameStore } from "../../store/gameStore.js";
import { flattenPacts, pactDeadlineLine } from "../../domain/rules/judge/pactLines.js";
import { flattenNemeses, nemesisGrudgeLine, nemesisStatusLine } from "../../domain/rules/nemesis/nemesisLines.js";
import { nemesisRecruitEligibility } from "../../domain/rules/nemesis/recruitCheck.js";

// 「契约与宿敌」面板（WO-22B-P4b/WO-23B）——纯读 varTree.世界.契约/宿敌谱，不写任何状态。
// 列表按人分组：NPC、约定、期限（剩余/已逾时辰）、状态（未了/已了/违约）、酬谢提示。
// 旧档兼容：无 place/deadlineHours/breachTurn 字段不炸。

const STATUS_LABEL = { open: "未了", settled: "已了", breached: "违约" };
const STATUS_COLOR = { open: "var(--text)", settled: "var(--text-dim)", breached: "var(--red-soft)" };

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

function NemesisRow({ entry, zoneTheme, varTree, onRecruitNemesis }) {
  const scars = (entry.scars || []).slice(-3);
  const grudgeLine = nemesisGrudgeLine(entry.grudge);
  return (
    <div style={{
      padding: "8px 10px", border: `1px solid ${zoneTheme.border}`,
      display: "flex", flexDirection: "column", gap: 3,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--text)", fontSize: "var(--fs-sm)" }}>{entry.name}</span>
        <span style={{ color: "var(--text-dim)", fontSize: "var(--fs-2xs)" }}>{entry.faction}·第{entry.tier}阶</span>
        {nemesisStatusLine(entry) && <span style={{ color: "var(--text-dim)", fontSize: "var(--fs-2xs)" }}>{nemesisStatusLine(entry)}</span>}
        {grudgeLine && <span style={{ color: "var(--red-soft)", fontSize: "var(--fs-2xs)", marginLeft: "auto" }}>{grudgeLine}</span>}
      </div>
      <div style={{ color: "var(--text)", fontSize: "var(--fs-xs)" }}>{String(entry.epithet || "").trim() || "尚无绰号"}</div>
      {entry.origin?.summary ? (
        <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-2xs)" }}>
          结仇原委：{entry.origin.summary}{entry.origin.place ? `（${entry.origin.place}）` : ""}
        </div>
      ) : null}
      {scars.length > 0 && (
        <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-2xs)" }}>
          旧伤：{scars.map((s) => `${s.kind}${s.note ? `（${String(s.note).slice(0, 12)}）` : ""}`).join("、")}
        </div>
      )}
      {onRecruitNemesis && nemesisRecruitEligibility(varTree, entry).ok && (
        <button
          type="button"
          onClick={() => onRecruitNemesis({ faction: entry.faction, entryId: entry.id })}
          style={{
            alignSelf: "flex-start", marginTop: 2, padding: "2px 10px",
            border: `1px solid ${zoneTheme.border}`, background: "transparent",
            color: "var(--text)", fontSize: "var(--fs-2xs)", cursor: "pointer",
          }}
        >招抚</button>
      )}
    </div>
  );
}

export default function PactPanel({ zoneTheme, onClose, inline, onRecruitNemesis }) {
  const varTree = useGameStore((s) => s.varTree);
  const now = useGameStore((s) => s.time);
  const pacts = flattenPacts(varTree).sort((a, b) => (a.bindTurn || 0) - (b.bindTurn || 0));
  const open = pacts.filter((p) => p.status !== "settled");
  const closed = pacts.filter((p) => p.status === "settled");
  // WO-23B 宿敌谱半区：按势力分组纯读展示；旧档无宿敌谱只显空态，不炸不写。
  const nemeses = flattenNemeses(varTree).sort((a, b) => (b.grudge - a.grudge) || (b.tier - a.tier));
  const nemesisByFaction = {};
  for (const e of nemeses) (nemesisByFaction[e.faction] ||= []).push(e);

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name={`契约与宿敌${open.length ? `（未了 ${open.length}）` : ""}`} zoneTheme={zoneTheme} onClose={onClose} />
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
        <div style={{ marginTop: 16 }}>
          <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-2xs)", marginBottom: 4 }}>宿敌谱</div>
          {!nemeses.length && (
            <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)" }}>
              江湖上还没有与你结仇留名之人。
            </div>
          )}
          {Object.entries(nemesisByFaction).map(([faction, entries]) => (
            <div key={faction} style={{ marginBottom: 8 }}>
              <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-2xs)", marginBottom: 3 }}>{faction}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {entries.map((e) => <NemesisRow key={e.entryKey} entry={e} zoneTheme={zoneTheme} varTree={varTree} onRecruitNemesis={onRecruitNemesis} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Overlay>
  );
}
