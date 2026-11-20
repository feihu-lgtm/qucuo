import { useEffect } from "react";
import { uiStore } from "../../../store/uiStore.js";

export function faceKeyDirection(event) {
  if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return 0;
  const target = event.target;
  if (target?.closest?.("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='slider'], [role='menu']")) return 0;
  return event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
}

export function faceSwipeDirection(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return Math.abs(dx) >= 56 && Math.abs(dx) > Math.abs(dy) * 1.3 ? (dx < 0 ? 1 : -1) : 0;
}

function hasBlockingLayer() {
  if (uiStore.getState().overlays.length) return true;
  return [...document.querySelectorAll('[role="dialog"], [aria-modal="true"], [style*="position: fixed"]')]
    .some(element => {
      const style = getComputedStyle(element);
      return element.getClientRects().length && style.display !== "none" && style.visibility !== "hidden"
        && (element.matches('[role="dialog"], [aria-modal="true"]') || Number(style.zIndex) >= 50);
    });
}

export default function useFaceNavigation({ isMobile, editing, contentRef, rotate }) {
  useEffect(() => {
    if (isMobile || editing) return undefined;
    const onKey = event => {
      const direction = faceKeyDirection(event);
      if (!direction || hasBlockingLayer()) return;
      event.preventDefault();
      rotate(direction);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobile, editing, rotate]);

  useEffect(() => {
    if (!isMobile) return undefined;
    let start = null;
    let suppressClickUntil = 0;
    // The layout handles drawer gestures in React capture; intercept earlier, on document.
    const onDown = event => {
      if (event.pointerType !== "touch" || !event.isPrimary || !contentRef.current?.contains(event.target)) return;
      start = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
      event.stopPropagation();
    };
    const onUp = event => {
      if (!start || start.pointerId !== event.pointerId) return;
      const direction = faceSwipeDirection(start, { x: event.clientX, y: event.clientY });
      start = null;
      event.stopPropagation();
      if (direction) {
        event.preventDefault();
        suppressClickUntil = Date.now() + 500;
        rotate(direction);
      }
    };
    const onCancel = event => {
      if (start?.pointerId !== event.pointerId) return;
      start = null;
      event.stopPropagation();
    };
    const onClick = event => {
      if (Date.now() >= suppressClickUntil || !contentRef.current?.contains(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const listeners = { pointerdown: onDown, pointerup: onUp, pointercancel: onCancel, click: onClick };
    for (const [type, listener] of Object.entries(listeners)) document.addEventListener(type, listener, true);
    return () => {
      for (const [type, listener] of Object.entries(listeners)) document.removeEventListener(type, listener, true);
    };
  }, [isMobile, contentRef, rotate]);
}
