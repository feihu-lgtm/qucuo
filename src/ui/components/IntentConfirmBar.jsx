// 行动识别确认条：与切磋确认条同一位置、同一形态；「是」按识别结果执行，「不是」按原话走自由行动。
import { useIntentPending } from "../../store/intentPendingStore.js";
import { Button } from "../primitives/index.js";

export default function IntentConfirmBar() {
  const pending = useIntentPending();
  if (!pending) return null;
  return (
    <div className="center-confirm-bar">
      <span className="center-confirm-text">{pending.text}</span>
      <Button variant="chrome" font="native" active={true} type="button" onClick={pending.onConfirm}>是</Button>
      <Button variant="chrome" font="native" type="button" onClick={pending.onCancel}>不是</Button>
    </div>
  );
}
