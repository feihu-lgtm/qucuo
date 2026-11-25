import { chromeBtn } from "../../../utils/theme.js";
import { OVERLAY, openOverlay } from "../../../store/uiStore.js";
import { useGameStore } from "../../../store/gameStore.js";
import { reputationLabel } from "../../../domain/rules/prompt/mvu.js";
import { listFactionRep } from "../../../domain/rules/economy/factionRep.js";
import JianghuDials from "./jianghuDials.jsx";

export const JIANGHU_ENTRIES = [
  { label: "任务", overlay: OVERLAY.QUEST_LOG },
  { label: "人物关系", overlay: OVERLAY.CHARACTER_PAGE },
  { label: "见闻录", overlay: OVERLAY.LORE },
  { label: "起居注", overlay: OVERLAY.QIJUZHU, title: "起居注：逐日记录起居言动——今日行迹与开局以来的累计" },
];

export default function JianghuModule({ zoneTheme, isMobile }) {
  const varTree = useGameStore(s => s.varTree);
  const fame = varTree?.世界?.威望 ?? 0;
  const factions = listFactionRep(varTree);
  return (
    <section aria-label="江湖" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* 桌面版：四个转盘直接转着看；手机屏窄，仍走原弹层入口 */}
      {isMobile ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {JIANGHU_ENTRIES.map(entry => (
            <button key={entry.overlay} type="button" title={entry.title}
              style={{ ...chromeBtn(zoneTheme), fontFamily: "inherit" }}
              onClick={() => openOverlay(entry.overlay)}>{entry.label}</button>
          ))}
        </div>
      ) : (
        <JianghuDials zoneTheme={zoneTheme} />
      )}
      <div aria-label="声誉" title="威望是全江湖的总名声；势力声誉到「友善」起，在该势力据点买东西打折"
        style={{ width: "100%", fontSize: "var(--fs-xs)", color: zoneTheme?.textDim, lineHeight: 1.7 }}>
        威望 {fame}（{reputationLabel(fame)}）
        {factions.map(({ name, value, label }) => <span key={name}> · {name} {label} {value}</span>)}
      </div>
    </section>
  );
}
