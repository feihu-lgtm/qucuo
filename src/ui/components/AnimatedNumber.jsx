// 数值滚动（设计稿 §六 动效）：值变化时从旧值滚到新值（约 450ms，缓出），并按涨跌短暂着色
// （涨青绿、跌朱红字，900ms 后退回原色）。系统设了「减少动态效果」时直接跳到新值、不着色。
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion as reduceMotion } from "../../utils/viewport.js";

export function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

export default function AnimatedNumber({ value, duration = 450, className = "" }) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(target);
  const [delta, setDelta] = useState(null);
  const fromRef = useRef(target);
  const frameRef = useRef(0);
  const timerRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return undefined;
    fromRef.current = target;
    cancelAnimationFrame(frameRef.current);
    clearTimeout(timerRef.current);
    if (reduceMotion() || typeof requestAnimationFrame !== "function") {
      setShown(target);
      return undefined;
    }
    setDelta(target > from ? "up" : "down");
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(Math.round(from + (target - from) * easeOutCubic(t)));
      if (t < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    timerRef.current = setTimeout(() => setDelta(null), 900);
    return () => { cancelAnimationFrame(frameRef.current); clearTimeout(timerRef.current); };
  }, [target, duration]);

  return (
    <span className={className ? `anim-num ${className}` : "anim-num"} data-delta={delta || undefined}>
      {shown}
    </span>
  );
}
