// WO-25O：路遇「可行之事」按钮条——与行动识别确认条同一位置、同一形态。
// 按钮照抄 label 直发进输入通道，与手敲同义完全同路；挂起只在下一
// 句输入内有效，时过境迁自动作废。本组件不碰任何状态直写。
import { useStore } from "zustand";
import { roadEventPendingStore } from "../../features/roadevent/pending.js";
import { Button } from "../primitives/index.js";

export default function RoadEventBar({ onChoose }) {
  const pending = useStore(roadEventPendingStore, (state) => state.pending);
  if (!pending?.roll?.options?.length) return null;
  return (
    <div className="center-confirm-bar" data-part="road-event-bar">
      <span className="center-confirm-text">可行之事</span>
      {pending.roll.options.map((option) => (
        <Button
          variant="chrome"
          font="native"
          key={option.key}
          type="button"
          onClick={() => onChoose?.(option.label)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
