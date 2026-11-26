// 统一弹窗外壳（路线图 U1-1）
// ---------------------------------------------------------------------------
// 负责遮罩、标题栏、关闭按钮、Esc 关闭、点遮罩关闭（可关）、移动端全屏、焦点锁定。
// 层级只能从 tokens.css 的 --z-* 档位里选（data-layer 属性选档），不再在各界面里手写
// zIndex 数字。外壳本身不写内联 style，定位与层级全在 tokens.css 的 .ui-modal-* 类里。
//
// 移动端全屏沿用 mobile.css 里已有的 mobile-overlay-root / -panel / -header / -close
// 四个类，所以迁过来的弹窗在手机上的表现与原先一致。点遮罩关闭沿用
// useOverlayCloseGuard，避免"从弹窗里拖选文字拖到遮罩上松手就被关掉"。
//
// 可选外观：backdrop="ink"（默认，--ink-overlay）或 "soft"（--ink-overlay-soft，短菜单用）；
// chrome={false} 去掉面板默认的底色、描边、内边距和尺寸上限，给自带版式的面板用。
//
// 用法：
//   <ModalShell title="版本历史" onClose={onClose} layer="top" panelStyle={{ width: 420 }}>
//     ……正文……
//   </ModalShell>

import React, { useEffect, useRef, useState } from "react";
import { useOverlayCloseGuard } from "../../utils/overlayClose.js";
import {
  FOCUSABLE_SELECTOR, isCloseKey, isTopModal, normalizeLayer, nextModalId, popModal, pushModal, wrapFocusIndex,
} from "./modalStack.js";

const NOOP = () => {};
// 面板内的点击不再往外冒泡，与迁移前各弹窗内层的 stopPropagation 保持一致。
const stopPropagation = (event) => event.stopPropagation();

// 手机端面板的三种形态，都复用 mobile.css 里已有的类：
//   fullscreen —— mobile-overlay-panel，铺满屏幕（设置、版本历史这类长面板）
//   sheet      —— mobile-action-panel，居中的整宽卡片（物品、NPC 这类短菜单）
//   none       —— 不挂手机类，手机上保持桌面写法（大地图卷轴这类自带版式的）
//   custom     —— 根节点挂 mobile-overlay-root，面板不挂，由调用方用 panelClassName 自带手机规则
const MOBILE_PANEL_CLASS = { fullscreen: "mobile-overlay-panel", sheet: "mobile-action-panel", custom: "", none: "" };

export default function ModalShell({
  title = null,
  onClose = NOOP,
  children,
  layer = "dialog",
  closeOnBackdrop = true,
  closeOnEsc = true,
  showClose = true,
  closeLabel = "关闭",
  closeText = "× 关闭",
  headerExtra = null,
  mobile = "fullscreen",
  backdrop = "ink",
  chrome = true,
  className = "",
  panelClassName = "",
  rootStyle = undefined,
  panelStyle = undefined,
  ariaLabel = undefined,
}) {
  const [id] = useState(nextModalId);
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const closeGuard = useOverlayCloseGuard(closeOnBackdrop ? onClose : NOOP);

  useEffect(() => {
    pushModal(id);
    const previousFocus = typeof document !== "undefined" ? document.activeElement : null;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });

    const onKeyDown = (event) => {
      if (!isTopModal(id)) return;
      if (closeOnEsc && isCloseKey(event)) {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusables = [...panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR)];
      const target = wrapFocusIndex(focusables.length, focusables.indexOf(document.activeElement), event.shiftKey);
      if (focusables.length === 0) {
        event.preventDefault();
      } else if (target !== -1) {
        event.preventDefault();
        focusables[target].focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      popModal(id);
      if (previousFocus && typeof previousFocus.focus === "function" && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [id, closeOnEsc]);

  const titleId = title ? `${id}-title` : undefined;
  const mobileMode = MOBILE_PANEL_CLASS[mobile] === undefined ? "fullscreen" : mobile;
  const rootClass = ["ui-modal-root", mobileMode !== "none" && "mobile-overlay-root", className].filter(Boolean).join(" ");
  const panelClass = ["ui-modal-panel", MOBILE_PANEL_CLASS[mobileMode], panelClassName].filter(Boolean).join(" ");
  const hasHeader = title !== null || headerExtra !== null || showClose;

  return (
    <div
      className={rootClass}
      data-layer={normalizeLayer(layer)}
      data-backdrop={backdrop === "soft" ? "soft" : "ink"}
      style={rootStyle}
      onMouseDown={closeGuard.onMouseDown}
      onClick={closeGuard.onClick}
    >
      <div
        ref={panelRef}
        className={panelClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={titleId ? undefined : ariaLabel}
        data-chrome={chrome ? undefined : "none"}
        tabIndex={-1}
        style={panelStyle}
        onClick={stopPropagation}
      >
        {hasHeader && (
          <div className={mobileMode === "none" ? "ui-modal-header" : "ui-modal-header mobile-overlay-header"}>
            <div id={titleId} className="ui-modal-title">{title}</div>
            {headerExtra}
            {showClose && (
              <button type="button" className={mobileMode === "none" ? "ui-modal-close" : "ui-modal-close mobile-overlay-close"} aria-label={closeLabel} onClick={onClose}>
                {closeText}
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
