// 行动识别确认条：与切磋确认条同一位置、同一形态；「是」按识别结果执行，「不是」按原话走自由行动。
import { useIntentPending } from "../../store/intentPendingStore.js";
import { chromeBtn } from "../../utils/theme.js";

export default function IntentConfirmBar({ zoneTheme }) {
  const pending = useIntentPending();
  if (!pending) return null;
  return (
    <div style={{ flexShrink: 0, padding: "10px 16px", borderBottom: `1px solid ${zoneTheme.border}`, background: `color-mix(in srgb, ${zoneTheme.accent} 6%, transparent)`, display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ color: "var(--text)", fontSize: "12px", flex: 1 }}>{pending.text}</span>
      <button type="button" onClick={pending.onConfirm} style={chromeBtn(zoneTheme, { active: true })}>是</button>
      <button type="button" onClick={pending.onCancel} style={chromeBtn(zoneTheme)}>不是</button>
    </div>
  );
}
