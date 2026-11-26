import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { clearNotice, useNotice } from "../../store/uiStore.js";

export default function NoticeToast({ zoneTheme }) {
  const notice = useNotice();
  const [top, setTop] = useState(0);

  useEffect(() => {
    if (!notice) return undefined;
    const bar = document.querySelector(".mobile-top-row");
    const updateTop = () => setTop(Math.ceil((bar?.getBoundingClientRect().bottom || 0) + 8));
    updateTop();
    const observer = bar && typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateTop) : null;
    observer?.observe(bar);
    const viewport = window.visualViewport;
    window.addEventListener("resize", updateTop);
    viewport?.addEventListener("resize", updateTop);
    viewport?.addEventListener("scroll", updateTop);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateTop);
      viewport?.removeEventListener("resize", updateTop);
      viewport?.removeEventListener("scroll", updateTop);
    };
  }, [notice?.id]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => clearNotice(notice.id), 2500);
    return () => clearTimeout(timer);
  }, [notice?.id]);

  if (!notice || typeof document === "undefined") return null;
  return createPortal(
    <>
      <style>{`@keyframes blocked-notice-in{from{opacity:0;transform:translate(-50%,-4px)}to{opacity:1;transform:translate(-50%,0)}}@media(prefers-reduced-motion:reduce){.blocked-direction-toast{animation:none!important}}`}</style>
      <button
        type="button"
        role="status"
        aria-live="polite"
        className="blocked-direction-toast"
        onClick={() => clearNotice(notice.id)}
        style={{
          // 定位与层级在 tokens.css 的 .blocked-direction-toast（--z-hud），这里只留随顶栏高度变化的 top。
          top, transform: "translateX(-50%)",
          width: "max-content", maxWidth: "min(92vw, 420px)", boxSizing: "border-box",
          padding: "9px 14px", whiteSpace: "pre-line", textAlign: "center",
          background: zoneTheme.bgPanel, border: `1px solid ${zoneTheme.border}`,
          borderLeft: `3px solid ${zoneTheme.accent}`, color: zoneTheme.text,
          font: "inherit", lineHeight: 1.5, cursor: "pointer",
          animation: "blocked-notice-in 160ms ease-out",
        }}
      >
        {notice.text}
      </button>
    </>,
    document.body,
  );
}
