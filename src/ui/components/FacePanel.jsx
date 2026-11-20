import { useId, useRef, useState } from "react";
import { chromeBtn } from "../theme.js";
import FaceContent from "./faces/FaceContent.jsx";
import FaceEditor from "./faces/FaceEditor.jsx";
import useFaceNavigation from "./faces/useFaceNavigation.js";
import "./faces/faces.css";

const visible = () => true;
const unblocked = () => false;

export default function FacePanel({ faces, theme, renderModule, isMobile = false, swipe = true,
  isModuleVisible = visible, isKeyboardBlocked = unblocked, label = "面板", className = "" }) {
  const [editing, setEditing] = useState(false);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const contentRef = useRef(null);
  const instanceId = useId();
  const { preferences, face, direction, editable, enableKeyboard, rotate } = faces;
  const panelId = `${instanceId}-${face.id}`;
  const modules = face.modules.filter(isModuleVisible);
  useFaceNavigation({ isMobile, editing, contentRef, rotate, enableKeyboard, isKeyboardBlocked, swipe });
  return (
    <div className={`face-panel ${className}`}>
      <nav className="face-bar" aria-label={`${label}面切换`} style={{ borderColor: theme.border }}>
        <div className="face-labels" role="group" aria-label={`${label}各面`}>
          {preferences.faces.map((item, index) => (
            <FaceLabel key={item.id} item={item} index={index} preferences={preferences}
              instanceId={instanceId} rotate={rotate} />
          ))}
        </div>
        <div className="face-controls">
          {editable && <button type="button" aria-label="编排" title="编排" aria-expanded={editing}
            style={chromeBtn(theme, { active: editing })} onClick={() => setEditing(value => !value)}>⚙</button>}
        </div>
      </nav>
      {editable && editing && <FaceEditor faces={faces} theme={theme} />}
      <div className="face-stage" ref={contentRef} style={{ touchAction: swipe ? "pan-y pinch-zoom" : "auto" }}>
        <FaceContent key={face.id} face={face} panelId={panelId} labelId={`${instanceId}-label-${face.id}`}
          direction={direction} modules={modules} renderModule={renderModule} editable={editable}
          onScrollbarChange={setScrollbarWidth} />
        <button type="button" className="face-edge face-edge-previous" aria-label="上一面"
          style={{ color: theme.textDim }} onClick={() => rotate(-1)}>‹</button>
        <button type="button" className="face-edge face-edge-next" aria-label="下一面"
          style={{ color: theme.textDim, right: Math.max(16, scrollbarWidth) }} onClick={() => rotate(1)}>›</button>
      </div>
    </div>
  );
}

function FaceLabel({ item, index, preferences, instanceId, rotate }) {
  const count = preferences.faces.length;
  const offset = (index - preferences.currentIndex + count) % count;
  const position = offset === 0 ? "current" : offset === 1 ? "next"
    : offset === count - 1 ? "previous" : "hidden";
  const side = position === "previous" || position === "next";
  return (
    <div id={`${instanceId}-label-${item.id}`} className={`face-label face-label-${position}`}
      aria-hidden={position === "hidden" || undefined}>
      {side ? <button type="button" aria-label={position === "previous" ? "上一面" : "下一面"}
        onClick={() => rotate(position === "previous" ? -1 : 1)}>{item.name || "未命名"}</button>
        : <span aria-current={position === "current" ? "true" : undefined}>{item.name || "未命名"}</span>}
    </div>
  );
}
