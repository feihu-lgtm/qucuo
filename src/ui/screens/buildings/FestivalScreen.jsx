// 跑马大会会场屏（总纲 v3 第四章）：赛事/下注/同游/夜话/子夜之变。
// 判定全在 domain/rules/festival + features/festival，屏只摆数据和发动作。
import React, { useState } from "react";
import { Overlay, Header, Btn } from "./common.jsx";
import {
  FESTIVAL_CONTESTS,
  FESTIVAL_COMPANION_FAVOR,
  contestFlag,
  companionFlag,
  nightDoneFlag,
  MIDNIGHT_FLAG,
} from "../../../domain/data/festival/festivalData.js";
import {
  isContestOpen,
  companionCandidates,
  isNightTalkHour,
  isMidnightHour,
  pickMidnightEvent,
} from "../../../domain/rules/festival/rules.js";

const dim = { color: "var(--ink-text-dim)", fontSize: "var(--fs-xs)", marginBottom: 8 };
const sectionTitle = (zoneTheme) => ({
  color: zoneTheme.accent, fontSize: "var(--fs-sm)", margin: "14px 0 6px",
});

function windowLabel(contest, hour) {
  if (isContestOpen(contest, hour)) return "正开场";
  return `${contest.window[0]}–${contest.window[1]}时`;
}

export default function FestivalScreen({
  building, char, flags, time, varTree, questProgress, zoneTheme, onClose, inline,
  onEnter, onBet, onInvite, onNight, onWubi, onMidnight,
}) {
  const hour = time % 24;
  const dayIdx = Math.floor(time / 24);
  const money = char.money || 0;
  const [bet, setBet] = useState(10);
  const [betFor, setBetFor] = useState("saima");
  // 子夜之变只抽一次签（useState 惰性初始化），flag 保证一生一回。
  const [midnight] = useState(() => (
    isMidnightHour(time % 24) && !(flags || []).includes(MIDNIGHT_FLAG)
      && questProgress?.paoma_ziye?.status !== "completed"
      ? pickMidnightEvent() : null
  ));

  const invitedToday = (flags || []).find((f) => f.startsWith(`festival_companion_${dayIdx}_`))
    ?.split(`festival_companion_${dayIdx}_`)[1];
  const companions = companionCandidates(varTree);
  const invitedCompanion = companions.find((c) => c.name === invitedToday);
  const nightDone = invitedToday && (flags || []).includes(nightDoneFlag(invitedToday, dayIdx));

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name={building.name} zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ padding: 16 }}>
        <div style={dim}>银两 {money} 两 · 现在 {hour} 时 · {building.desc}</div>

        <div style={sectionTitle(zoneTheme)}>一、节目单</div>
        {Object.values(FESTIVAL_CONTESTS).map((contest) => {
          const open = isContestOpen(contest, hour);
          const entered = (flags || []).includes(contestFlag(contest.id, "enter", dayIdx));
          const betted = (flags || []).includes(contestFlag(contest.id, "bet", dayIdx));
          const isFight = contest.id === "wubi";
          return (
            <div key={contest.id} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: "var(--fs-sm)", color: "var(--ink-text)", marginBottom: 4 }}>
                {contest.title}（{windowLabel(contest, hour)}）
                {isFight ? "" : ` · 魁首 ${contest.champion.name} ${contest.champion.score} 分`}
              </div>
              <div style={{ ...dim, marginBottom: 4 }}>{contest.desc}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Btn zoneTheme={zoneTheme}
                  label={entered ? "今日已比过" : isFight ? "上擂台" : "报名参加"}
                  disabled={entered || !open}
                  onClick={() => (isFight ? onWubi?.() : onEnter?.(contest.id))} />
                <Btn zoneTheme={zoneTheme} secondary
                  label={betted ? "今日已下注" : `下注${bet}两`}
                  disabled={betted || !open}
                  onClick={() => setBetFor(betFor === contest.id ? "" : contest.id)} />
              </div>
              {betFor === contest.id && !betted && open && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--ink-text-dim)" }}>注额</span>
                    <input type="number" value={bet} min={1} max={Math.min(50, money)}
                      onChange={(e) => setBet(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                      style={{ width: 60, background: "var(--bg-ink)", border: `1px solid ${zoneTheme.border}`, color: "var(--ink-text)", fontSize: "var(--fs-xs)", padding: "2px 4px" }} />
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--ink-text-dim)" }}>两（≤50，押谁点谁）</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {contest.bettors.map((b) => (
                      <Btn key={b.name} zoneTheme={zoneTheme} secondary
                        label={`${b.name} ×${b.odds}`}
                        disabled={money < bet}
                        onClick={() => { onBet?.(contest.id, b.name, bet); setBetFor(""); }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div style={sectionTitle(zoneTheme)}>二、同游（好感 ≥ {FESTIVAL_COMPANION_FAVOR}，一天一人）</div>
        {invitedToday ? (
          <div style={dim}>今日伴游：{invitedToday}</div>
        ) : (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {companions.map((c) => (
              <Btn key={c.name} zoneTheme={zoneTheme}
                label={`${c.name}${c.masked ? "（蒙面）" : ""} ${c.favor}`}
                disabled={!c.ok}
                onClick={() => onInvite?.(c.name)} />
            ))}
          </div>
        )}

        <div style={sectionTitle(zoneTheme)}>三、夜晚剧情（戌亥之交 19–22 时）</div>
        {invitedCompanion && isNightTalkHour(hour) && !nightDone ? (
          <Btn zoneTheme={zoneTheme} label={`与${invitedCompanion.name}夜话`}
            onClick={() => onNight?.(invitedCompanion.name)} />
        ) : (
          <div style={dim}>
            {nightDone ? "今夜已叙过。" : invitedToday ? "时辰未到或已过，戌亥之交再来。" : "白日同游过的人，夜里才寻得着。"}
          </div>
        )}

        <div style={sectionTitle(zoneTheme)}>四、子夜之变（23 时）</div>
        {midnight ? (
          <div>
            <div style={{ ...dim, marginBottom: 8 }}>{midnight.intro}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {midnight.choices.map((choice) => (
                <Btn key={choice.flag} zoneTheme={zoneTheme} secondary={choice.kind === "yield"}
                  label={choice.label}
                  onClick={() => onMidnight?.(midnight, choice)} />
              ))}
            </div>
          </div>
        ) : (
          <div style={dim}>
            {(flags || []).includes(MIDNIGHT_FLAG) || questProgress?.paoma_ziye?.status === "completed"
              ? "子夜的事已经过了。" : "变故只在子夜来——留到二十三时再看。"}
          </div>
        )}
      </div>
    </Overlay>
  );
}
