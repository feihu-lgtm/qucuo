// 江湖四转盘（桌面版）：任务/人物关系/见闻录/起居注，每张卡内联展示一条内容，
// 点一下就转一条（i→i+1 循环），不再先开次级菜单。「展开」角标仍可到完整弹层。
import { useState } from "react";
import { OVERLAY, openOverlay } from "../../../store/uiStore.js";
import { useGameStore } from "../../../store/gameStore.js";
import { listCharacters, npcAffectionLabel } from "../../../domain/rules/prompt/mvu.js";
import { getAvailableMilestone } from "../../../domain/data/character/characterMilestones.js";
import { QUCUO_QUESTS } from "../../../domain/data/quests/qucuoQuests.js";
import { SNOW_QUEST_ID, SNOW_SPIRITS, snowSpiritCount } from "../../../domain/rules/quests/snowLeopardQuest.js";
import { getCurrentStage } from "../../../domain/rules/quests/questEngine.js";
import { TALLY_KINDS, tallyToday } from "../../../domain/rules/memory/tally.js";

const fmtTurn = (t) => `第${Math.floor(t / 24) + 1}日`;

// 转盘骨架：标题行（标签 + i/N + 展开）+ 点击即转动的内容区
function DialCard({ zoneTheme, title, overlay, items, renderItem, emptyText }) {
  const [i, setI] = useState(0);
  const n = items.length;
  const cur = n ? items[i % n] : null;
  return (
    <div style={{ border: `1px solid ${zoneTheme.border}`, borderRadius: 0, padding: "6px 8px", background: "rgba(255,255,255,0.02)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: zoneTheme.accentDim, fontSize: 11 }}>{title}</span>
        <span style={{ flex: 1 }} />
        {n > 0 && <span style={{ color: zoneTheme.textDim, fontSize: 10 }}>{(i % n) + 1}/{n}</span>}
        {overlay && (
          <span title="展开完整面板" role="button" tabIndex={0}
            onClick={() => openOverlay(overlay)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openOverlay(overlay); } }}
            style={{ cursor: "pointer", color: zoneTheme.textDim, fontSize: 11, lineHeight: 1 }}>⇱</span>
        )}
      </div>
      <div role={n > 1 ? "button" : undefined} tabIndex={n > 1 ? 0 : undefined}
        onClick={() => n > 1 && setI(v => (v + 1) % n)}
        onKeyDown={e => { if (n > 1 && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setI(v => (v + 1) % n); } }}
        style={{ cursor: n > 1 ? "pointer" : "default", marginTop: 4, minHeight: 26 }}
        title={n > 1 ? "点一下转到下一条" : undefined}>
        {cur ? renderItem(cur, i % n) : <div style={{ color: zoneTheme.textDim, fontSize: 10.5, padding: "2px 0" }}>{emptyText}</div>}
      </div>
    </div>
  );
}

const dim = { fontSize: 10.5, lineHeight: 1.55 };

// ── 任务转盘：进行中→已完成→已错过；每条把委托人、背景与当前阶段条件写全 ──
function QuestDialItem({ q, prog, flags, zoneTheme }) {
  const status = prog?.status;
  const stage = getCurrentStage(q, prog);
  const negative = prog?.outcome === "negative";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
        <span style={{ color: "var(--text)", fontSize: 12 }}>{q.title}</span>
        <span style={{ color: status === "active" ? "var(--quest-stage-count)" : negative || status === "locked_by_exclusive" ? "var(--quest-negative-text)" : "var(--ink-leaf)", fontSize: 10, flexShrink: 0 }}>
          {status === "active" ? `${(prog?.currentStageIndex ?? 0) + 1}/${q.stages.length}` : status === "completed" ? (negative ? "✗ 已了" : "✓ 已成") : "✕ 已错过"}
        </span>
      </div>
      {q.giver && <div style={{ ...dim, color: zoneTheme.textDim }}>委托人：{q.giver}</div>}
      <div style={{ ...dim, color: zoneTheme.textDim }}>{q.description}</div>
      {status === "active" && stage && (
        <div style={{ ...dim, color: "var(--quest-stage-desc)", marginTop: 2 }}>
          ◆ {stage.playerHint ?? stage.description}
        </div>
      )}
      {status === "active" && q.id === SNOW_QUEST_ID && (
        <div style={{ ...dim, color: zoneTheme.textDim }}>
          {stage?.title} · {snowSpiritCount(flags)}/5
          {SNOW_SPIRITS.map(({ flag, label }) => <div key={flag}>{flags.includes(flag) ? "✓" : "○"} {label}</div>)}
        </div>
      )}
      {status === "completed" && q.rewardText && <div style={{ ...dim, color: "var(--quest-success-text)" }}>{q.rewardText}</div>}
      {status === "locked_by_exclusive" && <div style={{ ...dim, color: "var(--quest-missed-desc)" }}>因其他抉择而不再可行。</div>}
    </div>
  );
}

