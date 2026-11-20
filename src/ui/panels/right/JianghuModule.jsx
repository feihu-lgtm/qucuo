import { chromeBtn } from "../../theme.js";
import { OVERLAY, openOverlay } from "../../../store/uiStore.js";

export const JIANGHU_ENTRIES = [
  { label: "任务", overlay: OVERLAY.QUEST_LOG },
  { label: "人物关系", overlay: OVERLAY.CHARACTER_PAGE },
  { label: "见闻录", overlay: OVERLAY.LORE },
  { label: "起居注", overlay: OVERLAY.QIJUZHU, title: "起居注：逐日记录起居言动——今日行迹与开局以来的累计" },
];

export default function JianghuModule({ zoneTheme }) {
  return (
    <section aria-label="江湖" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {JIANGHU_ENTRIES.map(entry => (
        <button key={entry.overlay} type="button" title={entry.title}
          style={{ ...chromeBtn(zoneTheme), fontFamily: "inherit" }}
          onClick={() => openOverlay(entry.overlay)}>{entry.label}</button>
      ))}
    </section>
  );
}
