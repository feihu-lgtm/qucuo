import React, { useState } from "react";
import { Overlay, Header, Btn } from "./common.jsx";
import {
  DEFECT_REP_RESET,
  checkSectEntry,
  getSectEntry,
} from "../../../domain/rules/character/sectEntry.js";

// 拜师堂——全门派通用入门与退派界面。按 building.sect 分派对应门派规则，
// 结算全在系统侧完成（加声誉、发信物、写身份 flag / 叛出重置声誉与收牌），
// AI 只负责把既成事实写成叙事。
export default function SectEntryScreen({
  building,
  char,
  narratorAffection,
  flags,
  varTree,
  questProgress,
  zoneTheme,
  onClose,
  inline,
  onJoinSect,
  onLeaveSect,
}) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  const entry = getSectEntry(building);
  const status = checkSectEntry({
    affection: entry.sect === "雪山派" ? (varTree?.角色?.[entry.master]?.好感度 ?? narratorAffection) : undefined,
    char,
    flags,
    questProgress,
    varTree,
  }, entry.sect);

  const joinLabel = status.tuitionDue > 0
    ? `奉上束脩，拜入${entry.sect}（-${status.tuitionDue}两 · 声誉+${entry.repBonus}）`
    : `行礼立誓，正式拜入${entry.sect}（声誉+${entry.repBonus}）`;

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name={building?.name || entry.buildingName || "拜师堂"} zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ padding: "14px 16px", fontSize: 12.5, lineHeight: 1.9, color: zoneTheme.text }}>
        {status.already ? (
          <>
            <div style={{ color: "var(--clay)", marginBottom: 10 }}>
              你已是{entry.sect}正式弟子。
            </div>
            <div style={{ color: zoneTheme.textDim, fontSize: 11.5, marginBottom: 14 }}>
              {entry.alreadyHint}
            </div>
            {onLeaveSect && (
              !confirmLeave ? (
                <Btn label={`交还「${entry.keyName}」，退出${entry.sect}`}
                  onClick={() => setConfirmLeave(true)} zoneTheme={zoneTheme} />
              ) : (
                <div style={{
                  border: `1px solid ${zoneTheme.border}`, borderRadius: 0,
                  padding: "10px 12px", background: "rgba(255,255,255,.02)",
                }}>
                  <div style={{ color: "var(--wuguan-locked)", fontSize: 11.5, marginBottom: 8 }}>
                    主动退出{entry.sect}后，本派声誉将直接重置为 {DEFECT_REP_RESET}（若原本更低则保持原值），
                    收回「{entry.keyName}」并锁死本派高阶武学后续突破（已学招式保留），且门墙永闭。确定退派？
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn label={`确认退出${entry.sect}`} onClick={() => onLeaveSect(entry.sect)} zoneTheme={zoneTheme} />
                    <Btn label="再想想" onClick={() => setConfirmLeave(false)} zoneTheme={zoneTheme} />
                  </div>
                </div>
              )
            )}
          </>
        ) : (
          <>
            <div style={{ color: zoneTheme.textDim, marginBottom: 12 }}>
              {entry.intro}
            </div>

            <div style={{
              border: `1px solid ${zoneTheme.border}`, borderRadius: 0,
              padding: "10px 12px", marginBottom: 12, background: "rgba(255,255,255,.02)",
            }}>
              <div style={{ color: zoneTheme.accentDim, fontSize: 11, marginBottom: 6 }}>入门之限</div>
              {status.reqs.map((r) => (
                <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                  <span style={{ color: r.ok ? "var(--clay)" : "var(--wuguan-locked)", width: 12 }}>{r.ok ? "✓" : "✗"}</span>
                  <span style={{ flex: 1, color: r.ok ? zoneTheme.text : zoneTheme.textDim }}>{r.label}</span>
                  <span style={{ color: r.ok ? "var(--clay)" : "var(--wuguan-locked)", fontSize: 11 }}>{r.have}</span>
                </div>
              ))}
            </div>

            {status.eligible ? (
              <Btn label={joinLabel} onClick={() => onJoinSect(entry.sect)} zoneTheme={zoneTheme} />
            ) : (
              <>
                <Btn label={status.defected ? "门墙永闭" : status.currentSect ? "已隶属他派" : "尚不够格"} disabled zoneTheme={zoneTheme} />
                <div style={{ color: zoneTheme.textDim, fontSize: 11, marginTop: 8 }}>
                  {status.missing.includes("single") && <div>· 全作仅可正式隶属 1 个主门派，须先回{status.currentSect}退派。</div>}
                  {status.missing.includes("defected") && <div>· 你曾叛出{entry.sect}，此门不再收留。</div>}
                  {status.missing.includes("rep") && <div>· {entry.sect}声誉尚浅，至少要攒到「门墙之交」（≥ {entry.minRep}）。</div>}
                  {status.missing.includes("prestige") && <div>· 江湖威望不够格（须 ≥ {entry.minPrestige}）。</div>}
                  {status.missing.includes("trial") && <div>· 尚未通过本门试剑考核（去剑坪堂堂正正胜过青玄或松鹤道长）。</div>}
                  {status.missing.some((key) => key.startsWith("quest:")) && <div>· 尚未完成本门指定的前置入门试炼任务。</div>}
                  {status.missing.includes("affection") && <div>· 她还不够信你。多来往走动，或把雪山派声誉刷到 {entry.minRep} 再来。</div>}
                  {status.missing.includes("neigong") && <div>· 底子还太薄。打坐运功，把内功练上去再来。</div>}
                  {status.missing.includes("tuition") && <div>· 束脩还差着。银两凑够了再来不迟。</div>}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Overlay>
  );
}