// ── 人物关系转盘：结识名单按好感度降序，好感条+里程碑标记 ──
function RelationDialItem({ c, claimedMilestones, zoneTheme }) {
  const affection = c.attrs.好感度 ?? 0;
  const milestone = getAvailableMilestone(c.name, affection, claimedMilestones);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "var(--text)", fontSize: 12 }}>{c.name}</span>
        {milestone && <span style={{ color: "var(--ember)", fontSize: 10 }}>● 任务</span>}
      </div>
      <div style={{ ...dim, color: "var(--pink)" }}>{npcAffectionLabel(affection)} · {affection}/100</div>
      <div style={{ height: 5, background: "var(--bg-panel)", borderRadius: 0, overflow: "hidden", marginTop: 2 }}>
        <div style={{ height: "100%", width: `${Math.min(100, affection)}%`, background: "linear-gradient(90deg, var(--pink), var(--ember))" }} />
      </div>
    </div>
  );
}

// ── 见闻录转盘：事实账本按诞生回合倒序 ──
function LoreDialItem({ fact, zoneTheme }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 10, color: zoneTheme.accent }}>{fmtTurn(fact.诞生回合 || 0)}</span>
        {fact.标签 && <span style={{ fontSize: 9.5, color: zoneTheme.textDim, border: `1px solid ${zoneTheme.border}`, borderRadius: 0, padding: "0 4px" }}>{fact.标签}</span>}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--lore-summary)", lineHeight: 1.55, marginTop: 2 }}>{fact.摘要 || "（此事尚无定论）"}</div>
    </div>
  );
}

// ── 起居注转盘：今日各类行迹逐条转 ──
function QijuzhuDialItem({ row, zoneTheme }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ color: "var(--text)", fontSize: 12 }}>{row.label}</span>
      <span style={{ color: zoneTheme.textDim, fontSize: 10.5 }}>×{row.count}</span>
    </div>
  );
}

export default function JianghuDials({ zoneTheme }) {
  const varTree = useGameStore(s => s.varTree);
  const questProgress = useGameStore(s => s.questProgress) || {};
  const flags = useGameStore(s => s.flags) || [];
  const time = useGameStore(s => s.time) || 0;
  const claimedMilestones = useGameStore(s => s.claimedMilestones);

  const stageQuests = QUCUO_QUESTS.filter(q => q.stages?.length);
  const quests = [
    ...stageQuests.filter(q => questProgress[q.id]?.status === "active"),
    ...stageQuests.filter(q => questProgress[q.id]?.status === "completed"),
    ...stageQuests.filter(q => questProgress[q.id]?.status === "locked_by_exclusive"),
  ];
  const characters = listCharacters(varTree || {})
    .filter(c => typeof c.attrs.好感度 === "number")
    .sort((a, b) => (b.attrs.好感度 ?? 0) - (a.attrs.好感度 ?? 0));
  const facts = Object.values(varTree?.世界?.知识领域?.事实 || {})
    .sort((a, b) => (b.诞生回合 || 0) - (a.诞生回合 || 0));
  const tally = varTree?.世界?.起居注;
  const today = tallyToday(tally, time);
  const tallyRows = Object.entries(today)
    .filter(([k, v]) => TALLY_KINDS[k] && v > 0)
    .map(([k, v]) => ({ kind: k, label: TALLY_KINDS[k].label, count: v }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <DialCard zoneTheme={zoneTheme} title="任务" overlay={OVERLAY.QUEST_LOG} items={quests}
        emptyText="尚无已接取的任务。与故事中的人物深入交谈，也许会有委托。"
        renderItem={(q) => <QuestDialItem q={q} prog={questProgress[q.id]} flags={flags} zoneTheme={zoneTheme} />} />
      <DialCard zoneTheme={zoneTheme} title="人物关系" overlay={OVERLAY.CHARACTER_PAGE} items={characters}
        emptyText="尚未结识任何人，先去游戏里闯闯吧。"
        renderItem={(c) => <RelationDialItem c={c} claimedMilestones={claimedMilestones} zoneTheme={zoneTheme} />} />
      <DialCard zoneTheme={zoneTheme} title="见闻录" overlay={OVERLAY.LORE} items={facts}
        emptyText="还没有记下的见闻。"
        renderItem={(f) => <LoreDialItem fact={f} zoneTheme={zoneTheme} />} />
      <DialCard zoneTheme={zoneTheme} title="起居注" overlay={OVERLAY.QIJUZHU} items={tallyRows}
        emptyText={`第${Math.floor(time / 24) + 1}日尚未留下行迹。`}
        renderItem={(r) => <QijuzhuDialItem row={r} zoneTheme={zoneTheme} />} />
    </div>
  );
}
